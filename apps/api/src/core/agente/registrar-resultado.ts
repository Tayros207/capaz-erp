import { propuestaDeCapturaSchema } from '@capaz/shared';
import type { HerramientaRegistrada } from '../herramientas/tipos.js';
import { HERRAMIENTAS_CON_ORIGEN_FIJO } from './esquema-limpio.js';
import type { ContextoDeLlamada } from './tipos-del-turno.js';

// Lo que se anota cuando una llamada del asistente termina: los borradores que dejó, las acciones que hizo y los argumentos que el
// servidor completa porque el modelo no los manda.

export const objeto = (x: unknown): Record<string, unknown> => (x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

/** Lo que el modelo no manda: el origen real del dictado y de las herramientas que lo registran. */
export function completarArgumentos(nombre: string, args: unknown, origen: 'texto' | 'voz', mensaje = ''): unknown {
  if (HERRAMIENTAS_CON_ORIGEN_FIJO.has(nombre)) return { ...objeto(args), origen: 'agente' };
  if (nombre === 'memoria_anotar') {
    const a = objeto(args);
    // Lo que mande el modelo en `citaVerificada` se ignora: el servidor comprueba que la cita sea de verdad palabra de la persona.
    return { ...a, citaVerificada: citaEsDeLaPersona(a.cita, mensaje, a.texto) };
  }
  if (nombre === 'captura_proponer') return { modulo: 'registro', ...objeto(args), origen, transcurridoMs: 0 };
  return sinOrigenInventado(args);
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El origen de un documento es el id de OTRO documento y sirve para no duplicar. Un modelo que inventa uno («chat», «asistente»)
 * haría que el segundo pedido devolviera el primero sin crear nada: si no es un id de verdad, no viaja.
 */
function sinOrigenInventado(args: unknown): unknown {
  const a = objeto(args);
  if (a.origenTipo === undefined || a.origenId === undefined || (typeof a.origenId === 'string' && ID.test(a.origenId))) return args;
  const { origenTipo: _tipo, origenId: _id, ...resto } = a;
  return resto;
}

const normalizar = (t: string): string => t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
/** La raíz de una palabra (sus 4 primeras letras): «cobro» y «cobra» cuentan como la misma. Las palabras cortas no prueban nada. */
const raices = (t: string): string[] => normalizar(t).split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 4).map((p) => p.slice(0, 4));

const PALABRAS_MINIMAS_DE_LA_CITA = 3;
const PARTE_DEL_TEXTO_EN_EL_MENSAJE = 0.6;

/**
 * ¿La lección sale de lo que la persona dijo? Tres comprobaciones del servidor: la cita aparece tal cual en SU mensaje de este turno, tiene
 * al menos 3 palabras (una cita corta como «para» no prueba nada) y el texto de la lección se apoya en lo que ella dijo (al menos el 60 %
 * de sus palabras están en el mensaje). Así el modelo no puede colar una instrucción propia con una cita cualquiera.
 */
export function citaEsDeLaPersona(cita: unknown, mensaje: string, texto?: unknown): boolean {
  if (typeof cita !== 'string' || typeof texto !== 'string') return false;
  const c = normalizar(cita);
  if (c.split(' ').length < PALABRAS_MINIMAS_DE_LA_CITA || !normalizar(mensaje).includes(c)) return false;
  const delTexto = raices(texto);
  if (delTexto.length === 0) return false;
  const enElMensaje = new Set(raices(mensaje));
  return delTexto.filter((r) => enElMensaje.has(r)).length / delTexto.length >= PARTE_DEL_TEXTO_EN_EL_MENSAJE;
}

export async function registrarBorradores(c: ContextoDeLlamada, datos: unknown): Promise<void> {
  const lista = objeto(datos).borradores;
  for (const crudo of Array.isArray(lista) ? lista : []) {
    const p = propuestaDeCapturaSchema.safeParse(crudo);
    if (!p.success) continue;
    const critica = c.dep.registro.obtener(p.data.herramienta)?.criticidad === 'critica';
    const anotado = { id: p.data.id, herramienta: p.data.herramienta, resumen: p.data.resumen, critica };
    c.estado.borradores.push(anotado);
    await c.dep.anotar('borradores', anotado);
    c.dep.emitir({ type: 'borrador', borrador: p.data, critica });
  }
}

export async function registrarResultado(c: ContextoDeLlamada, h: HerramientaRegistrada, datos: unknown): Promise<void> {
  if (h.nombre === 'captura_proponer') return registrarBorradores(c, datos);
  if (h.criticidad === 'lectura') return;
  const id = objeto(datos).id;
  const accion = { herramienta: h.nombre, titulo: h.ayuda.titulo, entidadTipo: h.nombre.split('_')[0] ?? null, entidadId: typeof id === 'string' ? id : null };
  c.estado.acciones.push(accion);
  await c.dep.anotar('acciones', accion);
  c.dep.emitir({ type: 'accion', ...accion });
}

