import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «crm»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo. Ficha: docs/FICHAS-OLA-2.md §5.3.

export const TIPOS_DE_ETAPA = ['abierta', 'ganada', 'perdida'] as const;
export const ESTADOS_DE_OPORTUNIDAD = ['abierta', 'ganada', 'perdida'] as const;
export const TIPOS_DE_ACTIVIDAD = ['llamada', 'reunion', 'mensaje', 'tarea', 'nota'] as const;
export const FILTROS_DE_OPORTUNIDAD = ['abiertas', 'ganadas', 'perdidas', 'todas'] as const;
export const FILTROS_DE_ACTIVIDAD = ['pendientes', 'vencidas', 'hechas', 'todas'] as const;

const texto = (max: number) => z.string().trim().max(max);
const soloId = z.strictObject({ id: z.uuid() });
const dia = z.iso.date();
const monto = z.number().int().safe().min(0, { error: 'El monto no puede ser negativo.' });
const nombreDeEtapa = texto(60).min(1, { error: 'Indica el nombre de la etapa.' });
const titulo = texto(160).min(1, { error: 'Indica el título.' });

export const etapaSchema = z.strictObject({ id: z.string(), nombre: z.string(), orden: z.number().int(), tipo: z.enum(TIPOS_DE_ETAPA), archivadoEn: z.iso.datetime().nullable() });
export type EtapaDto = z.infer<typeof etapaSchema>;

export const oportunidadSchema = z.strictObject({
  id: z.string(), codigo: z.string(), titulo: z.string(), clienteId: z.string(), clienteNombre: z.string(),
  etapaId: z.string(), etapaNombre: z.string(), estado: z.enum(ESTADOS_DE_OPORTUNIDAD),
  montoEstimadoCentimos: z.number().int().nullable(), fechaEsperada: z.iso.date().nullable(), responsableId: z.string().nullable(),
  motivoPerdida: z.string().nullable(), cerradaEn: z.iso.datetime().nullable(), ultimaActividadEn: z.iso.datetime(),
  notas: z.string().nullable(), sucursalId: z.string().nullable(), actividadesPendientes: z.number().int(),
  creadoPor: z.string(), creadoEn: z.iso.datetime(), actualizadoEn: z.iso.datetime(),
});
export type OportunidadDto = z.infer<typeof oportunidadSchema>;

export const actividadSchema = z.strictObject({
  id: z.string(), oportunidadId: z.string(), oportunidadCodigo: z.string(), oportunidadTitulo: z.string(), tipo: z.enum(TIPOS_DE_ACTIVIDAD), asunto: z.string(), nota: z.string().nullable(),
  venceEl: z.iso.date().nullable(), vencida: z.boolean(), hechaEn: z.iso.datetime().nullable(), hechaPor: z.string().nullable(), responsableId: z.string().nullable(),
  creadoPor: z.string(), creadoEn: z.iso.datetime(),
});
export type ActividadDto = z.infer<typeof actividadSchema>;

export const oportunidadConActividadesSchema = z.strictObject({ ...oportunidadSchema.shape, actividades: z.array(actividadSchema) });
export type OportunidadConActividades = z.infer<typeof oportunidadConActividadesSchema>;

export const crearOportunidadSchema = z.strictObject({
  titulo,
  clienteId: z.uuid(),
  etapaId: z.uuid().optional(),
  montoEstimadoCentimos: monto.nullish(),
  fechaEsperada: dia.nullish(),
  responsableId: texto(100).nullish(),
  notas: texto(4000).nullish(),
  sucursalId: z.uuid().nullish(),
});

/** Solo lo que cambia: al menos un campo. `null` borra un dato opcional. */
export const editarOportunidadSchema = z
  .strictObject({
    id: z.uuid(),
    titulo: titulo.optional(),
    clienteId: z.uuid().optional(),
    montoEstimadoCentimos: monto.nullish(),
    fechaEsperada: dia.nullish(),
    responsableId: texto(100).nullish(),
    notas: texto(4000).nullish(),
    sucursalId: z.uuid().nullish(),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

export const listarOportunidadesSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_OPORTUNIDAD).default('abiertas'),
  etapaId: z.uuid().optional(),
  clienteId: z.uuid().optional(),
  responsableId: texto(100).optional(),
  buscar: texto(100).optional(),
});

export const crearActividadSchema = z.strictObject({
  oportunidadId: z.uuid(),
  tipo: z.enum(TIPOS_DE_ACTIVIDAD),
  asunto: texto(160).min(1, { error: 'Indica el asunto.' }),
  nota: texto(4000).nullish(),
  venceEl: dia.nullish(),
  responsableId: texto(100).nullish(),
});

export const listarActividadesSchema = z.strictObject({
  ...paginaSchema.shape,
  oportunidadId: z.uuid().optional(),
  estado: z.enum(FILTROS_DE_ACTIVIDAD).default('pendientes'),
  responsableId: texto(100).optional(),
});

export const resumenDeCrmSchema = z.strictObject({
  desde: dia,
  hasta: dia,
  abiertas: z.number().int(),
  montoAbiertoCentimos: z.number().int(),
  porEtapa: z.array(z.strictObject({ etapaId: z.string(), nombre: z.string(), cantidad: z.number().int(), montoCentimos: z.number().int() })),
  ganadas: z.number().int(),
  montoGanadoCentimos: z.number().int(),
  perdidas: z.number().int(),
  actividadesVencidas: z.number().int(),
});
export type ResumenDeCrm = z.infer<typeof resumenDeCrmSchema>;

export const contratosDeCrm = {
  crm_iniciar: contrato(z.strictObject({}), z.strictObject({ etapasCreadas: z.number().int() })),
  etapas_listar: contrato(z.strictObject({ incluirArchivadas: z.boolean().default(false) }), listadoSchema(etapaSchema)),
  etapa_crear: contrato(z.strictObject({ nombre: nombreDeEtapa }), etapaSchema),
  etapa_editar: contrato(z.strictObject({ id: z.uuid(), nombre: nombreDeEtapa }), etapaSchema),
  etapas_ordenar: contrato(z.strictObject({ ids: z.array(z.uuid()).min(1).max(30) }), listadoSchema(etapaSchema)),
  etapa_archivar: contrato(soloId, etapaSchema),
  oportunidad_crear: contrato(crearOportunidadSchema, oportunidadSchema),
  oportunidad_ver: contrato(soloId, oportunidadConActividadesSchema),
  oportunidades_listar: contrato(listarOportunidadesSchema, listadoSchema(oportunidadSchema)),
  oportunidad_editar: contrato(editarOportunidadSchema, oportunidadSchema),
  oportunidad_mover: contrato(z.strictObject({ id: z.uuid(), etapaId: z.uuid() }), oportunidadSchema),
} as const;

export const eventosDeCrm = {
  'oportunidad.creada': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), etapaId: z.string(), montoEstimadoCentimos: z.number().int().nullable() }),
  'oportunidad.movida': z.strictObject({ id: z.string(), codigo: z.string(), etapaId: z.string(), etapaAnteriorId: z.string() }),
  'oportunidad.ganada': z.strictObject({ id: z.string(), codigo: z.string(), titulo: z.string(), clienteId: z.string(), montoEstimadoCentimos: z.number().int().nullable() }),
  'oportunidad.perdida': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string() }),
} as const;
