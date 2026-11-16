// Contratos del área «personal»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

export const ESTADOS_DE_ASISTENCIA = ['presente', 'tardanza', 'falta', 'permiso', 'descanso'] as const;
export type EstadoDeAsistencia = (typeof ESTADOS_DE_ASISTENCIA)[number];
/** Estados en los que la persona estuvo en el trabajo: los únicos que admiten hora de entrada y de salida. */
export const ESTADOS_CON_HORA_DE_ASISTENCIA = ['presente', 'tardanza'] as const satisfies readonly EstadoDeAsistencia[];
export const NOMBRE_DE_ESTADO_DE_ASISTENCIA: Readonly<Record<EstadoDeAsistencia, string>> = {
  presente: 'Presente',
  tardanza: 'Tardanza',
  falta: 'Falta',
  permiso: 'Permiso',
  descanso: 'Descanso',
};
export const ESTADOS_DE_ADELANTO = ['registrado', 'anulado'] as const;
export type EstadoDeAdelanto = (typeof ESTADOS_DE_ADELANTO)[number];
export const FILTROS_DE_COLABORADOR = ['activos', 'archivados', 'todos'] as const;
export const FILTROS_DE_ADELANTO = ['vigentes', 'anulados', 'todos'] as const;
export const TIPOS_DE_DOCUMENTO_DE_COLABORADOR = ['dni', 'ce', 'pasaporte', 'otro'] as const;

const texto = (max: number) => z.string().trim().max(max);
const dia = z.iso.date();
const centimos = z.number().int().safe();

// --- Colaboradores ---

const camposDeColaborador = {
  documentoTipo: z.enum(TIPOS_DE_DOCUMENTO_DE_COLABORADOR),
  documentoNumero: texto(20),
  telefono: texto(30),
  cargo: texto(80),
  // La cuenta (usuario) del colaborador, si tiene. No se llama `usuarioId`: ese nombre lo reserva la sesión.
  cuentaId: texto(100),
  fechaIngreso: dia,
  sucursalId: z.uuid(),
};

