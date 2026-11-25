import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import {
  exito, MAXIMO_DE_AUDIO_BASE64, MAXIMO_DE_TEXTO_DE_CAPTURA, rechazo, SEGUNDOS_MAXIMOS_DE_AUDIO, type Respuesta, type TranscribirAudio, type Transcripcion,
} from '@capaz/shared';
import { CONFIG, type Config } from '../../infra/config/config.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { leerWav } from './audio-wav.js';
import { capturasRecientes, gastoDelMes, leerConfiguracion, registrarUso, zonaDeLaEmpresa } from './repositorio-de-uso.js';
import { TRANSCRIPTOR_DE_VOZ, type ResultadoDeTranscripcion, type TranscriptorDeVoz } from './transcriptor-de-voz.js';

// El dictado por audio: la web graba (Firefox y otros navegadores sin reconocimiento de voz), manda un WAV y recibe el texto, que va
// a la caja para corregirlo (nunca se envía solo). El audio NO se guarda ni se registra: se mide, se manda al modelo y se olvida.
// Cuenta para el tope mensual de la empresa y tiene su propio ritmo por persona, ambos en `core.uso`.

/** Transcripciones (y extracciones del dictado) por persona y minuto. */
export const LIMITE_DE_CAPTURAS_POR_MINUTO = 12;
/** Menos que esto es un toque sin querer: no se gasta una llamada. */
export const SEGUNDOS_MINIMOS_DE_AUDIO = 0.3;
const MAXIMO_DE_BYTES = (MAXIMO_DE_AUDIO_BASE64 / 4) * 3;

type Sesion = { requestId: string; empresaId: string; usuarioId: string };
type Rechazo = ReturnType<typeof rechazo>;
type FalloDeTranscripcion = Extract<ResultadoDeTranscripcion, { ok: false }>;

@Injectable()
export class ServicioDeTranscripcion {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(TRANSCRIPTOR_DE_VOZ) private readonly transcriptor: TranscriptorDeVoz,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  private conTx<T>(s: Sesion, fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    return this.db.conEmpresa({ empresaId: s.empresaId, usuarioId: s.usuarioId }, fn);
  }

  async transcribir(s: Sesion, cuerpo: TranscribirAudio): Promise<Respuesta<Transcripcion>> {
    // Apagado no se llama a nadie: el transcriptor que queda inyectado (el simulado) nunca responde en la práctica.
    if (this.config.AGENTE_PROVEEDOR === 'apagado') return rechazo('apagado', 'El dictado por voz no está activo en este sistema. Escribe el texto.');
    const transcriptor = this.transcriptor;
    const audio = Buffer.from(cuerpo.audioBase64, 'base64');
    const medida = this.medir(audio);
    if ('rechazo' in medida) return medida.rechazo;
    if (medida.segundos < SEGUNDOS_MINIMOS_DE_AUDIO) return exito({ texto: '' });
    const turnoId = randomUUID();
    const rechazoDeEntrada = await this.admitir(s, turnoId, transcriptor.modelo);
    if (rechazoDeEntrada) return rechazoDeEntrada;
    const inicio = performance.now();
    const r = await transcriptor.transcribir(audio.toString('base64'));
    await this.anotar(s, turnoId, transcriptor.modelo, r, performance.now() - inicio);
    if (!r.ok) return this.fallo(s, r);
    return exito({ texto: r.texto.slice(0, MAXIMO_DE_TEXTO_DE_CAPTURA) });
  }

  /** La duración sale de la cabecera WAV; el tamaño, de los bytes reales. Nada del audio llega al registro. */
  private medir(audio: Buffer): { segundos: number } | { rechazo: Rechazo } {
    if (audio.length > MAXIMO_DE_BYTES) return { rechazo: rechazo('solicitud_muy_grande', 'El audio es demasiado largo.') };
    const wav = leerWav(audio);
    if (!wav.ok) return { rechazo: rechazo('argumentos_invalidos', wav.motivo) };
    if (wav.cabecera.segundos > SEGUNDOS_MAXIMOS_DE_AUDIO) {
      return { rechazo: rechazo('solicitud_muy_grande', `El audio dura más de ${SEGUNDOS_MAXIMOS_DE_AUDIO} segundos. Dicta en partes más cortas.`) };
    }
    return { segundos: wav.cabecera.segundos };
  }

  /**
   * Tope y ritmo en UNA transacción corta, tras un candado por empresa y persona, y la RESERVA de la llamada (una fila de costo cero con
   * su `turno_id`) antes de soltarlo: así veinte peticiones simultáneas no ven todas «cero» y pasan juntas. Igual que `admitir` del turno.
   */
  private admitir(s: Sesion, turnoId: string, modelo: string): Promise<Rechazo | null> {
    return this.conTx(s, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`voz:${s.empresaId}:${s.usuarioId}`}, 0))`);
      const tope = (await leerConfiguracion(tx))?.topeMensualMicrousd ?? Math.round(this.config.AGENTE_TOPE_MENSUAL_USD * 1_000_000);
      if ((await gastoDelMes(tx, new Date(), await zonaDeLaEmpresa(tx))) >= tope) return rechazo('tope_mensual', 'Se alcanzó el tope de uso de este mes. Escribe el texto.');
      if ((await capturasRecientes(tx, 60)) >= LIMITE_DE_CAPTURAS_POR_MINUTO) {
        return rechazo('demasiados_intentos', 'Estás dictando muy rápido. Espera un momento e inténtalo otra vez.');
      }
      await registrarUso(tx, { origen: 'captura', turnoId, modelo, tokensEntrada: 0, tokensSalida: 0, tokensCache: 0, costoMicrousd: 0, rondas: 0, duracionMs: 0, resultado: 'ok' });
      return null;
    });
  }

  /** El costo real, en otra transacción corta (nunca abierta mientras se espera al modelo). Lo gastado cuenta aunque la respuesta no sirva. */
  private async anotar(s: Sesion, turnoId: string, modelo: string, r: ResultadoDeTranscripcion, ms: number): Promise<void> {
    const uso = r.uso ?? { tokensEntrada: 0, tokensSalida: 0, costoMicrousd: 0 };
    try {
      await this.conTx(s, (tx) =>
        registrarUso(tx, { origen: 'captura', turnoId, modelo, ...uso, tokensCache: 0, rondas: 1, duracionMs: Math.round(ms), resultado: r.ok ? 'ok' : 'error' }),
      );
    } catch (e) {
      this.logger.error({ requestId: s.requestId, error: e instanceof Error ? e.name : 'desconocido' }, 'No se pudo anotar el costo de una transcripción');
    }
  }

  /** Solo el motivo y el estado HTTP van al registro: nunca el audio, la respuesta del proveedor ni la llave. */
  private fallo(s: Sesion, r: FalloDeTranscripcion): Rechazo {
    this.logger.warn({ requestId: s.requestId, motivo: r.motivo, ...(r.estado === undefined ? {} : { estado: r.estado }) }, 'La transcripción del dictado falló');
    if (r.motivo === 'tiempo_agotado') return rechazo('modelo_no_disponible', 'La voz tardó demasiado en transcribirse. Inténtalo de nuevo o escribe el texto.');
    if (r.motivo === 'modelo_no_disponible') return rechazo('modelo_no_disponible', 'El dictado por voz no está disponible ahora mismo. Inténtalo en unos minutos o escribe el texto.');
    return rechazo('error_interno', 'No se pudo transcribir el audio. Inténtalo de nuevo o escribe el texto.');
  }
}
