// Ejemplos de la prueba de aislamiento (insert mínimo por tabla, `$1` = empresa) con su modo de acceso para `capaz_app`.
// Separado de `aislamiento.int.spec.ts` para no pasar el máximo de 500 líneas. Orden: la tabla referida antes que la que la referencia.

export type Modo = 'completo' | 'lectura' | 'insercion' | 'plataforma';
export const EJEMPLOS: Record<string, { sql: string; modo: Modo }> = {
  'core.empresa_config': { sql: `insert into core.empresa_config (tenant_id) values ($1)`, modo: 'completo' },
  'core.empresa_modulos': { sql: `insert into core.empresa_modulos (tenant_id, modulo) values ($1, 'ejemplo')`, modo: 'lectura' },
  'core.empresa_modulos_eventos': {
    sql: `insert into core.empresa_modulos_eventos (tenant_id, modulo, evento, estado_nuevo) values ($1, 'ejemplo', 'alta', 'activo')`,
    modo: 'lectura',
  },
  'core.empresa_cuenta': { sql: `insert into core.empresa_cuenta (tenant_id) values ($1)`, modo: 'lectura' },
  'core.empresa_cuenta_eventos': {
    sql: `insert into core.empresa_cuenta_eventos (tenant_id, evento, estado_nuevo) values ($1, 'alta', 'activa')`,
    modo: 'lectura',
  },
  // Solo plataforma: capaz_app no tiene ningún permiso (ni lectura); se prueba aparte, no con las pruebas genéricas.
  'core.empresa_ficha': { sql: `insert into core.empresa_ficha (tenant_id, actualizado_por) values ($1, 'op1')`, modo: 'plataforma' },
  'core.usuario_modulos': { sql: `insert into core.usuario_modulos (tenant_id, usuario_id, modulo) values ($1, 'u1', 'ejemplo')`, modo: 'completo' },
  'core.solicitudes_modulo': {
    sql: `insert into core.solicitudes_modulo (tenant_id, modulo, usuario_id) values ($1, 'ejemplo', 'u1')`,
    modo: 'insercion',
  },
  'core.auditoria': {
    sql: `insert into core.auditoria (tenant_id, usuario_id, modulo, herramienta, canal, resultado, hash_args, request_id) values ($1, 'u1', 'core', 'ejemplo', 'ui', 'ok', 'h', 'r1')`,
    modo: 'insercion',
  },
  'core.confirmaciones_usadas': { sql: `insert into core.confirmaciones_usadas (tenant_id, jti) values ($1, 'jti-1')`, modo: 'insercion' },
  'core.idempotencia': { sql: `insert into core.idempotencia (tenant_id, clave, herramienta, hash_args) values ($1, 'c1', 'h', 'x')`, modo: 'completo' },
  'core.eventos_salida': { sql: `insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, 'ejemplo.creado', '{"x":1}')`, modo: 'insercion' },
  'core.eventos_procesados': {
    sql: `insert into core.eventos_procesados (tenant_id, evento_id, consumidor) values ($1, '00000000-0000-7000-8000-000000000001', 'c1')`,
    modo: 'insercion',
  },
  'core.contadores': { sql: `insert into core.contadores (tenant_id, clave, serie, anio) values ($1, 'ejemplo', '', 2026)`, modo: 'completo' },
  'core.clientes': { sql: `insert into core.clientes (id, tenant_id, clase, nombre, nombre_normalizado, creado_por) values (md5($1::text || 'cl')::uuid, $1, 'persona', 'Ana', 'ana', 'u1')`, modo: 'completo' },
  'core.productos': { sql: `insert into core.productos (id, tenant_id, nombre, nombre_normalizado, tipo, creado_por) values (md5($1::text || 'pr')::uuid, $1, 'Tarjeta', 'tarjeta', 'producto', 'u1')`, modo: 'completo' },
  'core.sucursales': { sql: `insert into core.sucursales (id, tenant_id, codigo, nombre) values (md5($1::text || 'su')::uuid, $1, 'LIM', 'Lima')`, modo: 'completo' },
  'core.conexiones': { sql: `insert into core.conexiones (id, tenant_id, conector, creado_por) values (md5($1::text || 'c1')::uuid, $1, 'ejemplo', 'u1')`, modo: 'completo' },
  'core.referencias_externas': { sql: `insert into core.referencias_externas (tenant_id, conector, entidad, id_interno, id_externo) values ($1, 'ejemplo', 'cliente', 'i1', 'x1')`, modo: 'completo' },
  'core.sincronizaciones': {
    sql: `insert into core.sincronizaciones (tenant_id, conector, conexion_id, tipo, entidad, iniciado_por) values ($1, 'ejemplo', md5($1::text || 'c1')::uuid, 'importar', 'cliente', 'u1')`,
    modo: 'completo',
  },
  'core.claves_api': {
    sql: `insert into core.claves_api (hash, id, tenant_id, nombre, prefijo, creado_por) values ('hash-' || $1::text, md5($1::text || 'a1')::uuid, $1, 'Clave', 'cpz_', 'u1')`,
    modo: 'completo',
  },
  'core.webhooks_entrantes': {
    sql: `insert into core.webhooks_entrantes (tenant_id, clave_api_id, evento, clave_idempotencia, carga) values ($1, md5($1::text || 'a1')::uuid, 'ejemplo.recibido', 'k1', '{}')`,
    modo: 'completo',
  },
  'core.webhooks_salientes': {
    sql: `insert into core.webhooks_salientes (id, tenant_id, nombre, url, eventos, secreto_cifrado, clave_version, creado_por) values (md5($1::text || 'b1')::uuid, $1, 'Hook', 'https://ejemplo.test/h', array['x'], 'cifrado', 1, 'u1')`,
    modo: 'completo',
  },
  'core.webhooks_envios': {
    sql: `insert into core.webhooks_envios (tenant_id, webhook_id, evento_id, tipo) values ($1, md5($1::text || 'b1')::uuid, '00000000-0000-7000-8000-000000000002', 'ejemplo.creado')`,
    modo: 'completo',
  },
  'core.borradores': {
    sql: `insert into core.borradores (tenant_id, herramienta, modulo, args, args_originales, resumen, origen, propuesto_por) values ($1, 'ejemplo', 'core', '{}', '{}', 'Resumen', 'texto', 'u1')`,
    modo: 'completo',
  },
  'core.reglas_automaticas': {
    sql: `insert into core.reglas_automaticas (id, tenant_id, nombre, disparador_tipo, disparador, acciones, creado_por) values (md5($1::text || 'd1')::uuid, $1, 'Regla', 'manual', '{}', '[]', 'u1')`,
    modo: 'completo',
  },
  'core.reglas_ejecuciones': {
    sql: `insert into core.reglas_ejecuciones (tenant_id, regla_id, disparado_por, resultado) values ($1, md5($1::text || 'd1')::uuid, '{}', 'ok')`,
    modo: 'insercion',
  },
  'registro.cuentas': {
    sql: `insert into registro.cuentas (id, tenant_id, nombre, nombre_normalizado, tipo, creado_por) values (md5($1::text || 'r1')::uuid, $1, 'Caja', 'caja', 'caja', 'u1')`,
    modo: 'completo',
  },
  'registro.categorias': {
    sql: `insert into registro.categorias (id, tenant_id, nombre, nombre_normalizado, tipo, creado_por) values (md5($1::text || 'r2')::uuid, $1, 'Ventas', 'ventas', 'ingreso', 'u1')`,
    modo: 'completo',
  },
  'registro.deudas': {
    sql: `insert into registro.deudas (id, tenant_id, numero, anio, tipo, contacto_id, concepto, total_centimos, fecha, creado_por) values (md5($1::text || 'r3')::uuid, $1, 1, 2026, 'por_cobrar', md5($1::text || 'cl')::uuid, 'Venta', 1000, date '2026-01-01', 'u1')`,
    modo: 'completo',
  },
  'registro.movimientos': {
    sql: `insert into registro.movimientos (tenant_id, numero, anio, tipo, fecha, monto_centimos, cuenta_id, creado_por) values ($1, 1, 2026, 'ingreso', date '2026-01-01', 500, md5($1::text || 'r1')::uuid, 'u1')`,
    modo: 'insercion',
  },
  'crm.etapas': {
    sql: `insert into crm.etapas (id, tenant_id, nombre, nombre_normalizado, orden, creado_por) values (md5($1::text || 'c1')::uuid, $1, 'Nuevo', 'nuevo', 0, 'u1')`,
    modo: 'completo',
  },
  'crm.oportunidades': {
    sql: `insert into crm.oportunidades (id, tenant_id, numero, anio, titulo, cliente_id, etapa_id, creado_por) values (md5($1::text || 'c2')::uuid, $1, 1, 2026, 'Oportunidad', md5($1::text || 'cl')::uuid, md5($1::text || 'c1')::uuid, 'u1')`,
    modo: 'completo',
  },
  'crm.actividades': {
    sql: `insert into crm.actividades (tenant_id, oportunidad_id, tipo, asunto, creado_por) values ($1, md5($1::text || 'c2')::uuid, 'nota', 'Llamar', 'u1')`,
    modo: 'completo',
  },
  'ordenes.pedidos': {
    sql: `insert into ordenes.pedidos (id, tenant_id, cliente_id, fecha, creado_por) values (md5($1::text || 'o1')::uuid, $1, md5($1::text || 'cl')::uuid, date '2026-01-01', 'u1')`,
    modo: 'completo',
  },
  'ordenes.pedido_lineas': {
    sql: `insert into ordenes.pedido_lineas (tenant_id, pedido_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, importe_centimos) values ($1, md5($1::text || 'o1')::uuid, 0, 'Línea', 1000, 1000, 1)`,
    modo: 'completo',
  },
  'ordenes.pedido_eventos': {
    sql: `insert into ordenes.pedido_eventos (tenant_id, pedido_id, tipo, usuario_id) values ($1, md5($1::text || 'o1')::uuid, 'creado', 'u1')`,
    modo: 'insercion',
  },
  'insumos.articulos': {
    sql: `insert into insumos.articulos (id, tenant_id, producto_id, creado_por) values (md5($1::text || 'i1')::uuid, $1, md5($1::text || 'pr')::uuid, 'u1')`,
    modo: 'completo',
  },
  'insumos.existencias': {
    sql: `insert into insumos.existencias (id, tenant_id, articulo_id, sucursal_id, cantidad_milesimas, creado_por) values (md5($1::text || 'i2')::uuid, $1, md5($1::text || 'i1')::uuid, md5($1::text || 'su')::uuid, 5000, 'u1')`,
    modo: 'completo',
  },
  'insumos.movimientos': {
    sql: `insert into insumos.movimientos (tenant_id, articulo_id, sucursal_id, tipo, cantidad_milesimas, existencia_resultante_milesimas, creado_por) values ($1, md5($1::text || 'i1')::uuid, md5($1::text || 'su')::uuid, 'entrada', 5000, 5000, 'u1')`,
    modo: 'insercion',
  },
  'compras.ordenes': {
    sql: `insert into compras.ordenes (id, tenant_id, proveedor_id, fecha, creado_por) values (md5($1::text || 'k1')::uuid, $1, md5($1::text || 'cl')::uuid, date '2026-01-01', 'u1')`,
    modo: 'completo',
  },
  'compras.orden_lineas': {
    sql: `insert into compras.orden_lineas (id, tenant_id, orden_id, posicion, descripcion, cantidad_milesimas, costo_unitario_milesimas, importe_centimos) values (md5($1::text || 'k2')::uuid, $1, md5($1::text || 'k1')::uuid, 0, 'Línea', 1000, 1000, 1)`,
    modo: 'completo',
  },
  'compras.recepciones': {
    sql: `insert into compras.recepciones (id, tenant_id, orden_id, numero, fecha, creado_por) values (md5($1::text || 'k3')::uuid, $1, md5($1::text || 'k1')::uuid, 1, date '2026-01-02', 'u1')`,
    modo: 'insercion',
  },
  'compras.recepcion_lineas': {
    sql: `insert into compras.recepcion_lineas (tenant_id, recepcion_id, orden_linea_id, cantidad_milesimas) values ($1, md5($1::text || 'k3')::uuid, md5($1::text || 'k2')::uuid, 500)`,
    modo: 'insercion',
  },
  'personal.colaboradores': {
    sql: `insert into personal.colaboradores (id, tenant_id, nombre, nombre_normalizado, creado_por) values (md5($1::text || 'p1')::uuid, $1, 'Luis', 'luis', 'u1')`,
    modo: 'completo',
  },
  'personal.asistencias': {
    sql: `insert into personal.asistencias (tenant_id, colaborador_id, fecha, creado_por) values ($1, md5($1::text || 'p1')::uuid, date '2026-01-01', 'u1')`,
    modo: 'completo',
  },
  'personal.adelantos': {
    sql: `insert into personal.adelantos (tenant_id, numero, anio, colaborador_id, monto_centimos, fecha, creado_por) values ($1, 1, 2026, md5($1::text || 'p1')::uuid, 5000, date '2026-01-01', 'u1')`,
    modo: 'insercion',
  },
  'core.reglas_disparos': { sql: `insert into core.reglas_disparos (tenant_id, regla_id, clave) values ($1, md5($1::text || 'd1')::uuid, 'k1')`, modo: 'insercion' },
  'cotizador.configuracion': { sql: `insert into cotizador.configuracion (tenant_id) values ($1)`, modo: 'completo' },
  'cotizador.listas_de_precio': {
    sql: `insert into cotizador.listas_de_precio (id, tenant_id, nombre, nombre_normalizado, p100_centimos, p1000_centimos, p5000_centimos, creado_por) values (md5($1::text || 'q1')::uuid, $1, 'Volantes A5', 'volantes a5', 19000, 58000, 120000, 'u1')`,
    modo: 'completo',
  },
  'cotizador.ajustes_de_cliente': {
    sql: `insert into cotizador.ajustes_de_cliente (tenant_id, cliente_id, porcentaje, creado_por) values ($1, md5($1::text || 'cl')::uuid, -5, 'u1')`,
    modo: 'completo',
  },
  'cotizador.cotizaciones': {
    sql: `insert into cotizador.cotizaciones (id, tenant_id, titulo, creado_por) values (md5($1::text || 'q2')::uuid, $1, 'Volantes', 'u1')`,
    modo: 'completo',
  },
  'cotizador.versiones': {
    sql: `insert into cotizador.versiones (id, tenant_id, cotizacion_id, version, creado_por) values (md5($1::text || 'q3')::uuid, $1, md5($1::text || 'q2')::uuid, 1, 'u1')`,
    modo: 'completo',
  },
  'cotizador.version_lineas': {
    sql: `insert into cotizador.version_lineas (tenant_id, version_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, importe_centimos, igv_centimos, total_centimos) values ($1, md5($1::text || 'q3')::uuid, 0, 'Línea', 1000, 1000, 100, 18, 118)`,
    modo: 'completo',
  },
  'cotizador.eventos': {
    sql: `insert into cotizador.eventos (tenant_id, cotizacion_id, version, tipo, usuario_id) values ($1, md5($1::text || 'q2')::uuid, 1, 'creada', 'u1')`,
    modo: 'insercion',
  },
};
