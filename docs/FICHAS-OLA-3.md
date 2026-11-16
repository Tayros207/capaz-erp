# Fichas de la ola 3 · Clásicos II (Inventario, Compras, Personal, Reportes)

**Versión 1 · 2026-11-15 · Estado: CASI CONGELADA. La arquitectura está fijada; el detalle columna por columna y los contratos Zod se cierran en la puerta de la ola 3, con lo aprendido en la ola 2. No se lanza ningún carril de esta ola desde este documento.**

Sustituye a las «fichas versión 1» de las fases 17 a 20 de `PLAN-DE-CONSTRUCCION.md`. Las **reglas comunes R1 a R18 de `FICHAS-OLA-2.md` §1 valen igual** para estos módulos; aquí solo va lo propio de cada uno.

## 0. Lo que ya está decidido (no se reabre en la puerta)

1. Un esquema de base por módulo: `insumos`, `compras`, `personal`. `reportes` no tiene tablas.
2. Compras va en esta ola, junto con Inventario, y **después** de él dentro de la ola (`dependeDe: ['insumos']`).
3. Los módulos se hablan por eventos y por la bandeja: lo que un módulo debería registrar en otro llega como **borrador** (R5). Ninguno importa a otro; entre módulos no hay llaves foráneas (R6: par `origen_tipo` + `origen_id`).
4. Mismas convenciones de dinero, fechas, correlativos, alcance, disparador de escritura, pruebas mínimas y pantallas que la ola 2.
5. Reportes **compone**: llama por nombre a las herramientas `<codigo>_resumen` de los módulos a los que la persona puede entrar (con `EjecutorDeHerramientas.ejecutarDentro`, que aplica permisos y auditoría); no lee tablas de otros módulos.
6. Sin planilla, sin costeo contable, sin lotes ni varios almacenes por sucursal, sin licitaciones. Facturación SUNAT y contabilidad formal siguen fuera.

## 1. Datos (DB3a y DB3b)

- **DB3a:** `0017_modulos_clasicos_ii_base` (a mano: `create schema if not exists insumos / compras / personal`, `grant usage … to capaz_app`; `schemaFilter` y listas de esquemas de las tres pruebas; activar los tres módulos en el `beforeAll` de `aislamiento.int.spec.ts`), `0018_insumos`, `0019_personal`.
- **DB3b:** `0020_compras`.
- `capaz_sistema`: nada en ninguna tabla. Constantes de Drizzle con prefijo (`insumosMovimientos`, `comprasOrdenes`…): ya existe `registroMovimientos` y habrá `ordenesPedidos` (R16).

### 1.1 `insumos`

| Tabla | Columnas propias (además de `id`, `tenant_id`, `creado_por`, marcas de tiempo) | Reglas |
|---|---|---|
| `insumos.articulos` | `producto_id` → `core.productos`, `unidad text`, `minimo_milesimas bigint ≥ 0 default 0`, `ultimo_costo_milesimas bigint null`, `archivado_en` | único `(tenant_id, producto_id)`; `unique (tenant_id, id)`; modo `completo` |
| `insumos.existencias` | `articulo_id` →, `sucursal_id` → `core.sucursales` (obligatoria), `cantidad_milesimas bigint default 0` | único `(tenant_id, articulo_id, sucursal_id)`; modo `completo`; la cambia solo el código que inserta un movimiento, en la misma transacción y con la fila bloqueada |
| `insumos.movimientos` | `articulo_id`, `sucursal_id`, `tipo` (`entrada`, `salida`, `ajuste`), `cantidad_milesimas` (con signo: entrada > 0, salida < 0, ajuste ≠ 0), `existencia_resultante_milesimas`, `costo_unitario_milesimas null`, `motivo`, `origen_tipo`, `origen_id` | **modo `insercion`** + `core.rechazar_cambio`; único parcial `(tenant_id, origen_tipo, origen_id, articulo_id) where origen_id is not null` (una recepción no suma dos veces); índice `(tenant_id, articulo_id, creado_en desc)` |

### 1.2 `compras`

