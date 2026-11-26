import type { ConfiguracionDelAgente, ModoDeEscritura, ModeloDelCatalogo } from '@capaz/shared';
import { TOPE_POR_OPERACION_POR_OMISION } from './guardas-de-dinero.js';
import type { ModeloVivo } from './precios-de-modelos.js';

// El catálogo CURADO de modelos que una empresa puede elegir para el asistente. No es «todo lo que haya en OpenRouter»: el
// asistente opera datos reales con herramientas y un modelo que no se evaluó no se ofrece con el mismo aplomo que uno que sí.
// `evaluado` solo pasa a `true` cuando alguien corrió el banco de evaluación (docs/AGENTE-PROMPT-Y-EVALUACION.md §2) y anotó
// aquí el resultado con su fecha. Mientras sea `false`, el modelo solo consulta: no crea, cambia ni mueve nada.

export type ModeloBase = Pick<ModeloDelCatalogo, 'id' | 'nombre' | 'nivel' | 'descripcion' | 'privacidad' | 'evaluado'>;

/** La misma forma que valida la base y la configuración: `proveedor/nombre`. */
export const FORMA_DE_ID_DE_MODELO = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;
export const esIdDeModelo = (x: unknown): x is string => typeof x === 'string' && x.length <= 100 && FORMA_DE_ID_DE_MODELO.test(x);

export const CATALOGO_DE_MODELOS: readonly ModeloBase[] = [
  {
    id: 'deepseek/deepseek-v4.1-flash-1017',
    nombre: 'DeepSeek V4.1 Flash',
    nivel: 'experimental',
    descripcion: 'El más barato y el modelo con el que arranca el asistente. Su fiabilidad con herramientas está sin verificar: revisa la bitácora de lo que hace.',
    privacidad: 'revisar',
    evaluado: false,
  },
  {
    id: 'deepseek/deepseek-v4-pro-0813',
    nombre: 'DeepSeek V4 Pro',
    nivel: 'experimental',
    descripcion: 'Barato, pero en las pruebas del 2026-11-26 falló al crear pedidos: el proveedor le corta la lista de líneas. Para registrar usa otro modelo.',
    privacidad: 'revisar',
    evaluado: false,
  },
  {
    id: 'anthropic/claude-sonnet-5.5',
    nombre: 'Claude Sonnet 5.5',
    nivel: 'recomendado',
    descripcion: 'Equilibrio entre calidad y costo, con buen manejo de herramientas. Sin evaluar con el banco de Capaz: revisa la bitácora de lo que hace.',
    privacidad: 'estandar',
    evaluado: false,
  },
  {
    id: 'anthropic/claude-haiku-5.5',
    nombre: 'Claude Haiku 5.5',
    nivel: 'economico',
    descripcion: 'Rápido y económico, pensado para tareas simples. Sin evaluar: revisa la bitácora de lo que hace.',
    privacidad: 'estandar',
    evaluado: false,
  },
  {
    id: 'anthropic/claude-opus-5.5',
    nombre: 'Claude Opus 5.5',
    nivel: 'premium',
    descripcion: 'La máxima calidad de la familia, para razonamiento difícil. Más caro. Sin evaluar: revisa la bitácora de lo que hace.',
    privacidad: 'estandar',
    evaluado: false,
  },
];

export const buscarModelo = (id: string): ModeloBase | undefined => CATALOGO_DE_MODELOS.find((m) => m.id === id);

/** El modelo del próximo turno: el que eligió la empresa o, si no eligió, el del despliegue. Nunca se guarda en caché. */
export const modeloEfectivo = (config: { AGENTE_MODELO: string }, elegido: string | null): string => (elegido && esIdDeModelo(elegido) ? elegido : config.AGENTE_MODELO);

/**
 * Qué puede cambiar el asistente. Decisión de Moisés (2026-11-24, reemplaza a D7): el asistente actúa desde el primer día, sin
 * esperar a que un modelo esté «evaluado»; fallar por exceso y pulir con la bitácora. La empresa tiene un freno: con la escritura
 * directa apagada todo cambio queda como borrador. `evaluado` es solo una etiqueta informativa. El modo `ninguna` ya no se usa.
 */
export function modoDeEscritura(_modelo: string, escrituraDirecta: boolean): ModoDeEscritura {
  return escrituraDirecta ? 'directa' : 'borradores';
}

