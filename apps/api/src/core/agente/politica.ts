import type { Criticidad, ModoDeEscritura } from '@capaz/shared';

// La política del asistente: qué hace solo, qué solo propone y qué no puede hacer. Es CÓDIGO y no texto del prompt, así
// que ni un modelo engañado por un texto dentro de un dato (un nombre de cliente, una nota) puede saltársela.
// Las listas son cadenas y no importaciones de los módulos (regla 7); una prueba de integración las contrasta con el registro real.
// Origen: docs/AGENTE-AUDITORIA-HERRAMIENTAS.md §3 y §4.

/**
 * `directo`: se ejecuta · `dinero`: se ejecuta SI pasa las guardas de dinero (si no, borrador) · `confirmada`: acción crítica con la
 * confirmación propia del asistente · `borrador`: la aprueba una persona · `prohibido`: no se puede.
 */
export type Politica = 'directo' | 'dinero' | 'confirmada' | 'borrador' | 'prohibido';

export type DatosDeHerramienta = { nombre: string; criticidad: Criticidad; mueveDinero: boolean };

/** Nunca por el asistente: secretos y llaves, miembros y roles, conexiones y webhooks, reglas, configuración fiscal, cargas masivas y resolver borradores. */
export const PROHIBIDAS: ReadonlySet<string> = new Set([
  'borrador_aprobar', 'borrador_corregir', 'borrador_descartar', 'clave_api_crear', 'clave_api_revocar',
  'conexion_configurar', 'conexion_desactivar', 'empresa_actualizar_configuracion', 'importar_csv_aplicar',
  'invitacion_anular', 'invitacion_crear', 'miembro_asignar_modulo', 'miembro_cambiar_rol', 'miembro_quitar',
  'pedidos_importar_historial', 'regla_activar', 'regla_desactivar', 'regla_ejecutar', 'regla_guardar',
  'regla_probar', 'webhook_envio_reintentar', 'webhooks_salientes_archivar', 'webhooks_salientes_crear',
  'webhooks_salientes_editar', 'agente_configurar', 'memoria_aprobar', 'memoria_archivar', 'memoria_editar',
]);

/** Crear o editar lo que nace o sigue en borrador, datos maestros reversibles y cambios de estado que se pueden deshacer. */
const DIRECTAS_DE_LA_AUDITORIA: ReadonlySet<string> = new Set([
  'actividad_completar', 'actividad_crear', 'articulo_activar', 'articulo_archivar', 'articulo_editar',
  'captura_proponer', 'categoria_archivar', 'categoria_crear', 'categoria_editar', 'categorias_producto_archivar',
  'categorias_producto_guardar', 'clientes_archivar', 'clientes_contacto_guardar', 'clientes_crear',
  'clientes_direccion_guardar', 'clientes_editar', 'clientes_restaurar', 'compra_crear', 'compra_editar',
  'conteo_abrir', 'conteo_registrar', 'cotizacion_aceptar', 'cotizacion_crear', 'cotizacion_duplicar',
  'cotizacion_editar', 'cotizacion_marcar_enviada', 'cotizacion_nueva_version', 'cotizacion_rechazar',
  'cotizador_iniciar', 'crm_iniciar', 'cuadro_fijar_columnas_a_enviar', 'cuadro_fijar_costo_directo',
  'cuadro_fijar_imposicion', 'cuadro_fijar_precio_final', 'cuadro_fijar_trabajo', 'cuadro_fijar_utilidad',
  'cuadro_iniciar', 'cuadro_item_agregar', 'cuadro_item_editar', 'cuadro_linea_agregar', 'cuadro_linea_editar',
  'oportunidad_crear', 'oportunidad_editar', 'oportunidad_ganar', 'oportunidad_mover', 'oportunidad_perder',
  'oportunidad_reabrir', 'pedido_anotar', 'pedido_cambiar_estado', 'pedido_crear', 'pedido_editar',
  'pedido_editar_datos', 'produccion_orden_cobrar', 'produccion_orden_estado', 'productos_archivar',
  'productos_crear', 'productos_editar', 'productos_restaurar', 'productos_unidad_guardar', 'registro_iniciar',
  'solicitud_convertir', 'solicitud_crear', 'sucursal_editar',
]);