export const colaboradorSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  documentoTipo: z.enum(TIPOS_DE_DOCUMENTO_DE_COLABORADOR).nullable(),
  documentoNumero: z.string().nullable(),
  telefono: z.string().nullable(),
  cargo: z.string().nullable(),
  cuentaId: z.string().nullable(),
  fechaIngreso: z.iso.date().nullable(),
  sucursalId: z.string().nullable(),
  archivado: z.boolean(),
  archivadoEn: z.iso.datetime().nullable(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type ColaboradorDto = z.infer<typeof colaboradorSchema>;

export const asistenciaSchema = z.strictObject({
  id: z.string(),
  colaboradorId: z.string(),
  colaboradorNombre: z.string(),
  fecha: z.iso.date(),
  estado: z.enum(ESTADOS_DE_ASISTENCIA),
  entrada: z.iso.datetime().nullable(),
  salida: z.iso.datetime().nullable(),
  nota: z.string().nullable(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type AsistenciaDto = z.infer<typeof asistenciaSchema>;

export const adelantoSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  numero: z.number().int(),
  anio: z.number().int(),
  colaboradorId: z.string(),
  colaboradorNombre: z.string(),
  montoCentimos: z.number().int(),
  fecha: z.iso.date(),
  motivo: z.string().nullable(),
  estado: z.enum(ESTADOS_DE_ADELANTO),
  anuladoEn: z.iso.datetime().nullable(),
  anuladoPor: z.string().nullable(),
  motivoAnulacion: z.string().nullable(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
});
export type AdelantoDto = z.infer<typeof adelantoSchema>;

/** La ficha: el colaborador con sus últimas asistencias (más recientes primero) y sus últimos adelantos. */
export const colaboradorCompletoSchema = z.strictObject({
  ...colaboradorSchema.shape,
  asistencias: z.array(asistenciaSchema),
  adelantos: z.array(adelantoSchema),
});
export type ColaboradorCompletoDto = z.infer<typeof colaboradorCompletoSchema>;

export const crearColaboradorSchema = z.strictObject({
  nombre: texto(120).min(1, { error: 'El nombre es obligatorio.' }),
  documentoTipo: camposDeColaborador.documentoTipo.nullish(),
  documentoNumero: camposDeColaborador.documentoNumero.nullish(),
  telefono: camposDeColaborador.telefono.nullish(),
  cargo: camposDeColaborador.cargo.nullish(),
  cuentaId: camposDeColaborador.cuentaId.nullish(),
  fechaIngreso: camposDeColaborador.fechaIngreso.nullish(),
  sucursalId: camposDeColaborador.sucursalId.nullish(),
});

/** Solo lo que cambia: al menos un campo. Un dato opcional con `null` se borra. */
export const editarColaboradorSchema = z
  .strictObject({
    id: z.uuid(),
    nombre: texto(120).min(1, { error: 'El nombre es obligatorio.' }).optional(),
    documentoTipo: camposDeColaborador.documentoTipo.nullish(),
    documentoNumero: camposDeColaborador.documentoNumero.nullish(),
    telefono: camposDeColaborador.telefono.nullish(),
    cargo: camposDeColaborador.cargo.nullish(),
    cuentaId: camposDeColaborador.cuentaId.nullish(),
    fechaIngreso: camposDeColaborador.fechaIngreso.nullish(),
    sucursalId: camposDeColaborador.sucursalId.nullish(),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

export const listarColaboradoresSchema = z.strictObject({
  ...paginaSchema.shape,
  buscar: texto(100).optional(),
  estado: z.enum(FILTROS_DE_COLABORADOR).default('activos'),
  sucursalId: z.uuid().optional(),
});

// --- Asistencia ---

/**
 * Marca del día de hoy (la hora la pone el servidor). `estado` fija el estado; `entrada` y `salida` marcan la hora
 * de llegada y de salida. Con `entrada` y sin `estado`, la persona queda «presente».
 */
export const marcarAsistenciaSchema = z
  .strictObject({
    colaboradorId: z.uuid(),
    estado: z.enum(ESTADOS_DE_ASISTENCIA).optional(),
    entrada: z.boolean().optional(),
    salida: z.boolean().optional(),
    nota: texto(300).nullish(),
  })
  .refine((v) => v.estado !== undefined || v.entrada === true || v.salida === true, { error: 'Indica el estado o marca la entrada o la salida.' });

export const corregirAsistenciaSchema = z.strictObject({
  colaboradorId: z.uuid(),
  fecha: dia,
  estado: z.enum(ESTADOS_DE_ASISTENCIA),
  motivo: texto(300).min(1, { error: 'Indica el motivo.' }),
});

export const listarAsistenciasSchema = z
  .strictObject({
    ...paginaSchema.shape,
    desde: dia,
    hasta: dia.optional(),
    colaboradorId: z.uuid().optional(),
  })
  .refine((v) => v.hasta === undefined || v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' });

// --- Adelantos ---

export const registrarAdelantoSchema = z.strictObject({
  colaboradorId: z.uuid(),
  montoCentimos: centimos.min(1, { error: 'El monto debe ser mayor que cero.' }),
  fecha: dia.optional(),
  motivo: texto(300).nullish(),
});

export const anularAdelantoSchema = z.strictObject({ id: z.uuid(), motivo: texto(300).min(1, { error: 'Indica el motivo.' }) });

export const listarAdelantosSchema = z
  .strictObject({
    ...paginaSchema.shape,
    estado: z.enum(FILTROS_DE_ADELANTO).default('vigentes'),
    colaboradorId: z.uuid().optional(),
    desde: dia.optional(),
    hasta: dia.optional(),
  })
  .refine((v) => v.desde === undefined || v.hasta === undefined || v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' });

// --- Resumen ---

export const resumenDePersonalSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  colaboradoresActivos: z.number().int(),
  /** Hoy: cuántos tienen marca y cuántos faltan por marcar. */
  hoy: z.strictObject({ fecha: z.iso.date(), marcados: z.number().int(), sinMarcar: z.number().int() }),
  asistenciasPorEstado: z.array(z.strictObject({ estado: z.enum(ESTADOS_DE_ASISTENCIA), cantidad: z.number().int() })),
  adelantos: z.strictObject({ cantidad: z.number().int(), totalCentimos: z.number().int(), anulados: z.number().int() }),
});
export type ResumenDePersonal = z.infer<typeof resumenDePersonalSchema>;

const soloId = z.strictObject({ id: z.uuid() });

export const contratosDePersonal = {
  colaborador_crear: contrato(crearColaboradorSchema, colaboradorCompletoSchema),
  colaborador_editar: contrato(editarColaboradorSchema, colaboradorCompletoSchema),
  colaborador_archivar: contrato(soloId, colaboradorCompletoSchema),
  colaborador_restaurar: contrato(soloId, colaboradorCompletoSchema),
  colaboradores_listar: contrato(listarColaboradoresSchema, listadoSchema(colaboradorSchema)),
  colaborador_ver: contrato(soloId, colaboradorCompletoSchema),
  asistencia_marcar: contrato(marcarAsistenciaSchema, asistenciaSchema),
  asistencia_corregir: contrato(corregirAsistenciaSchema, asistenciaSchema),
  asistencias_listar: contrato(listarAsistenciasSchema, listadoSchema(asistenciaSchema)),
  adelanto_registrar: contrato(registrarAdelantoSchema, adelantoSchema),
  adelanto_anular: contrato(anularAdelantoSchema, adelantoSchema),
  adelantos_listar: contrato(listarAdelantosSchema, listadoSchema(adelantoSchema)),
  personal_resumen: contrato(
    z.strictObject({ desde: dia, hasta: dia }).refine((v) => v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' }),
    resumenDePersonalSchema,
  ),
} as const;

// Sin nombres ni documentos: solo ids y montos.
export const eventosDePersonal = {
  'adelanto.registrado': z.strictObject({ adelantoId: z.string(), colaboradorId: z.string(), montoCentimos: z.number().int(), fecha: z.iso.date() }),
  'adelanto.anulado': z.strictObject({ adelantoId: z.string(), colaboradorId: z.string(), montoCentimos: z.number().int() }),
} as const;
