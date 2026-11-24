import { z } from 'zod';
import { propuestaDeCapturaSchema } from './contratos/captura.js';

// Contrato entre el panel del asistente (web) y el servidor: qué pantalla tiene delante la persona, cómo se envía un turno,
// los eventos que vuelven y las conversaciones guardadas. No son herramientas: no entran en `contratos/index.ts`.

/** Lo que el panel sabe distinguir de una pantalla. Lista cerrada: la web nunca manda texto libre de la pantalla. */
export const ENTIDADES_DE_PANTALLA = [
  'cliente', 'producto', 'pedido', 'orden_de_produccion', 'cotizacion', 'oportunidad', 'movimiento', 'deuda', 'borrador', 'guia',
] as const;
export type TipoDeEntidadDePantalla = (typeof ENTIDADES_DE_PANTALLA)[number];

/** Qué puede hacer el asistente con las herramientas que cambian cosas. `ninguna` = solo leer. */
export const MODOS_DE_ESCRITURA = ['ninguna', 'borradores', 'directa'] as const;
export type ModoDeEscritura = (typeof MODOS_DE_ESCRITURA)[number];

export const MAXIMO_DE_MENSAJE_DEL_AGENTE = 4000;
export const MAXIMO_DE_TITULO_DE_CONVERSACION = 120;

/** Lo que la persona tiene delante. Es una PISTA para el modelo, nunca una autorización. */
export const pantallaDelAgenteSchema = z.strictObject({
  /** Solo el camino, sin consulta ni fragmento. */
  ruta: z.string().max(200).regex(/^\/[A-Za-z0-9/_.-]*$/),
  /** El `<codigo>` de `/m/<codigo>/…`, o nulo en las pantallas del núcleo. */
  modulo: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/).nullable(),
  entidad: z.strictObject({ tipo: z.enum(ENTIDADES_DE_PANTALLA), id: z.uuid() }).nullable(),
});
export type PantallaDelAgente = z.infer<typeof pantallaDelAgenteSchema>;

export const turnoDelAgenteSchema = z.strictObject({
  /** Sin él, el servidor crea la conversación. */
  conversacionId: z.uuid().optional(),
  /** Lo genera la web; el mismo en un reintento. */
  turnoId: z.uuid(),
  mensaje: z.string().trim().min(1, { error: 'Escribe algo.' }).max(MAXIMO_DE_MENSAJE_DEL_AGENTE, { error: 'El mensaje es demasiado largo.' }),
  origen: z.enum(['texto', 'voz']).default('texto'),
  pantalla: pantallaDelAgenteSchema.optional(),
});
/** Lo que el servidor recibe ya validado (con el origen resuelto). */
export type TurnoDelAgente = z.output<typeof turnoDelAgenteSchema>;
/** Lo que la web puede enviar: el origen es opcional. */
export type TurnoParaEnviar = z.input<typeof turnoDelAgenteSchema>;

/** Por qué un turno no pudo empezar o terminar. */
export const MOTIVOS_DE_ERROR_DEL_AGENTE = [
  'apagado', 'tope_mensual', 'limite_de_ritmo', 'turno_en_curso', 'modelo_no_disponible', 'tiempo_agotado', 'interno',
] as const;
export type MotivoDeErrorDelAgente = (typeof MOTIVOS_DE_ERROR_DEL_AGENTE)[number];

const usoDelTurnoSchema = z.strictObject({
  tokensEntrada: z.number().int().min(0),
  tokensSalida: z.number().int().min(0),
  tokensCache: z.number().int().min(0),
  /** Millonésimas de dólar (regla 9: nunca decimales). */
  costoMicrousd: z.number().int().min(0),
  rondas: z.number().int().min(0),
  duracionMs: z.number().int().min(0),
});
export type UsoDelTurno = z.infer<typeof usoDelTurnoSchema>;

/** Cada evento viaja como `event: <type>` + `data: <JSON>`; el JSON ya trae `type`. */
export const eventoDelAgenteSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('inicio'), conversacionId: z.uuid(), turnoId: z.uuid(), modelo: z.string() }),
  z.strictObject({ type: z.literal('texto'), delta: z.string() }),
  z.strictObject({ type: z.literal('herramienta_inicio'), id: z.string(), nombre: z.string(), titulo: z.string() }),
  /** `nota` es un texto corto del servidor («12 resultados», «sin permiso»); nunca los datos. */
  z.strictObject({ type: z.literal('herramienta_fin'), id: z.string(), ok: z.boolean(), nota: z.string() }),
  z.strictObject({ type: z.literal('accion'), herramienta: z.string(), titulo: z.string(), entidadTipo: z.string().nullable(), entidadId: z.string().nullable() }),
  z.strictObject({ type: z.literal('borrador'), borrador: propuestaDeCapturaSchema, critica: z.boolean() }),
  z.strictObject({ type: z.literal('uso'), modelo: z.string(), ...usoDelTurnoSchema.shape }),
  z.strictObject({ type: z.literal('fin'), mensajeId: z.uuid(), estado: z.enum(['completo', 'interrumpido']) }),
  z.strictObject({ type: z.literal('error'), motivo: z.enum(MOTIVOS_DE_ERROR_DEL_AGENTE), mensaje: z.string() }),
]);
export type EventoDelAgente = z.infer<typeof eventoDelAgenteSchema>;