| Tabla | Columnas propias | Reglas |
|---|---|---|
| `compras.ordenes` | `numero`, `serie`, `anio` (se asignan al enviar), `proveedor_id` → `core.clientes`, `estado` (`borrador`, `enviada`, `recibida_parcial`, `recibida`, `cancelada`), `fecha`, `entrega_el`, `igv_porcentaje`, `subtotal_centimos`, `igv_centimos`, `total_centimos`, `notas`, `sucursal_id`, `cancelado_en/por`, `motivo_cancelacion`, `datos_extra` | como `ordenes.pedidos` (mismos `CHECK` de número y de total); modo `completo`; sin borrado |
| `compras.orden_lineas` | `orden_id` →, `posicion`, `producto_id` → `core.productos` (nulo si es un gasto sin producto), `descripcion`, `unidad`, `cantidad_milesimas > 0`, `costo_unitario_milesimas ≥ 0`, `afecto_igv`, `importe_centimos`, `recibido_milesimas ≥ 0 default 0` | `CHECK recibido_milesimas <= cantidad_milesimas`; único `(tenant_id, orden_id, posicion)`; `unique (tenant_id, id)` |
| `compras.recepciones` | `orden_id` →, `numero` (dentro de la orden), `fecha`, `nota` | modo `insercion`; `unique (tenant_id, id)` |
| `compras.recepcion_lineas` | `recepcion_id` →, `orden_linea_id` →, `cantidad_milesimas > 0` | modo `insercion` |

### 1.3 `personal`

| Tabla | Columnas propias | Reglas |
|---|---|---|
| `personal.colaboradores` | `nombre`, `nombre_normalizado`, `documento_tipo`, `documento_numero`, `telefono`, `cargo`, `usuario_id text null` (su cuenta, si tiene), `fecha_ingreso date`, `sucursal_id`, `archivado_en`, `datos_extra` | único parcial `(tenant_id, nombre_normalizado) where archivado_en is null`; `unique (tenant_id, id)`; datos personales: nunca en eventos ni en auditoría |
| `personal.asistencias` | `colaborador_id` →, `fecha date`, `entrada timestamptz null`, `salida timestamptz null`, `estado` (`presente`, `tardanza`, `falta`, `permiso`, `descanso`), `nota` | único `(tenant_id, colaborador_id, fecha)`; `CHECK salida is null or entrada is not null` |
| `personal.adelantos` | `numero`, `anio`, `colaborador_id` →, `monto_centimos > 0`, `fecha`, `motivo`, `estado` (`registrado`, `anulado`), `anulado_en/por`, `motivo_anulacion` | **modo `insercion`** + `grant update (estado, anulado_en, anulado_por, motivo_anulacion)` (como `registro.movimientos`) |

## 2. Fase 17 · `insumos` (Inventario)

Nombre visible «Inventario». Familia `inventario`. Permisos: `insumos:ver`, `insumos:editar`, `insumos:ajustar`. Lectura: `insumos:ver`.

| Herramienta | Qué hace | Permiso · criticidad |
|---|---|---|
| `articulo_activar` | Pone un producto del núcleo bajo control de inventario (`productoId`, `minimoMilesimas?`). Idempotente | `insumos:editar` · normal |
| `articulo_editar`, `articulo_archivar` | Mínimo y unidad; archivar exige existencia cero | `insumos:editar` · normal |
| `articulos_listar`, `articulo_ver` | Con existencia total, por sucursal y bandera `bajoMinimo` | `insumos:ver` · lectura |
| `existencias_listar` | Por sucursal; filtro `soloBajoMinimo` | `insumos:ver` · lectura |
| `existencia_mover` | Entrada o salida manual (`articuloId`, `sucursalId?`, `tipo`, `cantidadMilesimas`, `motivo?`, `costoUnitarioMilesimas?`). Idempotente | `insumos:editar` · normal |
| `existencias_recibir` | Entrada de varias líneas con `origenTipo` y `origenId` (lo propone el consumidor de `compra.recibida`). Idempotente por origen | `insumos:editar` · normal |
| `existencia_ajustar` | Fija la existencia contada (`existenciaNuevaMilesimas`, `motivo`) | `insumos:ajustar` · **crítica** |
| `existencias_movimientos_listar` | Historial por artículo | `insumos:ver` · lectura |
| `insumos_resumen` | Artículos, bajo mínimo, entradas y salidas del período | `insumos:ver` · lectura |

