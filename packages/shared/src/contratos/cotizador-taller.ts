import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del taller del Cotizador (formatos de pliego, máquinas, tarifas e ítems del cuadro). Solo el carril cot-s3
// edita este archivo. Medidas (cm) y costos viajan COMO TEXTO decimal con punto: nunca `number` (ADR-04). Las reglas
// finas las vuelve a comprobar el servidor con los esquemas del motor (`formatoPliegoSchema` y compañía).

export const FACTORES_DEL_TALLER = ['material', 'planchas', 'impresion', 'diseno', 'acabado', 'indirectos'] as const;
export const ESCALAS_DE_TARIFA = ['fija', 'por_pliego', 'por_unidad'] as const;
export const TIPOS_DE_FORMATO_DE_PLIEGO = ['madre', 'maquina'] as const;
/** Cuántos ítems activos puede tener una empresa en su cuadro (el mismo tope del motor). */
export const MAXIMO_DE_ITEMS_DEL_CUADRO = 20;
export const MAXIMO_DE_ETAPAS_DE_MAQUINA = 10;

const texto = (max: number) => z.string().trim().max(max);
const soloId = z.strictObject({ id: z.uuid() });
const nombre = (max: number) => texto(max).min(1, { error: 'El nombre es obligatorio.' });
/** Medida en cm: `numeric(7,2)`, mayor que cero. */
const medidaPositiva = z.string().regex(/^(?!0+(\.0+)?$)\d{1,5}(\.\d{1,2})?$/, { error: 'Medida inválida: mayor que cero, hasta 2 decimales, con punto.' });
/** Medida en cm que puede ser cero (pinza, sangrado, calle). */
const medida = z.string().regex(/^\d{1,5}(\.\d{1,2})?$/, { error: 'Medida inválida: hasta 2 decimales, con punto.' });
/** Costo unitario: `numeric(14,4)`. */
const costo = z.string().regex(/^\d{1,10}(\.\d{1,4})?$/, { error: 'Costo inválido: hasta 4 decimales, con punto.' });
const porcentaje = z.string().regex(/^\d{1,4}(\.\d{1,3})?$/, { error: 'Porcentaje inválido.' });
const hojas = z.string().regex(/^\d{1,6}$/, { error: 'Debe ser un número entero de hojas.' });
const fecha = z.iso.datetime();
const estado = z.enum(['activas', 'archivadas', 'todas']).default('activas');
const buscar = texto(100).optional();
const cambioMinimo = (v: Record<string, unknown>) => Object.keys(v).some((k) => k !== 'id');
const SIN_CAMBIOS = { error: 'Indica al menos un dato que cambiar.' };

export const etapaDeMaquinaSchema = z.strictObject({ nombre: nombre(60), mermaPct: porcentaje, arranque: hojas });
export type EtapaDeMaquinaDto = z.infer<typeof etapaDeMaquinaSchema>;

// --- Formatos de pliego ---

export const formatoDePliegoSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  anchoCm: z.string(),
  altoCm: z.string(),
  tipo: z.enum(TIPOS_DE_FORMATO_DE_PLIEGO),
  archivadoEn: fecha.nullable(),
  creadoEn: fecha,
  actualizadoEn: fecha,
});
export type FormatoDePliegoDto = z.infer<typeof formatoDePliegoSchema>;

const camposDeFormato = { nombre: nombre(60), anchoCm: medidaPositiva, altoCm: medidaPositiva, tipo: z.enum(TIPOS_DE_FORMATO_DE_PLIEGO) };
export const crearFormatoDePliegoSchema = z.strictObject(camposDeFormato);
export const editarFormatoDePliegoSchema = z.strictObject({ id: z.uuid(), ...z.strictObject(camposDeFormato).partial().shape }).refine(cambioMinimo, SIN_CAMBIOS);

// --- Máquinas ---

export const maquinaDelTallerSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  formatoMaxAnchoCm: z.string(),
  formatoMaxAltoCm: z.string(),
  pinzaCm: z.string(),
  sangradoCm: z.string(),
  calleCm: z.string(),
  etapas: z.array(etapaDeMaquinaSchema),
  archivadoEn: fecha.nullable(),
  creadoEn: fecha,
  actualizadoEn: fecha,
});
export type MaquinaDelTallerDto = z.infer<typeof maquinaDelTallerSchema>;

const camposDeMaquina = {
  nombre: nombre(60),
  formatoMaxAnchoCm: medidaPositiva,
  formatoMaxAltoCm: medidaPositiva,
  pinzaCm: medida,
  sangradoCm: medida,
  calleCm: medida,
  etapas: z.array(etapaDeMaquinaSchema).max(MAXIMO_DE_ETAPAS_DE_MAQUINA),
};
export const crearMaquinaSchema = z.strictObject({ ...camposDeMaquina, etapas: camposDeMaquina.etapas.default([]) });
export const editarMaquinaSchema = z.strictObject({ id: z.uuid(), ...z.strictObject(camposDeMaquina).partial().shape }).refine(cambioMinimo, SIN_CAMBIOS);

// --- Tarifas ---