/** Lo que el servidor deja anotado en el mensaje del agente. Las acciones y borradores se escriben en cuanto ocurren. */
export const metadatosDelAgenteSchema = z.strictObject({
  modelo: z.string(),
  uso: usoDelTurnoSchema.nullable(),
  pantalla: pantallaDelAgenteSchema.nullable(),
  /** Sin argumentos ni resultados: solo qué se usó y si salió bien. */
  herramientas: z.array(z.strictObject({ nombre: z.string(), ok: z.boolean() })),
  acciones: z.array(z.strictObject({ herramienta: z.string(), titulo: z.string(), entidadTipo: z.string().nullable(), entidadId: z.string().nullable() })),
  borradores: z.array(z.strictObject({ id: z.string(), herramienta: z.string(), resumen: z.string(), critica: z.boolean() })),
  corte: z.enum(['rondas', 'tiempo', 'tope', 'error']).nullable(),
});
export type MetadatosDelAgente = z.infer<typeof metadatosDelAgenteSchema>;

export const conversacionDelAgenteSchema = z.strictObject({
  id: z.uuid(),
  titulo: z.string(),
  favorita: z.boolean(),
  actualizadoEn: z.iso.datetime({ offset: true }),
});
export type ConversacionDelAgente = z.infer<typeof conversacionDelAgenteSchema>;

export const listaDeConversacionesSchema = z.strictObject({ items: z.array(conversacionDelAgenteSchema), hayMas: z.boolean() });
export type ListaDeConversaciones = z.infer<typeof listaDeConversacionesSchema>;

export const mensajeDelAgenteSchema = z.strictObject({
  id: z.uuid(),
  turnoId: z.uuid(),
  rol: z.enum(['persona', 'agente']),
  estado: z.enum(['completo', 'en_curso', 'interrumpido', 'error']),
  contenido: z.string(),
  /** Del agente: ver `metadatosDelAgenteSchema`. De la persona: vacío. Se lee tolerante: un mensaje viejo no debe romper la lista. */
  metadatos: z.record(z.string(), z.unknown()),
  creadoEn: z.iso.datetime({ offset: true }),
});
export type MensajeDelAgente = z.infer<typeof mensajeDelAgenteSchema>;

export const conversacionConMensajesSchema = z.strictObject({
  ...conversacionDelAgenteSchema.shape,
  mensajes: z.array(mensajeDelAgenteSchema),
});
export type ConversacionConMensajes = z.infer<typeof conversacionConMensajesSchema>;

export const renombrarConversacionSchema = z.strictObject({
  titulo: z.string().trim().min(1, { error: 'Escribe un título.' }).max(MAXIMO_DE_TITULO_DE_CONVERSACION, { error: 'El título es demasiado largo.' }),
});
export const favoritaConversacionSchema = z.strictObject({ favorita: z.boolean() });
export const conversacionBorradaSchema = z.strictObject({ id: z.uuid() });
export type ConversacionBorrada = z.infer<typeof conversacionBorradaSchema>;

/** `GET /agente/conversaciones?antesDe=<iso>`: la página siguiente a partir de la última fecha vista. */
export const consultaDeConversacionesSchema = z.strictObject({ antesDe: z.iso.datetime({ offset: true }).optional() });

/** `GET /agente/estado`: lo que el panel necesita para decidir qué mostrar. */
export const estadoDelAgenteSchema = z.strictObject({
  activo: z.boolean(),
  /** Si no está activo: por qué (`apagado`, `tope_mensual`…). */
  motivo: z.enum(MOTIVOS_DE_ERROR_DEL_AGENTE).nullable(),
  modelo: z.string().nullable(),
  puedeConfigurar: z.boolean(),
  escritura: z.enum(MODOS_DE_ESCRITURA),
});
export type EstadoDelAgente = z.infer<typeof estadoDelAgenteSchema>;
