import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Asistente: configuración por empresa, conversaciones y mensajes de cada persona, y el uso/costo de cada turno.
// Seguridad (aislamiento, política «solo_propias», permisos) a mano al final de la migración.

/** Una fila por empresa: el modelo que eligió, su tope de gasto y los interruptores del asistente. */
export const agenteConfiguracion = core.table(
  'agente_configuracion',
  {
    tenantId: text('tenant_id').primaryKey(),
    /** Nulo = el modelo del despliegue (`AGENTE_MODELO`). */
    modelo: text('modelo'),
    /** Millonésimas de dólar. Nulo = el tope del despliegue. */
    topeMensualMicrousd: bigint('tope_mensual_microusd', { mode: 'number' }),
    /** El asistente actúa por defecto (decisión de Moisés, 2026-11-24); apagarlo es el freno de la empresa: todo queda como borrador. */
    escrituraDirecta: boolean('escritura_directa').notNull().default(true),
    /** Segundo freno, solo del dinero: apagado, lo que mueve dinero queda como borrador aunque la escritura directa siga activa. */
    dineroDirecto: boolean('dinero_directo').notNull().default(true),
    /** Tope de céntimos por operación de dinero que el asistente hace solo. Nulo = el del despliegue (S/ 1,000). Por encima, borrador. */
    topePorOperacionCentimos: bigint('tope_por_operacion_centimos', { mode: 'number' }),
    internet: boolean('internet').notNull().default(false),
    actualizadoPor: text('actualizado_por').notNull(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // La misma forma que valida el contrato: `proveedor/nombre`.
    check('agente_modelo_forma', sql`${t.modelo} is null or (length(${t.modelo}) <= 100 and ${t.modelo} ~ '^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._:-]*$')`),
    check('agente_tope', sql`${t.topeMensualMicrousd} is null or ${t.topeMensualMicrousd} >= 0`),
    check('agente_tope_operacion', sql`${t.topePorOperacionCentimos} is null or ${t.topePorOperacionCentimos} >= 0`),
  ],
);

/** La lista de conversaciones de cada persona. Privadas: solo su dueña las ve. */
export const agenteConversaciones = core.table(
  'agente_conversaciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    usuarioId: text('usuario_id').notNull(),
    titulo: text('titulo').notNull(),
    favorita: boolean('favorita').notNull().default(false),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    /** La mueve el repositorio al guardar un mensaje (no un disparador: renombrar no debe reordenar). */
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('agente_conversaciones_persona_id').on(t.tenantId, t.usuarioId, t.id),
    check('agente_conversacion_titulo', sql`length(${t.titulo}) between 1 and 120`),
    index('idx_agente_conversaciones_persona').on(t.tenantId, t.usuarioId, t.actualizadoEn.desc()),
  ],
);

/** Los mensajes de la persona y del asistente. El del asistente nace `en_curso` y cada acción se anota en cuanto ocurre. */
export const agenteMensajes = core.table(
  'agente_mensajes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    usuarioId: text('usuario_id').notNull(),
    conversacionId: uuid('conversacion_id').notNull(),
    turnoId: uuid('turno_id').notNull(),
    rol: text('rol').notNull(),
    estado: text('estado').notNull().default('completo'),
    contenido: text('contenido').notNull().default(''),
    metadatos: jsonb('metadatos').notNull().default(sql`'{}'::jsonb`),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('agente_mensajes_turno_rol').on(t.tenantId, t.conversacionId, t.turnoId, t.rol),
    // La llave lleva `usuario_id`: nadie puede colgar un mensaje de la conversación de otra persona.
    foreignKey({
      name: 'agente_mensajes_conversacion_fk',
      columns: [t.tenantId, t.usuarioId, t.conversacionId],
      foreignColumns: [agenteConversaciones.tenantId, agenteConversaciones.usuarioId, agenteConversaciones.id],
    }),
    check('agente_mensaje_rol', sql`${t.rol} IN ('persona', 'agente')`),
    check('agente_mensaje_estado', sql`${t.estado} IN ('completo', 'en_curso', 'interrumpido', 'error')`),
    check('agente_mensaje_largo', sql`length(${t.contenido}) <= 40000`),
    index('idx_agente_mensajes_conversacion').on(t.tenantId, t.conversacionId, t.creadoEn),
  ],
);

