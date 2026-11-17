import { z } from 'zod';
import { contrato } from '../herramientas.js';

// Contratos de los maestros ampliados (0025): ficha comercial, contactos y direcciones de clientes y
// proveedores; categorías, ficha y unidades de los productos. Un contrato por herramienta (`entidad_accion`).

export const MONEDAS = ['PEN', 'USD', 'EUR'] as const;
export const TIPOS_DE_DIRECCION = ['fiscal', 'entrega', 'otra'] as const;

const texto = (max: number) => z.string().trim().max(max);
const id = z.uuid();
const soloId = z.strictObject({ id });
const porCliente = z.strictObject({ clienteId: id });
const porProducto = z.strictObject({ productoId: id });
const fecha = z.iso.datetime();

// ───────── Clientes y proveedores ─────────

const camposComerciales = {
  condicionPagoDias: z.number().int().min(0).max(365),
  limiteCreditoCentimos: z.number().int().min(0).nullable(),
  moneda: z.enum(MONEDAS),
  vendedorId: texto(100).nullable(),
  segmento: texto(80).nullable(),
  sitioWeb: texto(200).nullable(),
  agenteRetencion: z.boolean(),
  sujetoDetraccion: z.boolean(),
  banco: texto(80).nullable(),
  cuentaBancaria: texto(40).nullable(),
  cci: texto(40).nullable(),
  notasComerciales: texto(2000).nullable(),
};

/** Sin ficha guardada, el cliente tiene los valores por defecto y `actualizadoEn` es `null`. */
export const clienteComercialSchema = z.strictObject({
  clienteId: z.string(),
  ...camposComerciales,
  actualizadoEn: fecha.nullable(),
});
export type ClienteComercialDto = z.infer<typeof clienteComercialSchema>;

export const guardarClienteComercialSchema = z
  .strictObject({
    clienteId: id,
    ...Object.fromEntries(Object.entries(camposComerciales).map(([k, v]) => [k, v.optional()])),
  } as { clienteId: typeof id } & { [K in keyof typeof camposComerciales]: z.ZodOptional<(typeof camposComerciales)[K]> })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'clienteId' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

const camposDeContacto = {
  nombre: texto(150).min(1, { error: 'El nombre es obligatorio.' }),
  cargo: texto(100).nullish(),
  telefono: texto(40).nullish(),
  correo: texto(200).nullish(),
  esPrincipal: z.boolean().optional(),
  notas: texto(1000).nullish(),
};
export const contactoSchema = z.strictObject({
  id: z.string(),
  clienteId: z.string(),
  nombre: z.string(),
  cargo: z.string().nullable(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  esPrincipal: z.boolean(),
  notas: z.string().nullable(),
  actualizadoEn: fecha,
});
export type ContactoDto = z.infer<typeof contactoSchema>;
/** Sin `id` crea; con `id` reemplaza los datos de ese contacto. */
export const guardarContactoSchema = z.strictObject({ id: id.optional(), clienteId: id, ...camposDeContacto });

const camposDeDireccion = {
  tipo: z.enum(TIPOS_DE_DIRECCION).default('entrega'),
  direccion: texto(300).min(1, { error: 'La dirección es obligatoria.' }),
  ciudad: texto(100).nullish(),
  departamento: texto(100).nullish(),
  referencia: texto(300).nullish(),
  esPrincipal: z.boolean().optional(),
};
export const direccionSchema = z.strictObject({
  id: z.string(),
  clienteId: z.string(),
  tipo: z.enum(TIPOS_DE_DIRECCION),
  direccion: z.string(),
  ciudad: z.string().nullable(),
  departamento: z.string().nullable(),
  referencia: z.string().nullable(),
  esPrincipal: z.boolean(),
  actualizadoEn: fecha,
});
export type DireccionDto = z.infer<typeof direccionSchema>;
export const guardarDireccionSchema = z.strictObject({ id: id.optional(), clienteId: id, ...camposDeDireccion });

// ───────── Productos ─────────

export const categoriaDeProductoSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  padreId: z.string().nullable(),
  archivadoEn: fecha.nullable(),
});
export type CategoriaDeProductoDto = z.infer<typeof categoriaDeProductoSchema>;
export const guardarCategoriaSchema = z.strictObject({
  id: id.optional(),
  nombre: texto(100).min(1, { error: 'El nombre es obligatorio.' }),
  padreId: id.nullish(),
});

