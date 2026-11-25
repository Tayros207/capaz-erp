import { Inject, Injectable, type MessageEvent } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { interval, map, merge, Observable, ReplaySubject, takeUntil } from 'rxjs';
import type { EventoDelAgente, TurnoDelAgente } from '@capaz/shared';
import type { Logger } from 'pino';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { conPuntoDeGuardado, type Transaccion } from '../../infra/database/con-empresa.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import type { ContextoDePeticion } from '../../infra/http/contexto.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { CatalogoDeModulos } from '../modulos/catalogo.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { correrTurno } from './bucle.js';
import { MODELO_DE_CHAT, type ModeloDeChat } from './modelo-de-chat.js';
import { escrituraEfectiva, modeloEfectivo, modoDeEscritura } from './modelos.js';
import { capturarLeccionesDeBorradores, leccionesDeErroresCorregidos } from './captura-de-lecciones.js';
import { esquemaParaElModelo } from './esquema-limpio.js';
import { armarPrompt, MAXIMO_DE_LECCIONES } from './prompt.js';
import { guardarLeccion, leccionesVigentes } from './repositorio-de-memoria.js';
import { claveDeNegocio, mayorImporteEnCentimos, TOPE_POR_OPERACION_POR_OMISION } from './guardas-de-dinero.js';
import { CRITICAS_DE_DINERO, DINERO } from './politica.js';
import { crearProponerDesdeAgente } from './proponer-desde-agente.js';
import { argumentosDelDia, argumentosRecientes, escribirHuellaAparte, escribirHuellaDeAccion, hayPropuestaPendienteDelSistema } from './repositorio-de-huella.js';
import { decidirReintento, MILISEGUNDOS_POR_TURNO, rechazoPorLimites, rechazoPrevio, type RechazoDeEntrada } from './reglas-de-entrada.js';
import {
  abrirTurno, anotarEnLista, cerrarTurno, historialParaElModelo, retomarTurno, type ListaDeAnotaciones, type TurnoAbierto,
} from './repositorio.js';
import { gastoDelMes, leerConfiguracion, turnosRecientes, zonaDeLaEmpresa, type ConfiguracionGuardada, type UsoParaGuardar } from './repositorio-de-uso.js';
import type { DependenciasDelBucle, ResultadoDeTurno } from './tipos-del-turno.js';

const finito = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Cada cuánto se manda un latido mientras no haya otro evento: las capas intermedias cierran las conexiones inactivas. */
export const LATIDO_MS = 15_000;

type Emitir = (evento: EventoDelAgente) => void;
type Marcha = { conversacionId: string; mensajeAgenteId: string };
type Limites = { fila: ConfiguracionGuardada | null; zona: string; gasto: number };
type Admision = { rechazo: RechazoDeEntrada } | { limites: Limites; abierto: TurnoAbierto };

const comoMensaje = (e: EventoDelAgente): MessageEvent => ({ type: e.type, data: e });
const errorDe = (r: RechazoDeEntrada): EventoDelAgente => ({ type: 'error', motivo: r.motivo, mensaje: r.mensaje });

const usoPlano = (r: ResultadoDeTurno): Omit<UsoParaGuardar, 'origen' | 'turnoId' | 'modelo' | 'resultado'> => ({
  tokensEntrada: r.uso.tokensEntrada, tokensSalida: r.uso.tokensSalida, tokensCache: r.uso.tokensCache, costoMicrousd: r.uso.costoMicrousd, rondas: r.uso.rondas, duracionMs: r.uso.duracionMs,
});

