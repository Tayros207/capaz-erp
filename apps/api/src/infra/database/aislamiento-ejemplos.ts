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
  'core.cliente_comercial': { sql: `insert into core.cliente_comercial (tenant_id, cliente_id, actualizado_por) values ($1, md5($1::text || 'cl')::uuid, 'u1')`, modo: 'completo' },
  'core.cliente_contactos': { sql: `insert into core.cliente_contactos (id, tenant_id, cliente_id, nombre, creado_por) values (md5($1::text || 'cc')::uuid, $1, md5($1::text || 'cl')::uuid, 'Ana', 'u1')`, modo: 'completo' },
  'core.cliente_direcciones': { sql: `insert into core.cliente_direcciones (id, tenant_id, cliente_id, direccion, creado_por) values (md5($1::text || 'cd')::uuid, $1, md5($1::text || 'cl')::uuid, 'Av. Sol 1', 'u1')`, modo: 'completo' },
  'core.categorias_producto': { sql: `insert into core.categorias_producto (id, tenant_id, nombre, nombre_normalizado, creado_por) values (md5($1::text || 'ca')::uuid, $1, 'Papel', 'papel', 'u1')`, modo: 'completo' },
  'core.producto_ficha': { sql: `insert into core.producto_ficha (tenant_id, producto_id, actualizado_por) values ($1, md5($1::text || 'pr')::uuid, 'u1')`, modo: 'completo' },
  'core.producto_unidades': { sql: `insert into core.producto_unidades (id, tenant_id, producto_id, unidad, factor_milesimas, creado_por) values (md5($1::text || 'pu')::uuid, $1, md5($1::text || 'pr')::uuid, 'caja', 12000, 'u1')`, modo: 'completo' },
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
  'ordenes.pedido_versiones': {
    sql: `insert into ordenes.pedido_versiones (tenant_id, pedido_id, version, foto, motivo_codigo, creado_por) values ($1, md5($1::text || 'o1')::uuid, 1, '{}'::jsonb, 'otro', 'u1')`,
    modo: 'insercion',
  },
  'registro.deuda_ajustes': {
    sql: `insert into registro.deuda_ajustes (tenant_id, deuda_id, monto_centimos, total_anterior_centimos, total_nuevo_centimos, motivo_codigo, creado_por) values ($1, md5($1::text || 'r3')::uuid, 100, 1000, 1100, 'otro', 'u1')`,
    modo: 'insercion',
  },
  'registro.cierres': {
    sql: `insert into registro.cierres (tenant_id, desde, hasta, saldos, cerrado_por) values ($1, date '2026-11-16', date '2026-11-21', '[]'::jsonb, 'u1')`,
    modo: 'insercion',
  },
  'ordenes.guias': {
    sql: `insert into ordenes.guias (id, tenant_id, serie, numero, cliente_id, destinatario_nombre, fecha_emision, fecha_traslado, punto_partida, punto_llegada, motivo, modalidad, creado_por) values (md5($1::text || 'g1')::uuid, $1, 'G001', 1, md5($1::text || 'cl')::uuid, 'Cliente', date '2026-01-01', date '2026-01-01', 'Av. A 1', 'Jr. B 2', 'venta', 'privado', 'u1')`,
    modo: 'insercion',
  },
  'ordenes.guia_lineas': {
    sql: `insert into ordenes.guia_lineas (tenant_id, guia_id, posicion, descripcion, cantidad_milesimas) values ($1, md5($1::text || 'g1')::uuid, 0, 'Línea', 1000)`,
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
  'insumos.transferencias': {
    sql: `with s as (insert into core.sucursales (id, tenant_id, codigo, nombre) values (md5($1::text || 'su2')::uuid, $1, 'CUS', 'Cusco') returning id) insert into insumos.transferencias (id, tenant_id, numero, anio, origen_sucursal_id, destino_sucursal_id, creado_por) select md5($1::text || 'tf')::uuid, $1, 1, 2026, md5($1::text || 'su')::uuid, s.id, 'u1' from s`,
    modo: 'insercion',
  },
  'insumos.transferencia_lineas': {
    sql: `insert into insumos.transferencia_lineas (id, tenant_id, transferencia_id, articulo_id, cantidad_milesimas) values (md5($1::text || 'tl')::uuid, $1, md5($1::text || 'tf')::uuid, md5($1::text || 'i1')::uuid, 1000)`,
    modo: 'insercion',
  },
  'insumos.conteos': {
    sql: `insert into insumos.conteos (id, tenant_id, numero, anio, sucursal_id, creado_por) values (md5($1::text || 'ct')::uuid, $1, 1, 2026, md5($1::text || 'su')::uuid, 'u1')`,
    modo: 'completo',
  },
  'insumos.conteo_lineas': {
    sql: `insert into insumos.conteo_lineas (id, tenant_id, conteo_id, articulo_id, sistema_milesimas) values (md5($1::text || 'cl')::uuid, $1, md5($1::text || 'ct')::uuid, md5($1::text || 'i1')::uuid, 5000)`,
    modo: 'completo',
  },
  'compras.solicitudes': {
    sql: `insert into compras.solicitudes (id, tenant_id, fecha, solicitado_por, creado_por) values (md5($1::text || 'so')::uuid, $1, '2026-03-01', 'u1', 'u1')`,
    modo: 'completo',
  },
  'compras.solicitud_lineas': {
    sql: `insert into compras.solicitud_lineas (id, tenant_id, solicitud_id, posicion, descripcion, cantidad_milesimas) values (md5($1::text || 'sl')::uuid, $1, md5($1::text || 'so')::uuid, 0, 'Papel', 1000)`,
    modo: 'completo',
  },
  'compras.facturas': {
    sql: `insert into compras.facturas (id, tenant_id, proveedor_id, serie, numero, fecha, subtotal_centimos, igv_centimos, total_centimos, creado_por) values (md5($1::text || 'fa')::uuid, $1, md5($1::text || 'cl')::uuid, 'F001', '1', '2026-03-01', 1000, 180, 1180, 'u1')`,
    modo: 'completo',
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
  'personal.contratos': {
    sql: `insert into personal.contratos (id, tenant_id, colaborador_id, tipo, inicio, creado_por) values (md5($1::text || 'pc')::uuid, $1, md5($1::text || 'p1')::uuid, 'indeterminado', date '2026-01-01', 'u1')`,
    modo: 'completo',
  },
  'personal.vacaciones': {
    sql: `insert into personal.vacaciones (id, tenant_id, colaborador_id, desde, hasta, dias, creado_por) values (md5($1::text || 'pv')::uuid, $1, md5($1::text || 'p1')::uuid, date '2026-02-01', date '2026-02-07', 7, 'u1')`,
    modo: 'completo',
  },
  'produccion.ordenes': {
    sql: `insert into produccion.ordenes (id, tenant_id, numero, anio, fecha, cliente_id, total_centimos, creado_por) values (md5($1::text || 'op')::uuid, $1, 1, 2026, date '2026-03-01', md5($1::text || 'cl')::uuid, 24000, 'u1')`,
    modo: 'completo',
  },
  'produccion.orden_items': {
    sql: `insert into produccion.orden_items (id, tenant_id, orden_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, subtotal_centimos) values (md5($1::text || 'oi')::uuid, $1, md5($1::text || 'op')::uuid, 0, 'Volantes', 1000, 24000, 2400)`,
    modo: 'completo',
  },
  'produccion.orden_eventos': {
    sql: `insert into produccion.orden_eventos (id, tenant_id, orden_id, tipo, estado_nuevo, usuario_id) values (md5($1::text || 'oe')::uuid, $1, md5($1::text || 'op')::uuid, 'creada', 'pendiente', 'u1')`,
    modo: 'insercion',
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
  'cotizador.formatos_pliego': {
    sql: `insert into cotizador.formatos_pliego (tenant_id, nombre, nombre_normalizado, ancho_cm, alto_cm, tipo, creado_por) values ($1, 'Pliego 70x100', 'pliego 70x100', 70, 100, 'madre', 'u1')`,
    modo: 'completo',
  },
  'cotizador.maquinas': {
    sql: `insert into cotizador.maquinas (tenant_id, nombre, nombre_normalizado, formato_max_ancho_cm, formato_max_alto_cm, pinza_cm, sangrado_cm, calle_cm, creado_por) values ($1, 'Offset 52', 'offset 52', 52, 36, 1, 0.3, 0.5, 'u1')`,
    modo: 'completo',
  },
  'cotizador.tarifas': {
    sql: `insert into cotizador.tarifas (tenant_id, factor, nombre, nombre_normalizado, unidad, costo_unitario, escala_por_defecto, creado_por) values ($1, 'material', 'Couché 150', 'couche 150', 'pliego', 1.2, 'por_pliego', 'u1')`,
    modo: 'completo',
  },
  'cotizador.items_del_cuadro': {
    sql: `insert into cotizador.items_del_cuadro (tenant_id, nombre, nombre_normalizado, factor, despues_de, posicion, creado_por) values ($1, 'Laminado', 'laminado', 'acabado', 'impresion', 0, 'u1')`,
    modo: 'completo',
  },
  'cotizador.enlaces': {
    sql: `insert into cotizador.enlaces (tenant_id, cotizacion_id, version, token_hash, vence_en, creado_por) values ($1, md5($1::text || 'q2')::uuid, 1, md5($1::text || 'tok'), now() + interval '7 days', 'u1')`,
    modo: 'completo',
  },
  'cotizador.eventos': {
    sql: `insert into cotizador.eventos (tenant_id, cotizacion_id, version, tipo, usuario_id) values ($1, md5($1::text || 'q2')::uuid, 1, 'creada', 'u1')`,
    modo: 'insercion',
  },
};