- **Eventos que emite:** `existencia.bajo_minimo` (`articuloId`, `productoId`, `sucursalId`, `cantidadMilesimas`, `minimoMilesimas`), solo al **cruzar** el mínimo hacia abajo.
- **Consume:** `compra.recibida` → propone **un** borrador de `existencias_recibir` con todas las líneas que tienen artículo activo.
- **Pantallas:** existencias (lista con insignia «Bajo mínimo»), ficha de artículo con historial, hoja «Entrada / Salida», ajuste (crítica), alertas.
- **Carriles:** M-insumos-s (una sesión M), M-insumos-w.

## 3. Fase 18 · `compras`

Familia `compras`. `dependeDe: ['insumos']`. Permisos: `compras:ver`, `compras:editar`, `compras:cancelar`. Correlativo `compras.orden` con serie de sucursal; código `OC-PRI-2026-0001`, asignado al **enviar**.

| Herramienta | Qué hace | Permiso · criticidad |
|---|---|---|
| `compra_crear`, `compra_editar` | Borrador con líneas (solo se edita en `borrador`) | `compras:editar` · normal (crear: idempotente) |
| `compra_ver`, `compras_listar` | Con líneas, recepciones y lo pendiente de recibir | `compras:ver` · lectura |
| `compra_enviar` | Asigna número; `borrador → enviada` | `compras:editar` · normal |
| `compra_recibir` | Recepción total o parcial (`lineas: [{ ordenLineaId, cantidadMilesimas }]`). Idempotente. No recibe más de lo pedido | `compras:editar` · normal |
| `compra_cancelar` | Solo sin recepciones | `compras:cancelar` · **crítica** |
| `compras_resumen` | Por estado, total comprado, pendientes de recibir | `compras:ver` · lectura |

- **Eventos:** `compra.enviada`, `compra.recibida` (`id`, `codigo`, `recepcionId`, `proveedorId`, `sucursalId`, `completa`, `importeRecibidoCentimos`, `lineas: [{ productoId, cantidadMilesimas, costoUnitarioMilesimas }]`), `compra.cancelada`. **Fuente de tiempo:** `compras.entrega_vence`.
- **Totales:** misma función y misma convención que Pedidos (`calcularTotalesDePedido`, que en la puerta se renombra a algo neutro si se comparte).
- **Pantallas:** lista, ficha con líneas (el editor de líneas de Pedidos, ya promovido al kit), recepción.
- **Carriles:** M-compras-s (L, dos sesiones), M-compras-w.

## 4. Fase 19 · `personal`

Familia `personal`. Permisos: `personal:ver`, `personal:editar`, `personal:adelantos`, `personal:anular`. Correlativo `personal.adelanto`; código `ADE-2026-0001`.

| Herramienta | Qué hace | Permiso · criticidad |
|---|---|---|
| `colaborador_crear`, `colaborador_editar`, `colaborador_archivar`, `colaborador_restaurar` | Ficha del colaborador | `personal:editar` · normal |
| `colaboradores_listar`, `colaborador_ver` | | `personal:ver` · lectura |
| `asistencia_marcar` | Entrada, salida o estado del día de un colaborador | `personal:editar` · normal |
| `asistencia_corregir` | Cambia una asistencia de un día ya pasado; pide motivo | `personal:editar` · **crítica** |
| `asistencias_listar` | Por día o por rango | `personal:ver` · lectura |
| `adelanto_registrar` | Idempotente · **`mueveDinero`** | `personal:adelantos` · normal |
| `adelanto_anular` | | `personal:anular` · **crítica** |
| `adelantos_listar`, `personal_resumen` | | `personal:ver` · lectura |

- **Eventos:** `adelanto.registrado` (`id`, `codigo`, `colaboradorId`, `montoCentimos`, `fecha`), `adelanto.anulado`. Sin nombres ni documentos.
- **Pantallas:** colaboradores, asistencia del día (una fila por persona con botones grandes), adelantos.
- **Carriles:** M-personal-s (M), M-personal-w.

## 5. Fase 20 · `reportes` y lo que `registro` gana en esta ola