/**
 * Ampliación del 2026-11-24 (decisión de Moisés: «si fallamos, que sea por exceso»): configuración del taller, datos de personal,
 * borrados chicos, existencias, documentos que toman número y la confirmación de pedidos. Todas dejan huella en la auditoría.
 * `pedido_confirmar` y `compra_recibir` se ejecutan directo: Finanzas e Inventario proponen sus efectos como borrador (R5). Ojo: confirmar consume el número del documento y deshacerlo es cancelar (crítica, con su confirmación): por eso el asistente confirma solo lo que la persona pidió.
 */
const DIRECTAS_AMPLIADAS: ReadonlySet<string> = new Set([
  'memoria_anotar', 'compra_recibir', 'asistencia_marcar', 'clientes_contacto_eliminar', 'clientes_direccion_eliminar', 'colaborador_archivar',
  'colaborador_crear', 'colaborador_editar', 'colaborador_restaurar', 'compra_enviar', 'conteo_anular',
  'contrato_terminar', 'cuadro_item_quitar', 'cuadro_linea_quitar', 'cuenta_archivar', 'cuenta_editar',
  'cuenta_marcar_principal', 'enlace_revocar', 'etapa_archivar', 'etapa_crear', 'etapa_editar', 'etapas_ordenar',
  'existencia_mover', 'existencias_recibir', 'factura_anular', 'factura_registrar', 'formato_pliego_archivar',
  'formato_pliego_crear', 'formato_pliego_editar', 'formato_pliego_restaurar', 'guia_emitir', 'item_cuadro_archivar',
  'item_cuadro_crear', 'item_cuadro_editar', 'item_cuadro_restaurar', 'items_cuadro_reordenar', 'maquina_archivar',
  'maquina_crear', 'maquina_editar', 'maquina_restaurar', 'pedido_confirmar', 'productos_unidad_eliminar',
  'solicitud_anular', 'solicitud_enviar', 'sucursal_archivar', 'sucursal_crear', 'transferencia_crear',
  'vacaciones_anular', 'vacaciones_resolver', 'vacaciones_solicitar',
]);

export const DIRECTAS: ReadonlySet<string> = new Set([...DIRECTAS_DE_LA_AUDITORIA, ...DIRECTAS_AMPLIADAS]);

/**
 * Siempre las aprueba una persona (tarjeta): masivas, irreversibles o que salen de la empresa. Lista PROPUESTA; la confirma Moisés.
 * Todas son críticas o están pendientes de serlo: mientras no haya confirmación propia del asistente (T3/T6) quedan como borrador.
 */
export const SIEMPRE_PERSONA: ReadonlySet<string> = new Set([
  'clientes_fusionar', 'deudas_copiar_fijos', 'enlace_generar', 'listas_precio_ajustar_en_bloque',
  'modulo_solicitar', 'semana_cerrar', 'sucursal_marcar_principal', 'taller_sembrar',
]);

/**
 * Dinero, precios, costos y sueldos que NO son críticos: el asistente los moverá directo, con huella y guardas de dinero
 * (T6). Hasta que existan esas guardas siguen siendo borrador. Una prueba exige que cada herramienta esté en una sola lista.
 */
export const DINERO: ReadonlySet<string> = new Set([
  'adelanto_registrar', 'ajuste_cliente_fijar', 'clientes_comercial_guardar', 'contrato_crear',
  'cotizador_configurar', 'cuenta_crear', 'cuentas_transferir', 'deuda_abonar', 'deuda_ajustar', 'deuda_crear',
  'deuda_crear_con_adelanto', 'deuda_editar', 'lista_precio_archivar', 'lista_precio_crear',
  'lista_precio_restaurar', 'movimiento_registrar', 'pedido_corregir', 'produccion_orden_anular',
  'produccion_orden_crear', 'produccion_orden_editar', 'productos_ficha_guardar', 'solicitud_resolver',
  'tarifa_archivar', 'tarifa_crear', 'tarifa_restaurar',
]);

