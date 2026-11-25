import type { UsoDelTurno } from '@capaz/shared';
import { atenderLlamada } from './atender-llamada.js';
import { catalogoDelTurno } from './catalogo-del-turno.js';
import { ErrorDeModelo, type LlamadaDeModelo, type MensajeDeModelo, type TrozoDeModelo, type UsoDeRonda } from './modelo-de-chat.js';
import type { DependenciasDelBucle, EntradaDelBucle, EstadoDelTurno, ResultadoDeTurno } from './tipos-del-turno.js';

// El turno del asistente: hasta `maxRondas` vueltas de «el modelo responde → si pide herramientas, se atienden de a una y sus
// resultados vuelven al modelo». Ninguna transacción se abre aquí: el modelo tarda segundos y la conexión a la base es escasa.
// Todo lo externo entra por `DependenciasDelBucle`.

/** Un modelo que pide decenas de llamadas en una sola ronda es un error o un abuso: se atienden las primeras. */
export const MAXIMO_DE_LLAMADAS_POR_RONDA = 12;
export const AVISO_DE_RONDAS = '\n\n[Llegué al máximo de pasos de este turno antes de poder contestarte. Lo que ya se hizo quedó hecho; escríbeme «continúa» y sigo sin repetirlo.]';
export const AVISO_DE_TOPE = '\n\n[Se alcanzó el tope de uso de este mes. Dejo aquí la respuesta; lo que ya se hizo quedó hecho.]';
export const AVISO_DE_LARGO = '\n\n[La respuesta se cortó por largo. Pídemelo en pasos más chicos.]';
const SOBRAN_LLAMADAS = 'Demasiadas llamadas a la vez. Pide menos herramientas por turno.';

type FinDeRonda = Extract<TrozoDeModelo, { tipo: 'fin' }>;
type Mensajes = MensajeDeModelo[];

const estadoInicial = (): EstadoDelTurno => ({
  texto: '', corte: null, uso: { entrada: 0, salida: 0, cache: 0, costoMicrousd: 0, rondas: 0 }, herramientas: [], acciones: [], borradores: [], intentos: [],
  escrituras: 0, escriturasDeDinero: 0, vistas: new Set(), confirmaciones: new Map(),
});

/** El prefijo fijo va primero y solo (se cachea entre turnos); lo que cambia con la hora y la pantalla va después. */
function mensajesIniciales(e: EntradaDelBucle): Mensajes {
  return [
    { role: 'system', content: e.prompt.fijo },
    { role: 'system', content: e.prompt.variable },
    ...e.historial.map((m): MensajeDeModelo => ({ role: m.role, content: m.content })),
    { role: 'user', content: e.mensaje },
  ];
}

/**
 * Un JSON roto no se le devuelve al proveedor en el historial de la ronda: un proveedor estricto respondería 400 y mataría el turno.
 * La llamada se atiende igual con los argumentos originales (y falla con un aviso para que el modelo la reenvíe completa).
 */
function argumentosSeguros(l: LlamadaDeModelo): LlamadaDeModelo {
  try {
    JSON.parse(l.function.arguments);
    return l;
  } catch {
    return { ...l, function: { ...l.function, arguments: '{}' } };
  }
}

function sumarUso(est: EstadoDelTurno, u: UsoDeRonda | null): void {
  est.uso.rondas += 1;
  if (!u) return;
  est.uso.entrada += u.entrada;
  est.uso.salida += u.salida;
  est.uso.cache += u.cache;
  est.uso.costoMicrousd += u.costoMicrousd;
}

/** Una vuelta al modelo: el texto va saliendo a medida que llega. Sin `fin` (el flujo se cortó) se trata como error. */
async function unaRonda(dep: DependenciasDelBucle, e: EntradaDelBucle, est: EstadoDelTurno, mensajes: Mensajes, tools: unknown[]): Promise<{ texto: string; fin: FinDeRonda }> {
  let texto = '';
  let fin: FinDeRonda | null = null;
  for await (const t of dep.modelo.conversar({ modelo: e.modelo, mensajes, herramientas: tools, senal: e.senal, sesion: e.sesion })) {
    if (t.tipo === 'texto') {
      // Lo que dice en una ronda nueva no se pega a lo de la anterior («cliente.Ninguna»): entre rondas va un párrafo aparte.
      const separador = texto === '' && est.texto !== '' && !est.texto.endsWith('\n') ? '\n\n' : '';
      texto += t.delta;
      est.texto += separador + t.delta;
      dep.emitir({ type: 'texto', delta: separador + t.delta });
    } else fin = t;
  }
  const cierre = fin ?? { tipo: 'fin' as const, motivo: 'error' as const, llamadas: [], razonamiento: null, uso: null };
  sumarUso(est, cierre.uso);
  return { texto, fin: cierre };
}

function avisar(dep: DependenciasDelBucle, est: EstadoDelTurno, aviso: string): void {
  est.texto += aviso;
  dep.emitir({ type: 'texto', delta: aviso });
}