/** El turno del asistente, de la petición al último evento. Corre DESLIGADO de la conexión (ver `iniciar`). */
@Injectable()
export class ServicioDeTurnos {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(EjecutorDeHerramientas) private readonly ejecutor: EjecutorDeHerramientas,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
    @Inject(MODELO_DE_CHAT) private readonly modelo: ModeloDeChat,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Devuelve los eventos del turno y lo arranca SIN esperarlo. Al cerrarse la conexión Nest cancela la suscripción, pero el
   * turno sigue: si la plataforma lo deja terminar, queda guardado aunque nadie lo esté mirando.
   *
   * Los sujetos REPITEN lo emitido: un rechazo inmediato (asistente apagado, sin módulos) se emite antes de que Nest se suscriba,
   * y con un sujeto simple se perdería —y el latido, sin nada que lo corte, no terminaría nunca—.
   */
  iniciar(ctx: ContextoDePeticion, cuerpo: TurnoDelAgente): Observable<MessageEvent> {
    const salida = new ReplaySubject<MessageEvent>();
    const terminado = new ReplaySubject<void>(1);
    const contexto = this.comoContexto(ctx);
    void this.correr(contexto, cuerpo, (e) => salida.next(comoMensaje(e))).finally(() => {
      salida.complete();
      terminado.next();
      terminado.complete();
    });
    const latido = interval(LATIDO_MS).pipe(takeUntil(terminado), map((): MessageEvent => ({ comment: 'latido' }) as MessageEvent));
    return merge(salida, latido);
  }

  private comoContexto(ctx: ContextoDePeticion): ContextoDeHerramienta {
    if (!ctx.empresaId || !ctx.usuarioId) throw new Error('El turno exige empresa y persona.');
    return { requestId: ctx.requestId, empresaId: ctx.empresaId, usuarioId: ctx.usuarioId, rol: ctx.rol, permisos: ctx.permisos, modulos: ctx.modulos, canal: 'agente' };
  }

  private conTx<T>(c: ContextoDeHerramienta, fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    return this.db.conEmpresa({ empresaId: c.empresaId, usuarioId: c.usuarioId }, fn);
  }

  /** Nunca lanza: lo que falle se anota en el mensaje y se avisa a la web. Solo se registra el nombre del error, nunca su texto. */
  private async correr(c: ContextoDeHerramienta, cuerpo: TurnoDelAgente, emitir: Emitir): Promise<void> {
    const marcha: { actual: Marcha | null } = { actual: null };
    try {
      await this.turno(c, cuerpo, emitir, marcha);
    } catch (e) {
      this.logger.error({ requestId: c.requestId, error: e instanceof Error ? e.name : 'desconocido' }, 'El turno del asistente falló');
      await this.marcarComoError(c, marcha.actual, null);
      emitir({ type: 'error', motivo: 'interno', mensaje: 'Ocurrió un error inesperado. Inténtalo de nuevo.' });
    }
  }

  /** Deja el mensaje en «error» y, si ya se gastó algo, también el uso: lo gastado cuenta para el tope aunque el turno falle. */
  private async marcarComoError(c: ContextoDeHerramienta, marcha: Marcha | null, gasto: UsoParaGuardar | null): Promise<void> {
    if (!marcha) return;
    await this.conTx(c, (tx) => cerrarTurno(tx, { mensajeId: marcha.mensajeAgenteId, conversacionId: marcha.conversacionId, estado: 'error', contenido: '', metadatos: { corte: 'error' }, uso: gasto })).catch(() => undefined);
  }

  private topeDe(fila: ConfiguracionGuardada | null): number {
    return fila?.topeMensualMicrousd ?? Math.round(this.config.AGENTE_TOPE_MENSUAL_USD * 1_000_000);
  }

