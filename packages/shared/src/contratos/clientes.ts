import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «clientes»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

export const TIPOS_DE_CLIENTE = ['cliente', 'proveedor', 'ambos'] as const;
export const CLASES_DE_CLIENTE = ['persona', 'empresa'] as const;
export const TIPOS_DE_DOCUMENTO_DE_CLIENTE = ['dni', 'ruc', 'ce', 'pasaporte', 'otro'] as const;
export const ESTADOS_DE_LISTADO = ['activos', 'archivados', 'todos'] as const;

const texto = (max: number) => z.string().trim().max(max);

/** Lo que se anota de un cliente; en `clientes_crear` el nombre es obligatorio y en `clientes_editar` todo es opcional. */
const camposDeCliente = {
  tipo: z.enum(TIPOS_DE_CLIENTE),
  clase: z.enum(CLASES_DE_CLIENTE),
  nombre: texto(200).min(1, { error: 'El nombre es obligatorio.' }),
  documentoTipo: z.enum(TIPOS_DE_DOCUMENTO_DE_CLIENTE).nullish(),
  documentoNumero: texto(30).nullish(),
  telefono: texto(40).nullish(),
  correo: texto(200).nullish(),
  direccion: texto(300).nullish(),
  notas: texto(2000).nullish(),
};

export const clienteSchema = z.strictObject({
  id: z.string(),
  tipo: z.enum(TIPOS_DE_CLIENTE),
  clase: z.enum(CLASES_DE_CLIENTE),
  nombre: z.string(),
  documentoTipo: z.enum(TIPOS_DE_DOCUMENTO_DE_CLIENTE).nullable(),
  documentoNumero: z.string().nullable(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  direccion: z.string().nullable(),
  notas: z.string().nullable(),
  archivadoEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type ClienteDto = z.infer<typeof clienteSchema>;

export const clienteConParecidoSchema = z.strictObject({ ...clienteSchema.shape, parecido: z.number() });

export const listarClientesSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(ESTADOS_DE_LISTADO).default('activos'),
});

export const crearClienteSchema = z.strictObject({
  ...camposDeCliente,
  tipo: camposDeCliente.tipo.optional(),
  // Si no se indica: «empresa» cuando el documento es un RUC, «persona» en los demás casos.
  clase: camposDeCliente.clase.optional(),
});

/** Solo lo que cambia: al menos un campo. */
export const editarClienteSchema = z
  .strictObject({
    id: z.uuid(),
    tipo: camposDeCliente.tipo.optional(),
    clase: camposDeCliente.clase.optional(),
    nombre: camposDeCliente.nombre.optional(),
    documentoTipo: camposDeCliente.documentoTipo,
    documentoNumero: camposDeCliente.documentoNumero,
    telefono: camposDeCliente.telefono,
    correo: camposDeCliente.correo,
    direccion: camposDeCliente.direccion,
    notas: camposDeCliente.notas,
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

const soloId = z.strictObject({ id: z.uuid() });

export const contratosDeClientes = {
  clientes_listar: contrato(listarClientesSchema, listadoSchema(clienteSchema)),
  clientes_ver: contrato(soloId, clienteSchema),
  clientes_buscar: contrato(
    z.strictObject({ texto: texto(200).min(1, { error: 'Escribe qué buscar.' }), limite: z.number().int().min(1).max(20).default(5) }),
    z.strictObject({ items: z.array(clienteConParecidoSchema) }),
  ),
  clientes_crear: contrato(crearClienteSchema, clienteSchema),
  clientes_editar: contrato(editarClienteSchema, clienteSchema),
  clientes_archivar: contrato(soloId, clienteSchema),
  clientes_restaurar: contrato(soloId, clienteSchema),
} as const;

export const eventosDeClientes = {
  'cliente.creado': z.strictObject({ id: z.string(), nombre: z.string(), tipo: z.enum(TIPOS_DE_CLIENTE), clase: z.enum(CLASES_DE_CLIENTE) }),
  'cliente.actualizado': z.strictObject({
    id: z.string(),
    nombre: z.string(),
    tipo: z.enum(TIPOS_DE_CLIENTE),
    clase: z.enum(CLASES_DE_CLIENTE),
    archivado: z.boolean(),
  }),
} as const;
