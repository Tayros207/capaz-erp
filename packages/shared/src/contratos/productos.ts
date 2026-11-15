import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «productos»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

export const TIPOS_DE_PRODUCTO = ['producto', 'servicio'] as const;
const ESTADOS = ['activos', 'archivados', 'todos'] as const;

const texto = (max: number) => z.string().trim().max(max);
/** Milésimas de sol (ADR-012): entero seguro, de 0 en adelante. */
const milesimas = z.number().int().safe().min(0, { error: 'El precio no puede ser negativo.' });

export const productoSchema = z.strictObject({
  id: z.string(),
  codigo: z.string().nullable(),
  nombre: z.string(),
  tipo: z.enum(TIPOS_DE_PRODUCTO),
  unidad: z.string(),
  precioUnitarioMilesimas: milesimas,
  afectoIgv: z.boolean(),
  descripcion: z.string().nullable(),
  archivadoEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type ProductoDto = z.infer<typeof productoSchema>;

export const productoConParecidoSchema = z.strictObject({ ...productoSchema.shape, parecido: z.number() });

const camposDeProducto = {
  codigo: texto(40).nullish(),
  nombre: texto(200).min(1, { error: 'El nombre es obligatorio.' }),
  tipo: z.enum(TIPOS_DE_PRODUCTO),
  unidad: texto(30).min(1).optional(),
  precioUnitarioMilesimas: milesimas.optional(),
  afectoIgv: z.boolean().optional(),
  descripcion: texto(2000).nullish(),
};

export const crearProductoSchema = z.strictObject({ ...camposDeProducto, tipo: camposDeProducto.tipo.default('producto') });

/** Solo lo que cambia: al menos un campo. */
export const editarProductoSchema = z
  .strictObject({
    id: z.uuid(),
    ...camposDeProducto,
    nombre: camposDeProducto.nombre.optional(),
    tipo: camposDeProducto.tipo.optional(),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

const soloId = z.strictObject({ id: z.uuid() });

export const contratosDeProductos = {
  productos_listar: contrato(z.strictObject({ ...paginaSchema.shape, estado: z.enum(ESTADOS).default('activos') }), listadoSchema(productoSchema)),
  productos_ver: contrato(soloId, productoSchema),
  productos_buscar: contrato(
    z.strictObject({ texto: texto(200).min(1, { error: 'Escribe qué buscar.' }), limite: z.number().int().min(1).max(20).default(5) }),
    z.strictObject({ items: z.array(productoConParecidoSchema) }),
  ),
  productos_crear: contrato(crearProductoSchema, productoSchema),
  productos_editar: contrato(editarProductoSchema, productoSchema),
  productos_archivar: contrato(soloId, productoSchema),
  productos_restaurar: contrato(soloId, productoSchema),
} as const;

export const eventosDeProductos = {
  'producto.creado': z.strictObject({
    id: z.string(),
    codigo: z.string().nullable(),
    nombre: z.string(),
    tipo: z.enum(TIPOS_DE_PRODUCTO),
    unidad: z.string(),
    precioUnitarioMilesimas: z.number(),
  }),
  'producto.actualizado': z.strictObject({
    id: z.string(),
    codigo: z.string().nullable(),
    nombre: z.string(),
    tipo: z.enum(TIPOS_DE_PRODUCTO),
    unidad: z.string(),
    precioUnitarioMilesimas: z.number(),
    archivado: z.boolean(),
  }),
} as const;