export const tarifaDelTallerSchema = z.strictObject({
  id: z.string(),
  factor: z.enum(FACTORES_DEL_TALLER),
  nombre: z.string(),
  unidad: z.string(),
  costoUnitario: z.string(),
  escalaPorDefecto: z.enum(ESCALAS_DE_TARIFA),
  formatoId: z.string().nullable(),
  articuloId: z.string().nullable(),
  archivadoEn: fecha.nullable(),
  creadoEn: fecha,
  actualizadoEn: fecha,
});
export type TarifaDelTallerDto = z.infer<typeof tarifaDelTallerSchema>;

const camposDeTarifa = {
  factor: z.enum(FACTORES_DEL_TALLER),
  nombre: nombre(120),
  unidad: texto(20).min(1, { error: 'Indica la unidad.' }),
  costoUnitario: costo,
  escalaPorDefecto: z.enum(ESCALAS_DE_TARIFA),
  formatoId: z.uuid().nullable(),
  articuloId: z.uuid().nullable(),
};
export const crearTarifaSchema = z.strictObject({ ...camposDeTarifa, formatoId: camposDeTarifa.formatoId.default(null), articuloId: camposDeTarifa.articuloId.default(null) });
export const editarTarifaSchema = z.strictObject({ id: z.uuid(), ...z.strictObject(camposDeTarifa).partial().shape }).refine(cambioMinimo, SIN_CAMBIOS);

// --- Ítems del cuadro ---

export const itemDelCuadroSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  factor: z.enum(FACTORES_DEL_TALLER),
  despuesDe: z.enum(FACTORES_DEL_TALLER),
  posicion: z.number().int(),
  fija: z.boolean(),
  archivadoEn: fecha.nullable(),
  creadoEn: fecha,
  actualizadoEn: fecha,
});
export type ItemDelCuadroDto = z.infer<typeof itemDelCuadroSchema>;

const camposDeItem = { nombre: nombre(60), factor: z.enum(FACTORES_DEL_TALLER), despuesDe: z.enum(FACTORES_DEL_TALLER), fija: z.boolean() };
export const crearItemDelCuadroSchema = z.strictObject({ ...camposDeItem, despuesDe: camposDeItem.despuesDe.optional(), fija: camposDeItem.fija.default(false) });
export const editarItemDelCuadroSchema = z.strictObject({ id: z.uuid(), ...z.strictObject(camposDeItem).partial().shape }).refine(cambioMinimo, SIN_CAMBIOS);
export const reordenarItemsSchema = z.strictObject({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(MAXIMO_DE_ITEMS_DEL_CUADRO * 2)
    .refine((v) => new Set(v).size === v.length, { error: 'Hay ítems repetidos en el orden.' }),
});

// --- Sembrar ---

export const resultadoDeSembrarSchema = z.strictObject({
  sembrado: z.boolean(),
  mensaje: z.string(),
  formatos: z.number().int(),
  maquinas: z.number().int(),
  tarifas: z.number().int(),
  items: z.number().int(),
});
export type ResultadoDeSembrarDto = z.infer<typeof resultadoDeSembrarSchema>;

export const contratosDeCotizadorTaller = {
  formatos_pliego_listar: contrato(z.strictObject({ ...paginaSchema.shape, buscar, estado, tipo: z.enum(TIPOS_DE_FORMATO_DE_PLIEGO).optional() }), listadoSchema(formatoDePliegoSchema)),
  formato_pliego_crear: contrato(crearFormatoDePliegoSchema, formatoDePliegoSchema),
  formato_pliego_editar: contrato(editarFormatoDePliegoSchema, formatoDePliegoSchema),
  formato_pliego_archivar: contrato(soloId, formatoDePliegoSchema),
  formato_pliego_restaurar: contrato(soloId, formatoDePliegoSchema),
  maquinas_listar: contrato(z.strictObject({ ...paginaSchema.shape, buscar, estado }), listadoSchema(maquinaDelTallerSchema)),
  maquina_crear: contrato(crearMaquinaSchema, maquinaDelTallerSchema),
  maquina_editar: contrato(editarMaquinaSchema, maquinaDelTallerSchema),
  maquina_archivar: contrato(soloId, maquinaDelTallerSchema),
  maquina_restaurar: contrato(soloId, maquinaDelTallerSchema),
  tarifas_listar: contrato(z.strictObject({ ...paginaSchema.shape, buscar, estado, factor: z.enum(FACTORES_DEL_TALLER).optional() }), listadoSchema(tarifaDelTallerSchema)),
  tarifa_crear: contrato(crearTarifaSchema, tarifaDelTallerSchema),
  tarifa_editar: contrato(editarTarifaSchema, tarifaDelTallerSchema),
  tarifa_archivar: contrato(soloId, tarifaDelTallerSchema),
  tarifa_restaurar: contrato(soloId, tarifaDelTallerSchema),
  items_cuadro_listar: contrato(z.strictObject({ estado }), listadoSchema(itemDelCuadroSchema)),
  item_cuadro_crear: contrato(crearItemDelCuadroSchema, itemDelCuadroSchema),
  item_cuadro_editar: contrato(editarItemDelCuadroSchema, itemDelCuadroSchema),
  item_cuadro_archivar: contrato(soloId, itemDelCuadroSchema),
  item_cuadro_restaurar: contrato(soloId, itemDelCuadroSchema),
  items_cuadro_reordenar: contrato(reordenarItemsSchema, listadoSchema(itemDelCuadroSchema)),
  taller_sembrar: contrato(z.strictObject({}), resultadoDeSembrarSchema),
} as const;