/** La escritura que rige de verdad: la de la empresa (activa si nunca la tocó) y el freno global del despliegue (`AGENTE_ESCRITURA`). */
export const escrituraEfectiva = (config: { AGENTE_ESCRITURA: 'activa' | 'apagada' }, fila: { escrituraDirecta: boolean } | null): boolean =>
  config.AGENTE_ESCRITURA === 'activa' && (fila?.escrituraDirecta ?? true);

/** Un modelo fuera del catálogo debe caber el prompt del asistente (~30k tokens) con holgura. */
export const CONTEXTO_MINIMO = 100_000;

export type Eleccion = { ok: true } | { ok: false; error: string };

/**
 * ¿Se puede elegir este modelo? `vivos` es la lista actual del proveedor, o `null` si no se pudo leer. Uno del catálogo se acepta
 * aunque el proveedor no conteste (que la lista de precios esté caída no debe impedir cambiar de modelo); pero si el proveedor SÍ
 * contestó y el modelo ya no está o no admite herramientas, se rechaza: un asistente sin herramientas es un chat que finge operar.
 */
export function validarEleccion(id: unknown, vivos: readonly ModeloVivo[] | null): Eleccion {
  if (!esIdDeModelo(id)) return { ok: false, error: 'Ese modelo no es válido: debe tener la forma «proveedor/nombre».' };
  const vivo = vivos?.find((m) => m.id === id);
  if (vivos && !vivo) return { ok: false, error: 'El proveedor ya no ofrece ese modelo: elige otro.' };
  if (vivo && !vivo.admiteHerramientas) return { ok: false, error: 'Ese modelo no admite herramientas, y el asistente las necesita para operar.' };
  if (buscarModelo(id)) return { ok: true };
  if (!vivos) return { ok: false, error: 'No se pudo comprobar ese modelo ahora mismo. Elige uno de la lista o inténtalo en unos minutos.' };
  if ((vivo?.contexto ?? 0) < CONTEXTO_MINIMO) return { ok: false, error: `Ese modelo tiene un contexto de menos de ${CONTEXTO_MINIMO / 1000}k tokens: el asistente no cabe.` };
  return { ok: true };
}

/** El catálogo con lo que el proveedor dice hoy. Sin la lista (`null`) sale sin precios y todo figura disponible. */
export function catalogoConPrecios(vivos: readonly ModeloVivo[] | null): ModeloDelCatalogo[] {
  return CATALOGO_DE_MODELOS.map((m) => {
    const vivo = vivos?.find((v) => v.id === m.id);
    return {
      ...m,
      disponible: vivos ? vivo !== undefined && vivo.admiteHerramientas : true,
      entradaMicrousdPorMillon: vivo?.entradaMicrousdPorMillon ?? null,
      salidaMicrousdPorMillon: vivo?.salidaMicrousdPorMillon ?? null,
    };
  });
}

type FilaDeConfiguracion = { modelo: string | null; topeMensualMicrousd: number | null; escrituraDirecta: boolean; dineroDirecto: boolean; topePorOperacionCentimos: number | null; internet: boolean } | null;

/** Lo que la empresa tiene hoy: lo que eligió y lo que realmente rige (si no eligió, el del despliegue). */
export function configuracionDe(config: { AGENTE_MODELO: string; AGENTE_TOPE_MENSUAL_USD: number }, fila: FilaDeConfiguracion, gastoDelMesMicrousd: number): ConfiguracionDelAgente {
  const tope = fila?.topeMensualMicrousd ?? null;
  return {
    modelo: fila?.modelo ?? null,
    modeloEfectivo: modeloEfectivo(config, fila?.modelo ?? null),
    topeMensualMicrousd: tope,
    topeEfectivoMicrousd: tope ?? Math.round(config.AGENTE_TOPE_MENSUAL_USD * 1_000_000),
    escrituraDirecta: fila?.escrituraDirecta ?? true,
    dineroDirecto: fila?.dineroDirecto ?? true,
    topePorOperacionCentimos: fila?.topePorOperacionCentimos ?? TOPE_POR_OPERACION_POR_OMISION,
    internet: fila?.internet ?? true,
    gastoDelMesMicrousd,
  };
}
