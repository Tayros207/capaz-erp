import { exito, rechazo, type Respuesta } from '@capaz/shared';
import type { ContextoDeHerramienta, HerramientaRegistrada } from '../herramientas/tipos.js';
import { disponibles } from './catalogo-del-turno.js';
import { esquemaParaElModelo } from './esquema-limpio.js';
import type { ModoDeEscritura } from '@capaz/shared';
import { flujosDeLaHerramienta, flujosDelModulo } from './guia-del-erp.js';
import { politicaDe, type Politica } from './politica.js';

// Lo que responden `software_mapa` y `herramienta_describir`. Solo hablan de lo que ESTA persona puede usar con la política
// de este turno: lo demás no existe para el modelo (y tampoco se le confirma que exista).

const comoTexto = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() !== '' ? x.trim() : undefined);
const objeto = (x: unknown): Record<string, unknown> => (x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

export function mapaDelSoftware(herramientas: readonly HerramientaRegistrada[], ctx: ContextoDeHerramienta, modo: ModoDeEscritura, argumentos: unknown): Respuesta<unknown> {
  const lista = disponibles(herramientas, ctx, modo);
  const modulo = comoTexto(objeto(argumentos).modulo);
  if (!modulo) {
    const areas = new Map<string, string[]>();
    for (const h of lista) areas.set(h.modulo, [...(areas.get(h.modulo) ?? []), h.nombre]);
    return exito({ areas: [...areas.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([m, nombres]) => ({ modulo: m, herramientas: nombres })) });
  }
  const deEsa = lista.filter((h) => h.modulo === modulo);
  if (deEsa.length === 0) {
    const areas = [...new Set(lista.map((h) => h.modulo))].sort().join(', ');
    return rechazo('no_encontrado', `No hay herramientas disponibles en «${modulo}» para esta persona. Las áreas disponibles son: ${areas}.`);
  }
  const flujos = flujosDelModulo(modulo).map((f) => ({ cuando: f.cuando, efecto: f.efecto }));
  return exito({ modulo, herramientas: deEsa.map((h) => ({ nombre: h.nombre, paraQueSirve: h.ayuda.paraQueSirve, cambiaDatos: h.criticidad !== 'lectura' })), ...(flujos.length > 0 && { flujosEntreAreas: flujos }) });
}

export function describirHerramienta(herramientas: readonly HerramientaRegistrada[], ctx: ContextoDeHerramienta, modo: ModoDeEscritura, argumentos: unknown): Respuesta<unknown> {
  const nombre = comoTexto(objeto(argumentos).nombre);
  if (!nombre) return rechazo('argumentos_invalidos', 'Indica el nombre de la herramienta.');
  const h = disponibles(herramientas, ctx, modo).find((x) => x.nombre === nombre);
  // El mismo mensaje exista o no: no se confirma que una herramienta a la que no tiene acceso existe.
  if (!h) return rechazo('no_encontrado', `No encontré la herramienta «${nombre}» o no tienes acceso a ella.`);
  return exito({
    nombre: h.nombre,
    titulo: h.ayuda.titulo,
    paraQueSirve: h.ayuda.paraQueSirve,
    cuandoUsarla: h.ayuda.cuandoUsarla,
    ejemploTecleado: h.ayuda.ejemploTecleado,
    erroresComunes: h.ayuda.erroresComunes,
    cambiaDatos: h.criticidad !== 'lectura',
    queHaceElAsistente: queHaceElAsistente(politicaDe(h, {}, modo)),
    ...(h.ayuda.relacionadas && h.ayuda.relacionadas.length > 0 && { relacionadas: h.ayuda.relacionadas }),
    ...(flujosDeLaHerramienta(h.nombre).length > 0 && { alUsarlaEnElSistema: flujosDeLaHerramienta(h.nombre).map((f) => f.efecto) }),
    argumentos: esquemaParaElModelo(h.nombre, h.entrada),
  });
}

/** Cómo se comporta el asistente con esta herramienta: lo decide el código, no el modelo; aquí solo se le explica. */
function queHaceElAsistente(p: Politica): string {
  if (p === 'directo') return 'La haces tú al momento y queda anotada en la bitácora del asistente.';
  if (p === 'dinero') return 'La haces tú si cumple las guardas de dinero (hasta el tope por operación, con la fecha de hoy, sin repetir una igual); si no, queda como borrador para que una persona la apruebe.';
  if (p === 'confirmada') return 'Es crítica: la primera llamada solo pide confirmación; si la persona de verdad lo quiere, repites exactamente la misma llamada en tu siguiente paso.';
  if (p === 'borrador') return 'Queda como borrador para que una persona la apruebe: no digas que está hecha.';
  return 'No puedes hacerla: explícale a la persona qué pantalla la hace.';
}
