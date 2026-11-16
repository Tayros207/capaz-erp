import { z } from 'zod'
import { esMenor } from './dinero.js'
import {
  costoUnitarioSchema,
  medidaSchema,
  porcentajeSchema,
  soloSiNoHayErrores,
} from './esquemas-decimales.js'
import { BASES_DE_UTILIDAD, ESCALAS, FACTORES } from './dominio.js'
import { dimensionesSchema, etapaDeMermaSchema } from './medidas.js'

/** `Intl` lanza con una etiqueta mal formada («es_PE»): un idioma así tumbaría cada pantalla que formatea. */
function esLocaleValido(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale).length === 1
  } catch {
    return false
  }
}

// Los datos que cambian de una empresa a otra (docs/PLANOS-DE-CONSTRUCCION.md §4). Ningún módulo
// trae constantes de un taller: moneda, idioma, utilidad, umbrales, unidades y tarifas llegan de aquí.

/** Hacia arriba, al múltiplo de 1, 5 o 10 (PRP-005): el precio de lista de una cotización rápida sale «redondo». */
export const REDONDEOS_COMERCIALES = ['ninguno', '1', '5', '10'] as const
export type RedondeoComercial = (typeof REDONDEOS_COMERCIALES)[number]

const textoDeCondicion = z.string().trim().max(300)

/**
 * Condiciones comerciales de la empresa (PRP-005): salen en el PDF y en la página pública de toda
 * cotización emitida y se congelan con ella. Un campo vacío no se muestra.
 */