- **`reportes`** (familia `analisis`; permisos `reportes:ver`, `reportes:exportar`; sin tablas): `reportes_panel` (`{ desde, hasta }` → un bloque por módulo accesible, con la salida de su `<codigo>_resumen`) y `reportes_exportar_csv` (reusa `core/intercambio/csv.ts`). Pantalla: indicadores por período con `Cifra` y gráficos en SVG propio. Carriles: M-reportes-s (S), M-reportes-w (M).
- **`registro` (carril M-registro-s4, S):** consumidor de `compra.recibida` → borrador de `deuda_crear` por pagar (`origenTipo: 'compra'`); consumidor de `adelanto.registrado` → borrador de `movimiento_registrar` (egreso, categoría «Sueldos»).
- **Kit (carril K2):** `GraficoDeBarras`, `GraficoDeLinea` (SVG propio, con tabla alternativa accesible) y el editor de líneas de documento promovido desde `modules/ordenes`.
- **Paso previo (C2):** eventos de la ola 3 en `contratos/{insumos,compras,personal}.ts`.

## 6. Qué debe decidirse en la puerta de la ola 3

| # | Decisión | Recomendación del arquitecto | Afecta a |
|---|---|---|---|
| P3-1 | ¿Existencia negativa permitida? | No: `CHECK cantidad_milesimas >= 0`; una salida mayor a lo que hay se rechaza con el faltante | DB3a, M-insumos-s |
| P3-2 | ¿Se guarda costo de los insumos? | Solo el último costo, informativo. Sin promedio ni valorización | DB3a |
| P3-3 | Entrada de inventario al recibir una compra: ¿borrador único (`existencias_recibir`) o escritura directa del consumidor? | Borrador único (mantiene R5). Si la ola 2 demuestra que la bandeja estorba, se abre una excepción escrita a R5 para tablas propias sin dinero | M-insumos-s, R5 |
| P3-4 | La cuenta por pagar ¿nace al enviar la orden o al recibir? | Al recibir, por lo recibido | M-registro-s4 |
| P3-5 | ¿Los costos de compra incluyen IGV? | La misma convención que se haya confirmado en Pedidos (D17) | M-compras-s |
| P3-6 | ¿`compras` exige tener `insumos` contratado? | Sí (catálogo actual). Las líneas admiten productos sin artículo de inventario | manifiesto |
| P3-7 | Asistencia: ¿la marca el encargado o cada colaborador con su cuenta? | El encargado, en la ola 3. Marcarse uno mismo (alcance `propios` por `usuario_id`) queda preparado en la tabla | M-personal-s |
| P3-8 | Gráficos con serie en el tiempo: ¿los `_resumen` devuelven `serie` por día o mes? | Sí, campo nuevo opcional `serie` (agregar campos de salida es compatible) | todos los `_resumen` |
| P3-9 | Fusionar clientes (`clientes_fusionar`, pendiente desde la fase 7) | Herramienta crítica del **núcleo** que marca `fusionado_en`; los módulos **no** mueven referencias: sus listados por cliente incluyen los ids fusionados | núcleo |
| P3-10 | `oportunidad.ganada` → ¿borrador de pedido? | Solo si la ola 2 muestra que se usa el CRM antes del pedido | M-ordenes |
| P3-11 | ¿Qué significa «avisar»? (D24) | Un «aviso interno» mínimo del núcleo, o esperar a WhatsApp (ola 5) | núcleo |
| P3-12 | Editor de líneas: ¿se promueve al kit tal como quedó en Pedidos? | Sí, tras la revisión visual de Pedidos | K2 |

## 7. Rondas previstas (se confirman en la puerta)

| Ronda | En paralelo (máximo 4) | Se puede lanzar cuando |
|---|---|---|
| 13 | C2 · K2 · DB3a | puerta de la ola 3 pasada |
| 14 | DB3b · M-insumos-s · M-personal-s · M-registro-s4 | C2 y DB3a integrados |
| 15 | M-compras-s (a) · M-insumos-w · M-personal-w | DB3b y M-insumos-s integrados · sus `-s` y K2 |
| 16 | M-compras-s (b) · M-reportes-s | todos los `_resumen` integrados (reportes) |
| 17 | M-compras-w · M-reportes-w | sus `-s` integrados |
| 18 | X3 (cierre: recorrido compra → recepción → inventario → cuenta por pagar; quitar «en construcción») | todo lo anterior |