/** Uso y costo de cada turno. Solo inserción; sin llaves foráneas (particionable, como `core.auditoria`). */
export const uso = core.table(
  'uso',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    usuarioId: text('usuario_id').notNull(),
    origen: text('origen').notNull(),
    turnoId: uuid('turno_id').notNull(),
    modelo: text('modelo').notNull(),
    tokensEntrada: integer('tokens_entrada').notNull().default(0),
    tokensSalida: integer('tokens_salida').notNull().default(0),
    tokensCache: integer('tokens_cache').notNull().default(0),
    /** Millonésimas de dólar (regla 9: nunca decimales en `number`). */
    costoMicrousd: bigint('costo_microusd', { mode: 'number' }).notNull().default(0),
    rondas: integer('rondas').notNull().default(0),
    duracionMs: integer('duracion_ms').notNull().default(0),
    resultado: text('resultado').notNull().default('ok'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('uso_origen', sql`${t.origen} IN ('agente', 'titulo', 'captura')`),
    check('uso_resultado', sql`${t.resultado} IN ('ok', 'cortado', 'error')`),
    index('idx_uso_empresa').on(t.tenantId, t.creadoEn.desc()),
    index('idx_uso_persona').on(t.tenantId, t.usuarioId, t.creadoEn.desc()),
  ],
);

/**
 * La HUELLA de lo que hizo el asistente: una fila por llamada a una herramienta de escritura (hecha, pendiente de confirmar o
 * rechazada), con los argumentos en claro y el antes/después, para que una persona pueda evaluar si actuó bien. Solo inserción;
 * sin llaves foráneas a la conversación (sobrevive al borrado del chat y a la retención de 90 días, como `core.auditoria`).
 */
export const agenteAcciones = core.table(
  'agente_acciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    usuarioId: text('usuario_id').notNull(),
    modelo: text('modelo').notNull(),
    conversacionId: uuid('conversacion_id').notNull(),
    turnoId: uuid('turno_id').notNull(),
    ronda: integer('ronda').notNull(),
    indice: integer('indice').notNull(),
    herramienta: text('herramienta').notNull(),
    /** `directo`: lo hizo sola · `confirmada`: crítica con su confirmación propia · `propuesta`: quedó como borrador. */
    politica: text('politica').notNull(),
    resultado: text('resultado').notNull(),
    codigo: text('codigo'),
    hashArgs: text('hash_args').notNull(),
    args: jsonb('args').notNull().default(sql`'{}'::jsonb`),
    /** El estado sobre el que se confirmó (el resumen de la herramienta) o lo que había antes de editar. */
    antes: jsonb('antes'),
    despues: jsonb('despues'),
    resumenConfirmado: text('resumen_confirmado'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('agente_accion_politica', sql`${t.politica} IN ('directo', 'confirmada', 'propuesta')`),
    check('agente_accion_resultado', sql`${t.resultado} IN ('ok', 'rechazada', 'pendiente_confirmacion', 'propuesta')`),
    index('idx_agente_acciones_empresa').on(t.tenantId, t.creadoEn.desc()),
    index('idx_agente_acciones_herramienta').on(t.tenantId, t.herramienta, t.creadoEn.desc()),
    index('idx_agente_acciones_turno').on(t.tenantId, t.turnoId),
  ],
);

/**
 * Lo que el asistente va aprendiendo: errores que no debe repetir, correcciones de la persona, alias y preferencias. La persona
 * las ve, las corrige y las archiva. Una lección que escribió el modelo nace `por_revisar` y no se usa hasta que una persona la apruebe.
 */
export const agenteLecciones = core.table(
  'agente_lecciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    /** `persona`: solo la ve y la usa quien la creó · `empresa`: la usa el asistente de toda la empresa. */
    alcance: text('alcance').notNull().default('persona'),
    usuarioId: text('usuario_id').notNull(),
    tipo: text('tipo').notNull(),
    /** Identifica la lección para no repetirla: la misma clave en el mismo alcance suma un uso en vez de crear otra fila. */
    clave: text('clave').notNull(),
    texto: text('texto').notNull(),
    herramienta: text('herramienta'),
    entidadTipo: text('entidad_tipo'),
    entidadId: text('entidad_id'),
    estado: text('estado').notNull().default('por_revisar'),
    /** Quién escribió el texto: la persona, el sistema (plantilla) o el modelo. */
    origen: text('origen').notNull(),
    conversacionId: uuid('conversacion_id'),
    turnoId: uuid('turno_id'),
    usos: integer('usos').notNull().default(0),
    ultimaVez: timestamp('ultima_vez', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('agente_lecciones_clave').on(t.tenantId, t.alcance, t.usuarioId, t.clave),
    check('agente_leccion_alcance', sql`${t.alcance} IN ('persona', 'empresa')`),
    check('agente_leccion_tipo', sql`${t.tipo} IN ('error_de_herramienta', 'correccion', 'preferencia', 'alias', 'regla_del_erp')`),
    check('agente_leccion_estado', sql`${t.estado} IN ('por_revisar', 'vigente', 'archivada')`),
    check('agente_leccion_origen', sql`${t.origen} IN ('persona', 'sistema', 'modelo')`),
    check('agente_leccion_texto', sql`length(${t.texto}) between 1 and 280`),
    check('agente_leccion_clave', sql`length(${t.clave}) between 1 and 160`),
    index('idx_agente_lecciones_uso').on(t.tenantId, t.estado, t.usos.desc()),
  ],
);
