/**
 * Catalogo contable de la imprenta.
 *
 * DEBE coincidir exactamente con public.categorias_validas() en
 * supabase/migrations/005_proformas_y_categorias.sql. Si agregas una aqui,
 * agregala alla: la BD tiene un check y rechazara cualquier valor ajeno.
 *
 * El catalogo es cerrado a proposito. Con categorias libres terminas con
 * "papel", "papeles" y "Papel" como tres cosas distintas y los reportes
 * dejan de cuadrar.
 */

export const CATEGORIAS_EGRESO = [
  'materia_prima',
  'insumos',
  'acabados_terceros',
  'mano_obra',
  'maquinaria',
  'servicios',
  'local',
  'transporte',
  'impuestos',
  'otros_egresos',
] as const

export const CATEGORIAS_INGRESO = [
  'impresion_offset',
  'impresion_digital',
  'gran_formato',
  'acabados',
  'diseno',
  'otros_ingresos',
] as const

export type CategoriaEgreso = (typeof CATEGORIAS_EGRESO)[number]
export type CategoriaIngreso = (typeof CATEGORIAS_INGRESO)[number]
export type Categoria = CategoriaEgreso | CategoriaIngreso

/** Marcador de UI para lo que aun no se clasifica. En la BD es NULL. */
export const SIN_CATEGORIA = 'sin_categoria'

export interface CategoriaInfo {
  /** Como se le muestra al usuario */
  label: string
  /** Ejemplos concretos del rubro, para el selector y para el LLM */
  ejemplos: string
  /** Clases de Tailwind para el chip de la categoria */
  color: string
}

export const CATEGORIAS: Record<Categoria, CategoriaInfo> = {
  // ---------- Egresos ----------
  materia_prima: {
    label: 'Materia prima',
    ejemplos: 'papel, cartulina, couché, folcote, bond',
    color: 'bg-orange-100 text-orange-800',
  },
  insumos: {
    label: 'Insumos',
    ejemplos: 'tintas, planchas, químicos, barniz, solventes',
    color: 'bg-violet-100 text-violet-800',
  },
  acabados_terceros: {
    label: 'Acabados de terceros',
    ejemplos: 'plastificado, troquelado, encuadernación tercerizada',
    color: 'bg-fuchsia-100 text-fuchsia-800',
  },
  mano_obra: {
    label: 'Mano de obra',
    ejemplos: 'sueldos, destajo, practicantes',
    color: 'bg-blue-100 text-blue-800',
  },
  maquinaria: {
    label: 'Maquinaria',
    ejemplos: 'repuestos, mantenimiento, alquiler de equipo',
    color: 'bg-slate-200 text-slate-800',
  },
  servicios: {
    label: 'Servicios',
    ejemplos: 'luz, agua, internet, teléfono',
    color: 'bg-cyan-100 text-cyan-800',
  },
  local: {
    label: 'Local',
    ejemplos: 'alquiler, arbitrios, mantenimiento del taller',
    color: 'bg-amber-100 text-amber-800',
  },
  transporte: {
    label: 'Transporte',
    ejemplos: 'movilidad, envíos, combustible',
    color: 'bg-lime-100 text-lime-800',
  },
  impuestos: {
    label: 'Impuestos',
    ejemplos: 'SUNAT, tributos, arbitrios municipales',
    color: 'bg-red-100 text-red-800',
  },
  otros_egresos: {
    label: 'Otros egresos',
    ejemplos: 'cualquier gasto que no encaje arriba',
    color: 'bg-neutral-200 text-neutral-700',
  },

  // ---------- Ingresos ----------
  impresion_offset: {
    label: 'Impresión offset',
    ejemplos: 'millares de volantes, afiches, revistas',
    color: 'bg-emerald-100 text-emerald-800',
  },
  impresion_digital: {
    label: 'Impresión digital',
    ejemplos: 'tarjetas, tirajes cortos, full color',
    color: 'bg-teal-100 text-teal-800',
  },
  gran_formato: {
    label: 'Gran formato',
    ejemplos: 'gigantografías, banners, vinilos, roll ups',
    color: 'bg-sky-100 text-sky-800',
  },
  acabados: {
    label: 'Acabados',
    ejemplos: 'anillados, empastados, troquelados que vendes',
    color: 'bg-indigo-100 text-indigo-800',
  },
  diseno: {
    label: 'Diseño',
    ejemplos: 'diagramación, logos, arte final',
    color: 'bg-purple-100 text-purple-800',
  },
  otros_ingresos: {
    label: 'Otros ingresos',
    ejemplos: 'cualquier venta que no encaje arriba',
    color: 'bg-neutral-200 text-neutral-700',
  },
}

/** Las categorias que aplican a un movimiento, segun sea plata que entra o sale. */
export function categoriasPara(tipo: 'ingreso' | 'egreso'): readonly Categoria[] {
  return tipo === 'egreso' ? CATEGORIAS_EGRESO : CATEGORIAS_INGRESO
}

export function esCategoriaValida(valor: unknown): valor is Categoria {
  return typeof valor === 'string' && valor in CATEGORIAS
}

/**
 * Valida que la categoria corresponda al tipo de movimiento.
 * Evita el error silencioso de clasificar una compra como "impresión offset".
 */
export function categoriaCoincideConTipo(
  categoria: Categoria,
  tipo: 'ingreso' | 'egreso'
): boolean {
  return (categoriasPara(tipo) as readonly string[]).includes(categoria)
}

/** Nombre legible. Acepta null/desconocido sin reventar. */
export function etiquetaCategoria(categoria: string | null | undefined): string {
  if (!categoria || categoria === SIN_CATEGORIA) return 'Sin clasificar'
  return esCategoriaValida(categoria) ? CATEGORIAS[categoria].label : 'Sin clasificar'
}

export function colorCategoria(categoria: string | null | undefined): string {
  if (!categoria || !esCategoriaValida(categoria)) return 'bg-neutral-200 text-neutral-700'
  return CATEGORIAS[categoria].color
}