/** Las llamadas de una ronda, de a una y en orden. Cada resultado vuelve al modelo como mensaje `tool`. */
async function atenderLlamadas(dep: DependenciasDelBucle, e: EntradaDelBucle, est: EstadoDelTurno, mensajes: Mensajes, ronda: number, llamadas: LlamadaDeModelo[]): Promise<void> {
  for (const [indice, llamada] of llamadas.entries()) {
    if (e.senal.aborted) throw new ErrorDeModelo('tiempo_agotado', 'Se agotó el tiempo del turno.');
    const resultado =
      indice >= MAXIMO_DE_LLAMADAS_POR_RONDA
        ? JSON.stringify({ ok: false, error: { codigo: 'argumentos_invalidos', mensaje: SOBRAN_LLAMADAS } })
        : await atenderLlamada({ dep, entrada: e, estado: est, ronda, indice }, llamada);
    mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: resultado });
  }
}

/** Devuelve `true` si el turno terminó normalmente (el modelo contestó sin pedir más herramientas). */
async function rondas(dep: DependenciasDelBucle, e: EntradaDelBucle, est: EstadoDelTurno): Promise<void> {
  const { tools } = catalogoDelTurno({ herramientas: dep.registro.todas(), ctx: e.ctx, pantalla: e.pantalla, modo: e.modo });
  const mensajes = mensajesIniciales(e);
  for (let ronda = 1; ronda <= e.maxRondas; ronda++) {
    if (ronda > 1 && !(await dep.permitirRonda(est.uso.costoMicrousd))) {
      est.corte = 'tope';
      return avisar(dep, est, AVISO_DE_TOPE);
    }
    const { texto, fin } = await unaRonda(dep, e, est, mensajes, tools);
    if (fin.motivo === 'error') throw new ErrorDeModelo('modelo_no_disponible', 'El modelo no pudo terminar la respuesta.');
    if (fin.motivo === 'length') {
      // Con el corte, los argumentos de las llamadas están a medias: ejecutarlas daría errores falsos. Se descartan.
      est.corte = 'error';
      return avisar(dep, est, AVISO_DE_LARGO);
    }
    if (fin.llamadas.length === 0) return;
    mensajes.push({ role: 'assistant', content: texto === '' ? null : texto, tool_calls: fin.llamadas.map(argumentosSeguros), ...(fin.razonamiento ? { reasoning_details: fin.razonamiento } : {}) });
    await atenderLlamadas(dep, e, est, mensajes, ronda, fin.llamadas);
    if (ronda === e.maxRondas) {
      est.corte = 'rondas';
      return avisar(dep, est, AVISO_DE_RONDAS);
    }
  }
}

function usoDelTurno(est: EstadoDelTurno, duracionMs: number): UsoDelTurno {
  return { tokensEntrada: est.uso.entrada, tokensSalida: est.uso.salida, tokensCache: est.uso.cache, costoMicrousd: est.uso.costoMicrousd, rondas: est.uso.rondas, duracionMs: Math.round(duracionMs) };
}

function resultadoFinal(est: EstadoDelTurno, duracionMs: number, falla: { estado: ResultadoDeTurno['estado']; motivo: ResultadoDeTurno['motivo']; mensaje: string | null } | null): ResultadoDeTurno {
  const estado = falla?.estado ?? (est.corte ? 'interrumpido' : 'completo');
  return {
    texto: est.texto, estado, corte: est.corte, motivo: falla?.motivo ?? null, mensajeDeError: falla?.mensaje ?? null,
    uso: usoDelTurno(est, duracionMs), herramientas: est.herramientas, acciones: est.acciones, borradores: est.borradores, intentos: est.intentos,
  };
}

/** Cómo termina un turno que falló: un tiempo agotado deja lo ya dicho como interrumpido; cualquier otra cosa es un error. */
function comoFalla(err: unknown, est: EstadoDelTurno): { estado: ResultadoDeTurno['estado']; motivo: ResultadoDeTurno['motivo']; mensaje: string | null } {
  if (err instanceof ErrorDeModelo && (err.motivo === 'tiempo_agotado' || err.motivo === 'cancelado')) {
    est.corte = 'tiempo';
    return { estado: 'interrumpido', motivo: 'tiempo_agotado', mensaje: err.message };
  }
  est.corte = 'error';
  if (err instanceof ErrorDeModelo) return { estado: 'error', motivo: err.motivo === 'modelo_no_disponible' ? 'modelo_no_disponible' : 'interno', mensaje: err.message };
  return { estado: 'error', motivo: 'interno', mensaje: 'Ocurrió un error inesperado.' };
}

export async function correrTurno(dep: DependenciasDelBucle, entrada: EntradaDelBucle): Promise<ResultadoDeTurno> {
  const inicio = dep.reloj();
  const est = estadoInicial();
  try {
    await rondas(dep, entrada, est);
    return resultadoFinal(est, dep.reloj() - inicio, null);
  } catch (err) {
    return resultadoFinal(est, dep.reloj() - inicio, comoFalla(err, est));
  }
}
