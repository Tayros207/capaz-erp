import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';
import { MAXIMO_DE_TEXTO_DE_CAPTURA } from './captura.js';

// Contratos del área «agente»: la configuración del asistente. Cambiar el modelo o el tope es una operación de negocio
// (regla 3), así que va por herramienta y no por REST. El asistente NO puede usarlas (no cambia su propio modelo ni su tope).
// Solo el carril de esta área edita este archivo.

/** Cuánto puede costar el asistente al mes, como máximo, por empresa. 1.000 dólares: un tope de cordura, no de negocio. */
export const MAXIMO_TOPE_MENSUAL_MICROUSD = 1_000_000_000;

/** Lo máximo que se puede fijar por operación de dinero: S/ 100,000. Un tope de cordura. */
export const MAXIMO_TOPE_POR_OPERACION_CENTIMOS = 10_000_000;

export const NIVELES_DE_MODELO = ['recomendado', 'equilibrado', 'economico', 'premium', 'experimental'] as const;

/** Un modelo que se puede elegir. Los precios son por millón de tokens, en millonésimas de dólar (nulo si no se pudieron consultar). */
export const modeloDelCatalogoSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  nivel: z.enum(NIVELES_DE_MODELO),
  descripcion: z.string(),
  /** `revisar` = proveedores que podrían guardar lo que se les manda. */
  privacidad: z.enum(['estandar', 'revisar']),
  /** `true` solo si alguien corrió el banco de evaluación y lo anotó. Es informativo: un modelo sin evaluar también actúa (y deja huella). */
  evaluado: z.boolean(),
  /** `false` = el proveedor ya no lo lista o no admite herramientas. */
  disponible: z.boolean(),
  entradaMicrousdPorMillon: z.number().int().min(0).nullable(),
  salidaMicrousdPorMillon: z.number().int().min(0).nullable(),
});
export type ModeloDelCatalogo = z.infer<typeof modeloDelCatalogoSchema>;

export const configuracionDelAgenteSchema = z.strictObject({
  /** El que eligió la empresa, o nulo si usa el del despliegue. */
  modelo: z.string().nullable(),
  /** El que se usará en el próximo turno. */
  modeloEfectivo: z.string(),
  /** Nulo = el tope del despliegue. */
  topeMensualMicrousd: z.number().int().min(0).nullable(),
  topeEfectivoMicrousd: z.number().int().min(0),
  escrituraDirecta: z.boolean(),
  /** Freno solo del dinero: apagado, lo que mueve dinero queda como borrador. */
  dineroDirecto: z.boolean(),
  /** Céntimos por operación de dinero que el asistente hace solo; por encima, borrador. Ya resuelto (nunca nulo). */
  topePorOperacionCentimos: z.number().int().min(0),
  internet: z.boolean(),
  gastoDelMesMicrousd: z.number().int().min(0),
});
export type ConfiguracionDelAgente = z.infer<typeof configuracionDelAgenteSchema>;

const verSalida = z.strictObject({
  configuracion: configuracionDelAgenteSchema,
  catalogo: z.array(modeloDelCatalogoSchema),
  /** `false` = no se pudo consultar los precios en vivo: el catálogo sale sin ellos. */
  preciosDisponibles: z.boolean(),
});

const configurarEntrada = z
  .strictObject({
    /** Nulo = volver al modelo del despliegue. */
    modelo: z
      .string()
      .max(100)
      .regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i, { error: 'El modelo debe tener la forma «proveedor/nombre».' })
      .nullable()
      .optional(),
    /** Nulo = volver al tope del despliegue. */
    topeMensualMicrousd: z.number().int().min(0).max(MAXIMO_TOPE_MENSUAL_MICROUSD).nullable().optional(),
    escrituraDirecta: z.boolean().optional(),
    dineroDirecto: z.boolean().optional(),
    /** Buscar en internet y leer páginas. */
    internet: z.boolean().optional(),
    /** Nulo = volver al tope del despliegue (S/ 1,000). */
    topePorOperacionCentimos: z.number().int().min(0).max(MAXIMO_TOPE_POR_OPERACION_CENTIMOS).nullable().optional(),
  })
  .refine((v) => v.modelo !== undefined || v.topeMensualMicrousd !== undefined || v.escrituraDirecta !== undefined || v.dineroDirecto !== undefined || v.internet !== undefined || v.topePorOperacionCentimos !== undefined, {
    error: 'Indica qué quieres cambiar.',
  });

// --- La huella: lo que hizo el asistente, para que una persona evalúe si actuó bien ---

export const POLITICAS_DE_ACCION = ['directo', 'confirmada', 'propuesta'] as const;
export const RESULTADOS_DE_ACCION = ['ok', 'rechazada', 'pendiente_confirmacion', 'propuesta'] as const;

export const accionDelAgenteSchema = z.strictObject({
  id: z.string(),
  creadoEn: z.string(),
  usuarioId: z.string(),
  modelo: z.string(),
  conversacionId: z.string(),
  turnoId: z.string(),
  ronda: z.number().int(),
  indice: z.number().int(),
  herramienta: z.string(),
  politica: z.enum(POLITICAS_DE_ACCION),
  resultado: z.enum(RESULTADOS_DE_ACCION),
  codigo: z.string().nullable(),
  args: z.unknown(),
  antes: z.unknown(),
  despues: z.unknown(),
  resumenConfirmado: z.string().nullable(),
});
export type AccionDelAgente = z.infer<typeof accionDelAgenteSchema>;

const listarAccionesEntrada = z.strictObject({
  ...paginaSchema.shape,
  herramienta: z.string().max(100).optional(),
  politica: z.enum(POLITICAS_DE_ACCION).optional(),
  resultado: z.enum(RESULTADOS_DE_ACCION).optional(),
  conversacionId: z.uuid().optional(),
});

