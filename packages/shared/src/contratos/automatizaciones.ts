import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «automatizaciones»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
//
// Una regla es DATOS: un disparador, condiciones declarativas (seis operadores, sin código) y acciones que son
// herramientas registradas con sus argumentos (con `{{ruta.del.dato}}` en los textos, sin expresiones).

export const TIPOS_DE_DISPARADOR = ['evento', 'tiempo', 'webhook', 'manual'] as const;
export const OPERADORES_DE_CONDICION = ['igual', 'distinto', 'mayor', 'menor', 'contiene', 'existe'] as const;
export const MODOS_DE_REGLA = ['borrador', 'pide_aprobacion', 'automatico'] as const;
export const RESULTADOS_DE_EJECUCION = ['ok', 'rechazada', 'omitida_por_limite', 'borrador_creado', 'sin_coincidencia'] as const;

export type OperadorDeCondicion = (typeof OPERADORES_DE_CONDICION)[number];
export type ModoDeRegla = (typeof MODOS_DE_REGLA)[number];

const idSchema = z.uuid({ error: 'El identificador de la regla no es válido.' });

/** Ruta con puntos dentro de los datos del disparo: `datos.total`, `datos.cliente.nombre`, `disparo.tipo`. */
export const RUTA_DE_DATO = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,9}$/;
const rutaSchema = z.string().max(200).regex(RUTA_DE_DATO, { error: 'La ruta del dato no es válida (ej.: datos.total).' });

export const condicionSchema = z
  .strictObject({
    campo: rutaSchema,
    op: z.enum(OPERADORES_DE_CONDICION),
    /** Obligatorio salvo en `existe` (ahí, `false` pide que el dato NO exista). */
    valor: z.union([z.string().max(500), z.number(), z.boolean()]).optional(),
  })
  .refine((c) => c.op === 'existe' || c.valor !== undefined, { error: 'Falta el valor con el que se compara.', path: ['valor'] });
export type Condicion = z.infer<typeof condicionSchema>;

export const accionSchema = z.strictObject({
  herramienta: z.string().regex(/^[a-z][a-z0-9_]*$/, { error: 'El nombre de la herramienta no es válido.' }).max(100),
  /** Los textos pueden llevar `{{ruta.del.dato}}`; no hay más expresiones. */
  args: z.record(z.string(), z.unknown()),
});
export type Accion = z.infer<typeof accionSchema>;

export const disparadorSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('evento'), evento: z.string().trim().min(1).max(100) }),
  z.strictObject({
    tipo: z.literal('tiempo'),
    /** Clave de una fuente de tiempo registrada, p. ej. `core.prueba_de_modulo_vence`. */
    fuente: z.string().trim().min(1).max(100),
    /** Días después de la fecha de la fuente (negativo = antes). */
    dias: z.number().int().min(-365).max(365),
  }),
  /** Llega por `webhook.recibido` y coincide el nombre del evento de entrada. */
  z.strictObject({ tipo: z.literal('webhook'), evento: z.string().trim().min(1).max(100) }),
  z.strictObject({ tipo: z.literal('manual') }),
]);
export type Disparador = z.infer<typeof disparadorSchema>;

export const reglaSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  activa: z.boolean(),
  disparador: disparadorSchema,
  condiciones: z.array(condicionSchema),
  acciones: z.array(accionSchema),
  modo: z.enum(MODOS_DE_REGLA),
  limiteDiario: z.number().int(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type Regla = z.infer<typeof reglaSchema>;

export const ejecucionDeReglaSchema = z.strictObject({
  id: z.string(),
  reglaId: z.string(),
  disparadoPor: z.record(z.string(), z.unknown()),
  simulada: z.boolean(),
  resultado: z.enum(RESULTADOS_DE_EJECUCION),
  detalle: z.unknown(),
  borradorId: z.string().nullable(),
  creadoEn: z.iso.datetime(),
});
export type EjecucionDeRegla = z.infer<typeof ejecucionDeReglaSchema>;

export const listarReglasSchema = z.strictObject({
  ...paginaSchema.shape,
  activa: z.boolean().optional(),
  disparador: z.enum(TIPOS_DE_DISPARADOR).optional(),
});

export const verReglaSchema = z.strictObject({ id: idSchema });

/** Sin `id` crea (inactiva); con `id` reemplaza la definición. Guardar nunca deja activa una regla en `automatico`. */
export const guardarReglaSchema = z.strictObject({
  id: idSchema.optional(),
  nombre: z.string().trim().min(1, { error: 'Ponle un nombre a la regla.' }).max(120),
  descripcion: z.string().trim().max(500).optional(),
  disparador: disparadorSchema,
  condiciones: z.array(condicionSchema).max(20).default([]),
  acciones: z.array(accionSchema).min(1, { error: 'La regla necesita al menos una acción.' }).max(10),
  modo: z.enum(MODOS_DE_REGLA).default('borrador'),
  limiteDiario: z.number().int().min(1).max(10000).default(50),
});

export const probarReglaSchema = z.strictObject({
  id: idSchema,
  /** Datos de ejemplo (lo que traería el evento o la fila de la fuente). Va a `datos` en las rutas. */
  datos: z.record(z.string(), z.unknown()).default({}),
});

export const ejecutarReglaSchema = z.strictObject({
  id: idSchema,
  datos: z.record(z.string(), z.unknown()).default({}),
});

export const listarEjecucionesSchema = z.strictObject({
  ...paginaSchema.shape,
  reglaId: idSchema.optional(),
  simulada: z.boolean().optional(),
  resultado: z.enum(RESULTADOS_DE_EJECUCION).optional(),
});

/** Lo que HARÍA la regla con esos datos; no escribe nada salvo una ejecución simulada. */
export const pruebaDeReglaSchema = z.strictObject({
  coincide: z.boolean(),
  limiteAlcanzado: z.boolean(),
  modo: z.enum(MODOS_DE_REGLA),
  /** Acciones con los datos ya sustituidos y los problemas que tendrían (herramienta inexistente, argumentos inválidos…). */
  acciones: z.array(z.strictObject({ herramienta: z.string(), args: z.unknown(), problemas: z.array(z.string()) })),
  resumen: z.string(),
  ejecucionId: z.string(),
});

export const contratosDeAutomatizaciones = {
  reglas_listar: contrato(listarReglasSchema, listadoSchema(reglaSchema)),
  regla_ver: contrato(verReglaSchema, reglaSchema),
  regla_guardar: contrato(guardarReglaSchema, reglaSchema),
  regla_activar: contrato(verReglaSchema, reglaSchema),
  regla_desactivar: contrato(verReglaSchema, reglaSchema),
  regla_probar: contrato(probarReglaSchema, pruebaDeReglaSchema),
  regla_ejecutar: contrato(ejecutarReglaSchema, ejecucionDeReglaSchema),
  regla_ejecuciones_listar: contrato(listarEjecucionesSchema, listadoSchema(ejecucionDeReglaSchema)),
} as const;

export const eventosDeAutomatizaciones = {} as const;