/** Lecturas que el asistente no ofrece en la primera versión: vuelcan datos en bloque o son configuración de integraciones. */
export const LECTURAS_EXCLUIDAS: ReadonlySet<string> = new Set([
  'agente_acciones_listar', 'auditoria_listar', 'claves_api_listar', 'conectores_listar', 'conexion_ver', 'exportar_csv',
  'importar_csv_previsualizar', 'invitaciones_listar', 'pedidos_importar_historial_previsualizar',
  'reportes_exportar_csv', 'webhook_envios_listar', 'webhooks_salientes_listar',
]);

/** Solo propone borradores con las reglas de dictado: no cambia nada por sí sola. */
const SOLO_PROPONE = 'captura_proponer';

function argumentosComoObjeto(args: unknown): Record<string, unknown> {
  return args !== null && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
}

/** Dos excepciones por argumento: entregar dispara la propuesta de cobro, y cambiar el precio de un producto mueve dinero. */
function exceptuadaPorArgumento(nombre: string, args: unknown): boolean {
  const a = argumentosComoObjeto(args);
  if (nombre === 'pedido_cambiar_estado' || nombre === 'produccion_orden_estado') return a.estado === 'entregado';
  if (nombre === 'productos_editar') return a.precioUnitarioMilesimas !== undefined;
  return false;
}

/**
 * Decide qué hace el asistente con una llamada. Orden de las reglas:
 *   1. Una lectura se ejecuta, salvo las excluidas.
 *   2. Lo prohibido, prohibido.
 *   3. `captura_proponer` solo propone borradores: siempre directo.
 *   4. Sin permiso de escritura (`ninguna`), todo lo que cambia algo queda prohibido.
 *   5. Lo que decide una persona (`SIEMPRE_PERSONA`) y todo con el freno de la empresa puesto (`borradores`): borrador.
 *   6. Lo crítico: confirmación propia del asistente (token de un solo uso, huella en la bitácora).
 *   7. El dinero: se ejecuta si pasa las guardas (`dinero`); si no, borrador.
 *   8. Lo de la lista de directas se ejecuta (salvo la excepción por argumento).
 *   9. Todo lo demás, borrador: una herramienta nueva cae aquí y nunca se ejecuta sola.
 */
export function politicaDe(h: DatosDeHerramienta, args: unknown, modo: ModoDeEscritura): Politica {
  if (h.criticidad === 'lectura') return LECTURAS_EXCLUIDAS.has(h.nombre) ? 'prohibido' : 'directo';
  if (PROHIBIDAS.has(h.nombre)) return 'prohibido';
  if (h.nombre === SOLO_PROPONE) return 'directo';
  if (modo === 'ninguna') return 'prohibido';
  if (modo === 'borradores' || SIEMPRE_PERSONA.has(h.nombre)) return 'borrador';
  if (h.criticidad === 'critica') return 'confirmada';
  if (h.mueveDinero || DINERO.has(h.nombre)) return 'dinero';
  if (DIRECTAS.has(h.nombre) && !exceptuadaPorArgumento(h.nombre, args)) return 'directo';
  return 'borrador';
}

/**
 * Críticas que mueven dinero o precios: aunque pidan la confirmación propia, pasan ANTES por las guardas de dinero (fecha de hoy, tope por
 * operación y por día, no repetir). Lo que no pasa queda como borrador. Una prueba exige que sean críticas y existan.
 */
export const CRITICAS_DE_DINERO: ReadonlySet<string> = new Set([
  'adelanto_anular', 'cuadro_guardar_referencias', 'deuda_anular', 'existencia_ajustar', 'lista_precio_editar', 'movimiento_anular',
  'movimiento_corregir', 'movimiento_restaurar', 'tarifa_editar', 'venta_corregir',
]);