// --- La memoria: lo que el asistente va aprendiendo ---

export const ALCANCES_DE_LECCION = ['persona', 'empresa'] as const;
export const TIPOS_DE_LECCION = ['error_de_herramienta', 'correccion', 'preferencia', 'alias', 'regla_del_erp'] as const;
export const ESTADOS_DE_LECCION = ['por_revisar', 'vigente', 'archivada'] as const;
export const ORIGENES_DE_LECCION = ['persona', 'sistema', 'modelo'] as const;

export const leccionSchema = z.strictObject({
  id: z.string(),
  alcance: z.enum(ALCANCES_DE_LECCION),
  usuarioId: z.string(),
  tipo: z.enum(TIPOS_DE_LECCION),
  clave: z.string(),
  texto: z.string(),
  herramienta: z.string().nullable(),
  estado: z.enum(ESTADOS_DE_LECCION),
  origen: z.enum(ORIGENES_DE_LECCION),
  conversacionId: z.string().nullable(),
  turnoId: z.string().nullable(),
  usos: z.number().int(),
  ultimaVez: z.string().nullable(),
  creadoEn: z.string(),
});
export type Leccion = z.infer<typeof leccionSchema>;

const idDeLeccion = z.strictObject({ id: z.uuid() });

// --- Los chats anteriores: el asistente puede recordar lo que habló con ESTA persona (nunca con otra) ---

export const fragmentoDeConversacionSchema = z.strictObject({ rol: z.enum(['persona', 'agente']), fecha: z.string(), texto: z.string() });
export const coincidenciaDeConversacionSchema = z.strictObject({
  conversacionId: z.string(),
  titulo: z.string(),
  /** Cuándo se habló por última vez en esa conversación. */
  fecha: z.string(),
  fragmentos: z.array(fragmentoDeConversacionSchema),
});
export type CoincidenciaDeConversacion = z.infer<typeof coincidenciaDeConversacionSchema>;

// --- El dictado por audio (REST `POST /api/v1/agente/transcribir`, NO es herramienta: no va en `contratosDeAgente`) ---

/** Lo más largo que se transcribe. La web corta antes (45 s); el servidor lo mide en la cabecera WAV. */
export const SEGUNDOS_MAXIMOS_DE_AUDIO = 60;
/** Unos 2,2 MB de WAV: de sobra para 60 s en mono a 16 kHz (1,9 MB). */
export const MAXIMO_DE_AUDIO_BASE64 = 3_000_000;

export const transcribirAudioSchema = z.strictObject({
  audioBase64: z
    .string()
    .min(1, { error: 'Falta el audio.' })
    .max(MAXIMO_DE_AUDIO_BASE64, { error: 'El audio es demasiado largo.' })
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, { error: 'El audio no viene en base64.' }),
  formato: z.literal('wav'),
});
export type TranscribirAudio = z.infer<typeof transcribirAudioSchema>;

/** Lo que se oyó, ya recortado al máximo del dictado. Vacío si no se entendió nada. Nunca se envía solo: va a la caja. */
export const transcripcionSchema = z.strictObject({ texto: z.string().max(MAXIMO_DE_TEXTO_DE_CAPTURA) });
export type Transcripcion = z.infer<typeof transcripcionSchema>;

export const contratosDeAgente = {
  agente_configuracion_ver: contrato(z.strictObject({}), verSalida),
  agente_configurar: contrato(configurarEntrada, z.strictObject({ configuracion: configuracionDelAgenteSchema })),
  agente_acciones_listar: contrato(listarAccionesEntrada, listadoSchema(accionDelAgenteSchema)),
  memoria_anotar: contrato(
    z.strictObject({
      tipo: z.enum(TIPOS_DE_LECCION).describe('Qué clase de lección es.'),
      texto: z.string().trim().min(1).max(280).describe('La lección, en una frase corta y sin datos personales.'),
      clave: z.string().trim().min(1).max(160).optional().describe('Identifica la lección; si ya existe se suma un uso en vez de duplicarla.'),
      herramienta: z.string().max(100).optional().describe('La herramienta a la que se refiere, si aplica.'),
      cita: z.string().trim().max(280).optional().describe('Las palabras EXACTAS de la persona que motivan la lección.'),
      /** Lo calcula el servidor (¿la cita aparece en el mensaje de la persona?); lo que mande el modelo se ignora. */
      citaVerificada: z.boolean().optional(),
    }),
    z.strictObject({ leccion: leccionSchema }),
  ),
  /** Busca en los chats anteriores de la persona; sin texto devuelve lo más reciente. */
  conversaciones_buscar: contrato(
    z.strictObject({ texto: z.string().trim().max(100).optional(), limite: z.number().int().min(1).max(10).default(5) }),
    z.strictObject({ coincidencias: z.array(coincidenciaDeConversacionSchema) }),
  ),
  memoria_listar: contrato(z.strictObject({ ...paginaSchema.shape, estado: z.enum(ESTADOS_DE_LECCION).optional() }), listadoSchema(leccionSchema)),
  memoria_editar: contrato(z.strictObject({ id: z.uuid(), texto: z.string().trim().min(1).max(280) }), z.strictObject({ leccion: leccionSchema })),
  memoria_archivar: contrato(idDeLeccion, z.strictObject({ leccion: leccionSchema })),
  /** La aprueba una persona: pasa a vigente. Con `alcance: empresa` la usa el asistente de toda la empresa (pide `empresa:configurar`). */
  memoria_aprobar: contrato(z.strictObject({ id: z.uuid(), alcance: z.enum(ALCANCES_DE_LECCION).optional() }), z.strictObject({ leccion: leccionSchema })),
} as const;
export const eventosDeAgente = {} as const;