export const condicionesSchema = z.strictObject({
  /** Días de validez de la oferta desde la emisión; `null` = no se indica. */
  validezDias: z.number().int().min(1).max(365).nullable(),
  plazoEntrega: textoDeCondicion,
  formaPago: textoDeCondicion,
  tolerancia: textoDeCondicion,
  noIncluye: textoDeCondicion,
})
export type CondicionesComerciales = z.infer<typeof condicionesSchema>
export const CONDICIONES_VACIAS: CondicionesComerciales = { validezDias: null, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' }

/** Los campos de `configuracion_empresa`, compartidos por la configuración completa y por el cambio parcial. */
const camposDeConfiguracion = {
  pais: z.string().length(2, { error: 'El país es un código de 2 letras.' }),
  moneda: z.string().regex(/^[A-Z]{3}$/, { error: 'La moneda es un código de 3 letras mayúsculas, como USD.' }),
  locale: z.string().trim().min(2).max(20).refine(esLocaleValido, { error: 'El idioma no es válido: se escribe como es-AR.' }),
  impuestoNombre: z.string().trim().min(1).max(20),
  impuestoPct: porcentajeSchema,
  utilidadPct: porcentajeSchema,
  utilidadBase: z.enum(BASES_DE_UTILIDAD),
  umbralVerdePct: porcentajeSchema,
  umbralMinimoPct: porcentajeSchema,
  unidades: z.array(z.string().trim().min(1).max(20)).min(1).max(40),
  redondeoComercial: z.enum(REDONDEOS_COMERCIALES),
  condiciones: condicionesSchema,
  /** Si el pie de la cotización (PDF y enlace) lleva la firma del desarrollador. La empresa puede quitarla. */
  mostrarFirma: z.boolean(),
  /** Plantilla del envío por WhatsApp (PRP-003 Fase 4): `{enlace}` se reemplaza por la URL pública. */
  mensajeWhatsapp: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((m) => m.includes('{enlace}'), { error: 'El mensaje debe incluir {enlace}: ahí se pone el enlace de la cotización.' }),
}

/** Tabla `configuracion_empresa`. Los umbrales tienen los mismos nombres que usa el motor de costeo. */
export const configuracionEmpresaSchema = z
  .strictObject(camposDeConfiguracion)
  .refine((c) => esMenor(c.umbralMinimoPct, c.umbralVerdePct), {
    error: 'El umbral verde debe ser mayor que el mínimo.',
    path: ['umbralVerdePct'],
    ...soloSiNoHayErrores,
  })
  .refine((c) => c.utilidadBase === 'costo' || esMenor(c.utilidadPct, '100'), {
    error: 'Con utilidad sobre la venta, el porcentaje debe ser menor que 100.',
    path: ['utilidadPct'],
    ...soloSiNoHayErrores,
  })
export type ConfiguracionEmpresa = z.infer<typeof configuracionEmpresaSchema>

/**
 * Lo que una actualización cambia: cualquier parte de la configuración, no toda. Así dos cambios de
 * campos distintos no se pisan aunque uno parta de una copia vieja. Las reglas entre campos (verde
 * mayor que el mínimo) se comprueban sobre el resultado ya fusionado, no aquí.
 */
export const cambioDeConfiguracionSchema = z
  .strictObject(camposDeConfiguracion)
  .partial()
  .refine((c) => Object.keys(c).length > 0, { error: 'Indica al menos un dato que cambiar.' })
export type CambioDeConfiguracion = z.infer<typeof cambioDeConfiguracionSchema>

/** Lo que una pantalla necesita de la configuración para mostrar y leer números: nada de costos. */
export type PreferenciasDeEmpresa = Pick<ConfiguracionEmpresa, 'moneda' | 'locale' | 'unidades' | 'mensajeWhatsapp'>

/** Tabla `insumos_tarifas`: una fila que se puede agregar al cuadro; el costo se COPIA al agregarla. */
export const insumoTarifaSchema = z.strictObject({
  id: z.string().min(1).max(64),
  factor: z.enum(FACTORES),
  nombre: z.string().trim().min(1).max(120),
  unidad: z.string().trim().min(1).max(20),
  costoUnitario: costoUnitarioSchema,
  escalaPorDefecto: z.enum(ESCALAS),
  activo: z.boolean(),
})
export type InsumoTarifa = z.infer<typeof insumoTarifaSchema>

/** Cuántos ítems del cuadro puede guardar una empresa. */
export const MAX_ITEMS_DE_EMPRESA = 20

/**
 * Tabla `items_del_cuadro` (PRP-007): un ítem propio de la empresa (Plastificado, Encolado, Troquelado…)
 * con el que nace cada cotización por partes. Suma a un factor base (`factor`) y se pinta tras otra fila
 * base (`despuesDe`); su orden es el de la lista. Al abrir una cotización se COPIA: cambiarlo aquí no toca
 * las que ya están abiertas.
 */
export const itemDeEmpresaSchema = z.strictObject({
  id: z.string().min(1).max(64),
  nombre: z.string().trim().min(1, { error: 'Falta el nombre del ítem.' }).max(60),
  factor: z.enum(FACTORES),
  despuesDe: z.enum(FACTORES),
  fija: z.boolean(),
  activo: z.boolean(),
})
export type ItemDeEmpresa = z.infer<typeof itemDeEmpresaSchema>

export const TIPOS_DE_FORMATO = ['madre', 'maquina'] as const
export type TipoDeFormato = (typeof TIPOS_DE_FORMATO)[number]

/**
 * Tabla `formatos_pliego`: un tamaño de pliego que se puede elegir en «Papel e imposición». El
 * `madre` es el que se compra; el `maquina`, al que se corta para imprimir. Las medidas se COPIAN
 * al elegirlo, como el costo de un insumo.
 */
export const formatoPliegoSchema = z.strictObject({
  id: z.string().min(1).max(64),
  nombre: z.string().trim().min(1).max(60),
  ...dimensionesSchema.shape,
  tipo: z.enum(TIPOS_DE_FORMATO),
  activo: z.boolean(),
})
export type FormatoPliego = z.infer<typeof formatoPliegoSchema>

/**
 * Tabla `maquinas`: al elegir una máquina se COPIAN su formato máximo, su pinza y sus valores de
 * trabajo (sangrado, calle y mermas) a la imposición, para no teclearlos en cada cotización.
 * Todo se puede corregir después en la propia cotización.
 */
export const maquinaSchema = z.strictObject({
  id: z.string().min(1).max(64),
  nombre: z.string().trim().min(1).max(60),
  formatoMaximo: dimensionesSchema,
  pinzaCm: medidaSchema,
  sangradoCm: medidaSchema,
  calleCm: medidaSchema,
  etapas: z.array(etapaDeMermaSchema).max(10),
  activo: z.boolean(),
})
export type Maquina = z.infer<typeof maquinaSchema>

/** Lo que una empresa nueva recibe al crearse (ADR-15): valores iniciales, ilustrativos y editables. */
export type SemillaDeEmpresa = {
  configuracion: ConfiguracionEmpresa
  insumos: InsumoTarifa[]
  formatos: FormatoPliego[]
  maquinas: Maquina[]
  /** Los ítems propios con los que nace cada cotización por partes (PRP-007). */
  items: ItemDeEmpresa[]
}