  private async turno(c: ContextoDeHerramienta, cuerpo: TurnoDelAgente, emitir: Emitir, marcha: { actual: Marcha | null }): Promise<void> {
    const previo = rechazoPrevio({ proveedor: this.config.AGENTE_PROVEEDOR, puedeEntrarAAlgunModulo: c.modulos.some((m) => m.puedeEntrar) });
    if (previo) return emitir(errorDe(previo));
    const admision = await this.admitir(c, cuerpo);
    if ('rechazo' in admision) return emitir(errorDe(admision.rechazo));
    const { limites, abierto } = admision;
    const modelo = modeloEfectivo(this.config, limites.fila?.modelo ?? null);
    const seguir = await this.resolverApertura(c, cuerpo, abierto, modelo, emitir);
    if (!seguir) return;
    marcha.actual = seguir;
    emitir({ type: 'inicio', conversacionId: seguir.conversacionId, turnoId: cuerpo.turnoId, modelo });
    await this.ejecutarYCerrar(c, cuerpo, seguir, limites, modelo, emitir);
  }

  /**
   * Comprueba los límites Y abre el turno en UNA transacción, tras un candado por empresa y persona. Sin el candado, cincuenta
   * peticiones simultáneas verían «cero turnos» y correrían todas: la comprobación y el registro del turno tienen que ser atómicos.
   */
  private admitir(c: ContextoDeHerramienta, cuerpo: TurnoDelAgente): Promise<Admision> {
    return this.conTx(c, async (tx): Promise<Admision> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`agente:${c.empresaId}:${c.usuarioId}`}, 0))`);
      const fila = await leerConfiguracion(tx);
      const zona = await zonaDeLaEmpresa(tx);
      const gasto = await gastoDelMes(tx, new Date(), zona);
      const rechazo = rechazoPorLimites({ gastoMicrousd: gasto, topeMicrousd: this.topeDe(fila), turnosUltimoMinuto: await turnosRecientes(tx, 60), turnosUltimoDia: await turnosRecientes(tx, 86_400) });
      if (rechazo) return { rechazo };
      const abierto = await abrirTurno(tx, { conversacionId: cuerpo.conversacionId, turnoId: cuerpo.turnoId, mensaje: cuerpo.mensaje });
      return { limites: { fila, zona, gasto }, abierto };
    });
  }

  /** Decide qué hacer con el turno recién abierto. Devuelve la conversación si hay que correr el modelo, o `null` si ya quedó resuelto. */
  private async resolverApertura(c: ContextoDeHerramienta, cuerpo: TurnoDelAgente, abierto: TurnoAbierto, modelo: string, emitir: Emitir): Promise<Marcha | null> {
    if (abierto.tipo === 'sin_conversacion') return this.rechazarApertura(emitir, 'interno', 'Esa conversación no existe o no es tuya.');
    if (abierto.tipo === 'conversacion_ocupada') return this.rechazarApertura(emitir, 'turno_en_curso', 'El asistente todavía está respondiendo en esta conversación. Espera a que termine.');
    if (abierto.tipo === 'nuevo') return { conversacionId: abierto.conversacionId, mensajeAgenteId: abierto.mensajeAgenteId };
    const decision = decidirReintento(abierto);
    if (decision === 'turno_en_curso') return this.rechazarApertura(emitir, 'turno_en_curso', 'Ese mensaje todavía se está respondiendo.');
    if (decision === 'retomar') {
      const retomado = await this.conTx(c, (tx) => retomarTurno(tx, abierto.mensajeAgenteId));
      if (!retomado) return this.rechazarApertura(emitir, 'turno_en_curso', 'Ese mensaje todavía se está respondiendo.');
      return { conversacionId: abierto.conversacionId, mensajeAgenteId: abierto.mensajeAgenteId };
    }
    await this.entregarGuardado(c, cuerpo, abierto, decision === 'interrumpir', modelo, emitir);
    return null;
  }

  private rechazarApertura(emitir: Emitir, motivo: 'interno' | 'turno_en_curso', mensaje: string): null {
    emitir({ type: 'error', motivo, mensaje });
    return null;
  }

  /** Un reintento de un turno que ya terminó (o que ya hizo cosas y no debe repetirse): se entrega lo guardado. */
  private async entregarGuardado(c: ContextoDeHerramienta, cuerpo: TurnoDelAgente, previo: Extract<TurnoAbierto, { tipo: 'existente' }>, cerrar: boolean, modelo: string, emitir: Emitir): Promise<void> {
    if (cerrar) {
      await this.conTx(c, (tx) => cerrarTurno(tx, { mensajeId: previo.mensajeAgenteId, conversacionId: previo.conversacionId, estado: 'interrumpido', contenido: previo.contenido, metadatos: { corte: 'error' }, uso: null }));
    }
    emitir({ type: 'inicio', conversacionId: previo.conversacionId, turnoId: cuerpo.turnoId, modelo });
    if (previo.contenido) emitir({ type: 'texto', delta: previo.contenido });
    emitir({ type: 'fin', mensajeId: previo.mensajeAgenteId, estado: cerrar ? 'interrumpido' : 'completo' });
  }

  private async nombreDeLaEmpresa(c: ContextoDeHerramienta, razonSocial: string | null): Promise<string> {
    if (razonSocial) return razonSocial;
    const { rows } = await this.db.auth.query<{ name: string }>('select name from auth.organization where id = $1', [c.empresaId]);
    return rows[0]?.name ?? 'la empresa';
  }

  /** Lo que el prompt y el modelo necesitan, leído en una transacción corta (nunca abierta mientras se espera al modelo). */
  private async leerContexto(c: ContextoDeHerramienta, marcha: Marcha, turnoId: string) {
    const { historial, empresa, moneda, zona, lecciones } = await this.conTx(c, async (tx) => {
      const filas = await tx.execute<{ razon: string | null; moneda: string; zona: string }>(sql`select razon_social as razon, moneda, zona_horaria as zona from core.empresa_config where tenant_id = current_setting('app.tenant_id', true)`);
      const f = filas.rows[0];
      const lecciones = await this.lecciones(tx);
      return { historial: await historialParaElModelo(tx, marcha.conversacionId, turnoId, this.tituloDeConsulta), empresa: f?.razon ?? null, moneda: f?.moneda ?? 'PEN', zona: f?.zona ?? 'America/Lima', lecciones };
    });
    return { historial, moneda, zona, lecciones, empresa: await this.nombreDeLaEmpresa(c, empresa) };
  }

  /** El título de una herramienta si es una consulta (lectura de negocio): lo que va en «[Consulté: …]» del historial. */
  private tituloDeConsulta = (herramienta: string): string | null => {
    const h = this.registro.obtener(herramienta);
    return h?.criticidad === 'lectura' ? h.ayuda.titulo : null;
  };

  private tituloDe = (herramienta: string): string => this.registro.obtener(herramienta)?.ayuda.titulo ?? herramienta;

  /** Anota lo que las personas ya resolvieron de los borradores del asistente y devuelve lo vigente que se le va a mostrar. Un fallo aquí nunca tumba el turno. */
  private async lecciones(tx: Transaccion): Promise<string[]> {
    try {
      // Con punto de guardado: si una consulta de la memoria fallara, la transacción del turno no queda abortada.
      return await conPuntoDeGuardado(tx, async (p) => {
        await capturarLeccionesDeBorradores(p, this.tituloDe);
        const vigentes = await leccionesVigentes(p, MAXIMO_DE_LECCIONES);
        return vigentes.map((l) => l.texto);
      });
    } catch (e) {
      this.logger.error({ tipo: e instanceof Error ? e.name : typeof e }, 'No se pudo leer la memoria del asistente');
      return [];
    }
  }

  /** Lo que el asistente aprendió en este turno: errores que corrigió él mismo. Después de cerrar: nunca afecta al turno. */
  private async aprender(c: ContextoDeHerramienta, r: ResultadoDeTurno): Promise<void> {
    const camposDe = (herramienta: string): ReadonlySet<string> => {
      const h = this.registro.obtener(herramienta);
      return new Set(h ? Object.keys((esquemaParaElModelo(h.nombre, h.entrada).properties as Record<string, unknown> | undefined) ?? {}) : []);
    };
    const nuevas = leccionesDeErroresCorregidos(r.intentos, this.tituloDe, camposDe);
    if (nuevas.length === 0) return;
    try {
      await this.conTx(c, async (tx) => {
        for (const l of nuevas) await guardarLeccion(tx, l);
      });
    } catch (e) {
      this.logger.error({ tipo: e instanceof Error ? e.name : typeof e }, 'No se pudo anotar lo aprendido en el turno');
    }
  }

  private async ejecutarYCerrar(c: ContextoDeHerramienta, cuerpo: TurnoDelAgente, marcha: Marcha, limites: Limites, modelo: string, emitir: Emitir): Promise<void> {
    const { historial, moneda, zona, empresa, lecciones } = await this.leerContexto(c, marcha, cuerpo.turnoId);
    const modo = modoDeEscritura(modelo, escrituraEfectiva(this.config, limites.fila));
    const prompt = armarPrompt({
      empresa, moneda, zona, modo, ahora: new Date(), rol: c.rol, lecciones,
      modulos: c.modulos.filter((m) => m.puedeEntrar && m.codigo !== 'core').map((m) => ({ nombre: this.catalogo.porCodigo(m.codigo)?.nombre ?? m.codigo, puedeEscribir: m.puedeEscribir })),
      pantalla: cuerpo.pantalla ? { nombreDeModulo: (cuerpo.pantalla.modulo && this.catalogo.porCodigo(cuerpo.pantalla.modulo)?.nombre) || null, entidad: cuerpo.pantalla.entidad } : null,
    });
    const resultado = await correrTurno(this.dependencias(c, marcha, cuerpo.turnoId, modelo, emitir, limites), {
      turnoId: cuerpo.turnoId, ctx: c, modelo, modo, pantalla: cuerpo.pantalla ?? null, origen: cuerpo.origen, prompt, historial, mensaje: cuerpo.mensaje,
      maxRondas: this.config.AGENTE_MAX_RONDAS, senal: AbortSignal.timeout(MILISEGUNDOS_POR_TURNO), sesion: marcha.conversacionId,
    });
    try {
      await this.cerrar(c, cuerpo, marcha, modelo, resultado);
      await this.aprender(c, resultado);
    } catch (e) {
      // Si no se pudo cerrar, al menos se deja el gasto: lo ya cobrado por el proveedor cuenta para el tope.
      await this.marcarComoError(c, marcha, { origen: 'agente', turnoId: cuerpo.turnoId, modelo, ...usoPlano(resultado), resultado: 'error' });
      throw e;
    }
    this.anunciarFin(resultado, marcha, modelo, emitir);
  }

  private dependencias(c: ContextoDeHerramienta, marcha: Marcha, turnoId: string, modelo: string, emitir: Emitir, limites: Limites): DependenciasDelBucle {
    const mensajeId = marcha.mensajeAgenteId;
    const tope = this.topeDe(limites.fila);
    const origen = { modelo, conversacionId: marcha.conversacionId, turnoId };
    return {
      modelo: this.modelo,
      registro: this.registro,
      ejecutar: (nombre, args, o) =>
        this.ejecutor.ejecutar(nombre, args, {
          ctx: o.ctx,
          claveDeIdempotencia: o.claveDeIdempotencia,
          ...(o.confirmacion ? { confirmacion: o.confirmacion } : {}),
          // La huella la escribe el ejecutor en la MISMA transacción que la acción: no hay acción sin huella.
          agente: { politica: o.politica, registrarHuella: (tx, d) => escribirHuellaDeAccion(tx, { ...origen, ronda: o.ronda, indice: o.indice, politica: o.politica }, d) },
        }),
      proponer: crearProponerDesdeAgente({ ejecutor: this.ejecutor, db: this.db, conversacionId: marcha.conversacionId, turnoId }),
      huella: {
        aparte: (f) => this.conTx(c, (tx) => escribirHuellaAparte(tx, origen, f)),
        // «La misma operación» se decide por su clave de negocio (herramienta, quién, cuánto y cuándo), sobre argumentos YA validados.
        hayIdentica: async (herramienta, args) => {
          const v = this.ejecutor.validar(herramienta, args, { ...c, canal: 'agente' });
          if (!v.ok) return false;
          const clave = claveDeNegocio(v.datos);
          return this.conTx(c, async (tx) => (await argumentosRecientes(tx, herramienta)).some((x) => claveDeNegocio(x) === clave));
        },
        acumuladoDelDia: () => this.conTx(c, async (tx) => (await argumentosDelDia(tx, [...DINERO, ...CRITICAS_DE_DINERO])).reduce<number>((suma, x) => suma + finito(mayorImporteEnCentimos(x)), 0)),
        hayPropuestaDelSistema: async (herramienta, args) => {
          const v = this.ejecutor.validar(herramienta, args, { ...c, canal: 'agente' });
          return v.ok ? this.conTx(c, (tx) => hayPropuestaPendienteDelSistema(tx, herramienta, v.datos)) : false;
        },
      },
      limitesDeDinero: {
        dineroDirecto: limites.fila?.dineroDirecto ?? true,
        topePorOperacionCentimos: limites.fila?.topePorOperacionCentimos ?? TOPE_POR_OPERACION_POR_OMISION,
        hoy: new Intl.DateTimeFormat('en-CA', { timeZone: limites.zona }).format(new Date()),
      },
      emitir,
      anotar: (clave: ListaDeAnotaciones, elemento: unknown) => this.conTx(c, (tx) => anotarEnLista(tx, mensajeId, clave, elemento)),
      // El tope se mira al entrar y otra vez antes de CADA ronda: lo gastado en las rondas de este turno aún no está en `core.uso`.
      permitirRonda: async (costoDelTurnoMicrousd) => (await this.conTx(c, (tx) => gastoDelMes(tx, new Date(), limites.zona))) + costoDelTurnoMicrousd < tope,
      reloj: () => performance.now(),
    };
  }

  /** Una transacción corta: cierra el mensaje, mueve la conversación y deja el uso (incluso si el turno falló: ya se gastó). */
  private async cerrar(c: ContextoDeHerramienta, cuerpo: TurnoDelAgente, marcha: Marcha, modelo: string, r: ResultadoDeTurno): Promise<void> {
    const estado = r.estado === 'completo' ? 'completo' : r.estado === 'error' ? 'error' : 'interrumpido';
    await this.conTx(c, (tx) =>
      cerrarTurno(tx, {
        mensajeId: marcha.mensajeAgenteId, conversacionId: marcha.conversacionId, estado, contenido: r.texto,
        // Las acciones y borradores ya se anotaron al ocurrir; aquí se repiten completos por si alguna anotación falló.
        metadatos: { modelo, uso: r.uso, pantalla: cuerpo.pantalla ?? null, herramientas: r.herramientas, acciones: r.acciones, borradores: r.borradores, corte: r.corte },
        uso: { origen: 'agente', turnoId: cuerpo.turnoId, modelo, ...usoPlano(r), resultado: estado === 'completo' ? 'ok' : estado === 'error' ? 'error' : 'cortado' },
      }),
    );
  }

  private anunciarFin(r: ResultadoDeTurno, marcha: Marcha, modelo: string, emitir: Emitir): void {
    if (r.motivo) return emitir({ type: 'error', motivo: r.motivo, mensaje: r.mensajeDeError ?? 'El turno no pudo terminar.' });
    emitir({ type: 'uso', modelo, ...r.uso });
    emitir({ type: 'fin', mensajeId: marcha.mensajeAgenteId, estado: r.estado === 'completo' ? 'completo' : 'interrumpido' });
  }
}
