import type { ModoDeEscritura, PantallaDelAgente } from '@capaz/shared';
import type { ContextoDeHerramienta, HerramientaRegistrada } from '../herramientas/tipos.js';
import { esquemaParaElModelo, tokensEstimados } from './esquema-limpio.js';
import { DEFINICIONES_DE_META, DEFINICIONES_WEB } from './meta-herramientas.js';
import { politicaDe } from './politica.js';

// Qué herramientas se le ofrecen al modelo en CADA turno. Las 303 juntas pesan ~41.500 tokens aun limpiando el esquema, y un
// modelo sin evaluar frente a 300 opciones se equivoca más: se ofrece un conjunto chico (lo de siempre + lo de la pantalla) y
// tres meta-herramientas para descubrir y llamar al resto. Lo que la persona no puede usar, el modelo ni lo ve.

/** El tope de tokens de la lista completa (herramientas + meta-herramientas). Una prueba lo vigila. */
export const PRESUPUESTO_DE_TOKENS = 8000;

/** Lo que casi todas las conversaciones necesitan: ver el día, encontrar un cliente o un producto, la bandeja y dictar. */
export const SIEMPRE: readonly string[] = [
  'borradores_listar', 'borradores_resumen', 'captura_proponer', 'clientes_buscar', 'clientes_ver', 'mi_dia_ver', 'precio_anterior_consultar', 'productos_buscar',
];

export type EntradaDelCatalogo = {
  herramientas: readonly HerramientaRegistrada[];
  ctx: ContextoDeHerramienta;
  pantalla: PantallaDelAgente | null;
  modo: ModoDeEscritura;
  /** Se ofrecen la búsqueda y la lectura de páginas. */
  internet?: boolean;
};

type Definicion = { type: 'function'; function: { name: string; description: string; parameters: unknown } };

const definiciones = new WeakMap<HerramientaRegistrada, Definicion>();

/** La definición se arma una vez por herramienta: convertir el esquema de Zod cuesta, y el registro no cambia con el proceso en marcha. */
function definicionDe(h: HerramientaRegistrada): Definicion {
  let d = definiciones.get(h);
  if (!d) {
    d = { type: 'function', function: { name: h.nombre, description: h.ayuda.paraQueSirve, parameters: esquemaParaElModelo(h.nombre, h.entrada) } };
    definiciones.set(h, d);
  }
  return d;
}

/** Las mismas reglas que el ejecutor (`comprobarAcceso`): módulo al que puede entrar, escritura en el módulo y permiso. */
export function puedeUsar(h: HerramientaRegistrada, ctx: ContextoDeHerramienta): boolean {
  const acceso = ctx.modulos.find((m) => m.codigo === h.modulo);
  if (!acceso?.puedeEntrar) return false;
  if (h.criticidad !== 'lectura' && h.modulo !== 'core' && !acceso.puedeEscribir) return false;
  return h.permiso === null || ctx.permisos.includes(h.permiso);
}

const porNombre = (a: HerramientaRegistrada, b: HerramientaRegistrada): number => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0);
const esLectura = (h: HerramientaRegistrada): boolean => h.criticidad === 'lectura';

/** Las que esta persona puede usar y la política deja ofrecer, en orden alfabético. */
export function disponibles(herramientas: readonly HerramientaRegistrada[], ctx: ContextoDeHerramienta, modo: ModoDeEscritura): HerramientaRegistrada[] {
  return herramientas.filter((h) => puedeUsar(h, ctx) && politicaDe(h, {}, modo) !== 'prohibido').sort(porNombre);
}

/** Las de la pantalla: primero las lecturas y después las que cambian cosas, cada grupo alfabético. */
function delModulo(lista: readonly HerramientaRegistrada[], modulo: string | null): HerramientaRegistrada[] {
  if (!modulo) return [];
  const suyas = lista.filter((h) => h.modulo === modulo);
  return [...suyas.filter(esLectura), ...suyas.filter((h) => !esLectura(h))];
}

export function catalogoDelTurno(p: EntradaDelCatalogo): { tools: unknown[]; nombres: string[]; tokens: number } {
  const lista = disponibles(p.herramientas, p.ctx, p.modo);
  const elegidas: HerramientaRegistrada[] = lista.filter((h) => SIEMPRE.includes(h.nombre));
  const yaEstan = new Set(elegidas.map((h) => h.nombre));
  let tokens = tokensEstimados(DEFINICIONES_DE_META) + (p.internet ? tokensEstimados(DEFINICIONES_WEB) : 0) + tokensEstimados(elegidas.map(definicionDe));

  // Lo de la pantalla entra mientras quepa; una herramienta enorme se salta y se sigue con las siguientes.
  for (const h of delModulo(lista, p.pantalla?.modulo ?? null)) {
    if (yaEstan.has(h.nombre)) continue;
    const costo = tokensEstimados(definicionDe(h));
    if (tokens + costo > PRESUPUESTO_DE_TOKENS) continue;
    elegidas.push(h);
    yaEstan.add(h.nombre);
    tokens += costo;
  }
  const tools = [...elegidas.map(definicionDe), ...DEFINICIONES_DE_META, ...(p.internet ? DEFINICIONES_WEB : [])];
  return { tools, nombres: elegidas.map((h) => h.nombre), tokens };
}