const camposDeFicha = {
  categoriaId: id.nullable(),
  marca: texto(80).nullable(),
  sku: texto(60).nullable(),
  codigoBarras: texto(40).nullable(),
  costoMilesimas: z.number().int().min(0).nullable(),
  pesoGramos: z.number().min(0).nullable(),
  altoMm: z.number().int().min(0).nullable(),
  anchoMm: z.number().int().min(0).nullable(),
  largoMm: z.number().int().min(0).nullable(),
  vendible: z.boolean(),
  comprable: z.boolean(),
};
export const productoFichaSchema = z.strictObject({
  productoId: z.string(),
  ...camposDeFicha,
  categoriaNombre: z.string().nullable(),
  actualizadoEn: fecha.nullable(),
});
export type ProductoFichaDto = z.infer<typeof productoFichaSchema>;
export const guardarProductoFichaSchema = z
  .strictObject({
    productoId: id,
    ...Object.fromEntries(Object.entries(camposDeFicha).map(([k, v]) => [k, v.optional()])),
  } as { productoId: typeof id } & { [K in keyof typeof camposDeFicha]: z.ZodOptional<(typeof camposDeFicha)[K]> })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'productoId' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

export const unidadDeProductoSchema = z.strictObject({
  id: z.string(),
  productoId: z.string(),
  unidad: z.string(),
  factorMilesimas: z.number(),
  paraCompra: z.boolean(),
  paraVenta: z.boolean(),
});
export type UnidadDeProductoDto = z.infer<typeof unidadDeProductoSchema>;
/** `factorMilesimas`: cuántas unidades base trae una de esta (1 caja de 12 = 12000). */
export const guardarUnidadSchema = z.strictObject({
  productoId: id,
  unidad: texto(30).min(1, { error: 'La unidad es obligatoria.' }),
  factorMilesimas: z.number().int().min(1),
  paraCompra: z.boolean().default(true),
  paraVenta: z.boolean().default(true),
});

const lista = <T extends z.ZodType>(item: T) => z.strictObject({ items: z.array(item) });

export const contratosDeMaestrosAmpliados = {
  clientes_comercial_ver: contrato(porCliente, clienteComercialSchema),
  clientes_comercial_guardar: contrato(guardarClienteComercialSchema, clienteComercialSchema),
  clientes_contactos_listar: contrato(porCliente, lista(contactoSchema)),
  clientes_contacto_guardar: contrato(guardarContactoSchema, contactoSchema),
  clientes_contacto_eliminar: contrato(soloId, z.strictObject({ id: z.string() })),
  clientes_direcciones_listar: contrato(porCliente, lista(direccionSchema)),
  clientes_direccion_guardar: contrato(guardarDireccionSchema, direccionSchema),
  clientes_direccion_eliminar: contrato(soloId, z.strictObject({ id: z.string() })),
  categorias_producto_listar: contrato(z.strictObject({ incluirArchivadas: z.boolean().default(false) }), lista(categoriaDeProductoSchema)),
  categorias_producto_guardar: contrato(guardarCategoriaSchema, categoriaDeProductoSchema),
  categorias_producto_archivar: contrato(soloId, categoriaDeProductoSchema),
  productos_ficha_ver: contrato(porProducto, productoFichaSchema),
  productos_ficha_guardar: contrato(guardarProductoFichaSchema, productoFichaSchema),
  productos_unidades_listar: contrato(porProducto, lista(unidadDeProductoSchema)),
  productos_unidad_guardar: contrato(guardarUnidadSchema, unidadDeProductoSchema),
  productos_unidad_eliminar: contrato(soloId, z.strictObject({ id: z.string() })),
} as const;

export const eventosDeMaestrosAmpliados = {} as const;
