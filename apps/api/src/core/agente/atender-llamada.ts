import { rechazo, type Respuesta } from '@capaz/shared';
import { hashCanonico } from '../herramientas/confirmacion.js';
import { describirHerramienta, mapaDelSoftware } from './atender-meta.js';
import { META_HERRAMIENTA_DESCRIBIR, META_HERRAMIENTA_LLAMAR, META_SOFTWARE_MAPA, META_WEB_BUSCAR, META_WEB_LEER, NOMBRES_DE_META } from './meta-herramientas.js';
import { atenderWeb } from './atender-web.js';
import type { LlamadaDeModelo } from './modelo-de-chat.js';
import { atenderEscritura } from './atender-escritura.js';
import { politicaDe } from './politica.js';
import { objeto } from './registrar-resultado.js';
import { recortar } from './recorte.js';
import type { ContextoDeLlamada } from './tipos-del-turno.js';

// Atiende UNA llamada a herramienta del modelo, siempre por el mismo camino: argumentos → política → ejecutor. Una llamada por
// `herramienta_llamar` se desenvuelve y sigue ese mismo camino: no hay una vía lateral para saltarse la política.

const MENSAJE_PROHIBIDO = 'El asistente no puede usar esa herramienta. Dile a la persona que lo haga ella desde la pantalla correspondiente.';
const TITULO_DE_META: Record<string, string> = { [META_SOFTWARE_MAPA]: 'Revisar qué puedo hacer', [META_HERRAMIENTA_DESCRIBIR]: 'Revisar una herramienta', [META_WEB_BUSCAR]: 'Buscar en internet', [META_WEB_LEER]: 'Leer una página web' };


type Argumentos = { ok: true; valor: unknown } | { ok: false };

/** Si el JSON está roto NO se ejecuta nada: se le dice al modelo que lo reenvíe completo. */
function leerArgumentos(crudo: string): Argumentos {
  try {
    return { ok: true, valor: JSON.parse(crudo.trim() === '' ? '{}' : crudo) };
  } catch {
    return { ok: false };
  }
}

type Destino = { nombre: string; args: unknown } | { error: string };

/** `herramienta_llamar` se desenvuelve: lo que se ejecuta (y se audita) es la herramienta de adentro. */
function destinoDe(nombre: string, args: unknown): Destino {
  if (nombre !== META_HERRAMIENTA_LLAMAR) return { nombre, args };
  const a = objeto(args);
  const interno = typeof a.nombre === 'string' ? a.nombre.trim() : '';
  if (interno === '') return { error: 'Indica el nombre de la herramienta.' };
  if (NOMBRES_DE_META.has(interno)) return { error: 'Una herramienta interna no se llama con herramienta_llamar.' };
  return { nombre: interno, args: a.args ?? {} };
}

const tituloDe = (c: ContextoDeLlamada, nombre: string): string => TITULO_DE_META[nombre] ?? c.dep.registro.obtener(nombre)?.ayuda.titulo ?? nombre;

/** Texto corto para la persona. Nunca lleva datos del resultado. */
function notaDe(r: Respuesta<unknown>): string {
  if (r.ok) {
    const items = objeto(r.datos).items;
    return Array.isArray(items) ? (items.length === 1 ? '1 resultado' : `${items.length} resultados`) : 'listo';
  }
  if ('error' in r && ['sin_permiso', 'modulo_no_disponible', 'modulo_solo_lectura'].includes(r.error.codigo)) return 'sin permiso';
  return 'no se pudo';
}

async function ejecutarNegocio(c: ContextoDeLlamada, nombre: string, args: unknown): Promise<Respuesta<unknown>> {
  const h = c.dep.registro.obtener(nombre);
  if (!h) return rechazo('herramienta_desconocida', `No existe la herramienta «${nombre}».`);
  const politica = politicaDe(h, args, c.entrada.modo);
  if (politica === 'prohibido') {
    // Un intento de hacer lo prohibido es lo que una persona más quiere ver: queda en la huella.
    if (h.criticidad !== 'lectura') await c.dep.huella?.aparte({ ronda: c.ronda, indice: c.indice, herramienta: nombre, politica: 'directo', resultado: 'rechazada', codigo: 'sin_permiso', hashArgs: hashCanonico(args ?? {}), args, resumenConfirmado: 'Lo que el asistente no puede hacer.' }).catch(() => undefined);
    return rechazo('sin_permiso', MENSAJE_PROHIBIDO);
  }
  return atenderEscritura(c, h, args, politica);
}

function resolver(c: ContextoDeLlamada, nombre: string, args: unknown): Promise<Respuesta<unknown>> | Respuesta<unknown> {
  const { registro } = c.dep;
  const { ctx, modo } = c.entrada;
  if (nombre === META_SOFTWARE_MAPA) return mapaDelSoftware(registro.todas(), ctx, modo, args);
  if (nombre === META_HERRAMIENTA_DESCRIBIR) return describirHerramienta(registro.todas(), ctx, modo, args);
  if (nombre === META_WEB_BUSCAR || nombre === META_WEB_LEER) return atenderWeb(c, nombre, args);
  return ejecutarNegocio(c, nombre, args);
}

/** Atiende una llamada y devuelve el texto que se le entrega al modelo como resultado. */
export async function atenderLlamada(c: ContextoDeLlamada, llamada: LlamadaDeModelo): Promise<string> {
  const { id } = llamada;
  const leidos = leerArgumentos(llamada.function.arguments);
  const destino = leidos.ok ? destinoDe(llamada.function.name, leidos.valor) : null;
  const nombre = destino && 'nombre' in destino ? destino.nombre : llamada.function.name;
  c.dep.emitir({ type: 'herramienta_inicio', id, nombre, titulo: tituloDe(c, nombre) });
  let respuesta: Respuesta<unknown>;
  if (!leidos.ok) respuesta = rechazo('argumentos_invalidos', 'Los argumentos no son JSON válido. Vuelve a enviarlos completos.');
  else if (destino && 'error' in destino) respuesta = rechazo('argumentos_invalidos', destino.error);
  else respuesta = await resolver(c, nombre, (destino as { args: unknown }).args);
  c.estado.herramientas.push({ nombre, ok: respuesta.ok });
  if (!NOMBRES_DE_META.has(nombre) && destino && 'args' in destino) c.estado.intentos.push({ nombre, ok: respuesta.ok, codigo: respuesta.ok || !('error' in respuesta) ? null : respuesta.error.codigo, claves: Object.keys(objeto(destino.args)).sort() });
  c.dep.emitir({ type: 'herramienta_fin', id, ok: respuesta.ok, nota: notaDe(respuesta) });
  return recortar(respuesta);
}

