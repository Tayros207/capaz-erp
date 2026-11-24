# Agente flotante · Auditoría de herramientas

**Fecha:** 2026-11-24 · **Acompaña a:** `docs/PLAN-AGENTE-FLOTANTE.md` (§6 y fase 3) · **Estado:** propuesta del investigador; la política final la aprueba Moisés (decisión D2).

## 1. Cómo se hizo y qué tan fiable es

- **Conteo: verificado.** Un script de solo lectura recorrió el código de `apps/api/src` con el analizador de TypeScript y leyó cada llamada a `definirHerramienta(...)` y `definirHerramientaDePlataforma(...)`. El resultado coincide con los contratos compilados de `@capaz/shared` (303 de negocio + 18 de plataforma).
- **Veredicto y política: juicio del investigador.** Salen del nombre, de la ayuda obligatoria (`paraQueSirve`, `cuandoUsarla`) y de la marca `mueveDinero`. Solo donde la nota dice «(leído)» se leyó el código de la herramienta o de sus consumidores. **No se leyó la implementación de las 186 una por una.**
- **Efectos en cadena: verificado.** Los consumidores de eventos (`modules/registro/consumidores.ts`, `modules/ordenes/consumidores.ts`, `modules/insumos/consumidores.ts`) cumplen la regla R5: **nunca ejecutan herramientas, solo proponen borradores**. Por eso confirmar un pedido o recibir una compra no mueve dinero por sí solo: deja una propuesta en la bandeja. **Salvedad:** esas propuestas las crea el relevo de eventos, que no arranca con `RELEVO_ACTIVO=false` (verificado en `core/eventos/relevo.ts`); según la memoria del proyecto, así está en producción. Mientras siga así, el efecto en cadena no ocurre allí.

### Números reales (corrigen al plan anterior, que decía 338)

| | Lectura | Normal | Crítica | Total |
|---|---|---|---|---|
| Herramientas de negocio (las que ve el agente) | 117 | 154 | 32 | **303** |
| Herramientas de plataforma (consola del operador; otro ejecutor) | 6 | 0 | 12 | 18 |
| **Total** | 123 | 154 | 44 | **321** |

Con la marca `mueveDinero: true` hay **10** (no 11): 6 normales (`adelanto_registrar`, `cuentas_transferir`, `deuda_abonar`, `deuda_ajustar`, `deuda_crear_con_adelanto`, `movimiento_registrar`) y 4 críticas (`venta_corregir`, `movimiento_corregir`, `movimiento_restaurar`, `semana_cerrar`).

### Resultado de la auditoría de las 186 de escritura

| Política propuesta | Cantidad | De ellas críticas |
|---|---|---|
| **directo** (el agente la ejecuta; queda auditado como «agente») | 63 | 0 |
| **borrador** (el agente la propone; una persona la aprueba) | 76 | 0 |
| **tarjeta** (borrador + confirmación en dos pasos del servidor) | 23 | 23 |
| **prohibido** (el agente no la ofrece ni la propone) | 24 | 9 |

| Veredicto | Significado | Cantidad |
|---|---|---|
| L | Solo lectura disfrazada: está marcada «normal» pero solo propone o simula | 3 |
| R | Reversible con otra herramienta o editando | 86 |
| D | Difícil de deshacer: consume un número, borra, congela o sale de la empresa | 33 |
| $ | Mueve dinero y **tiene** la marca `mueveDinero` | 10 |
| $* | Afecta dinero, precios, costos o sueldos y **no tiene** la marca | 33 |
| A | Acceso, secretos, automatizaciones o configuración de la empresa | 21 |

**Hallazgo principal:** la marca `mueveDinero` no sirve como única regla. Hay 33 herramientas que tocan dinero, precios o sueldos sin llevarla (por ejemplo `deuda_crear`, `deuda_anular`, `movimiento_anular`, `pedido_confirmar`, `pedido_corregir`, `contrato_crear`, toda la lista de precios y las tarifas del taller). La política del agente no puede derivarse solo de `criticidad` y `mueveDinero`: necesita la tabla de abajo.

**Segundo hallazgo:** hay herramientas de **acceso** marcadas solo «normal» (`miembro_asignar_modulo`, `invitacion_anular`, `clave_api_crear`, `conexion_desactivar`, las de webhooks y las de reglas automáticas). Por el canal `agente` el ejecutor las correría sin pedir nada. Por eso van en la lista de prohibidas del agente, que se aplica **antes** de llegar al ejecutor.

## 2. Reglas con las que se asignó la política

1. **Prohibido:** secretos y llaves; miembros, roles e invitaciones; conexiones y webhooks; reglas automáticas; configuración fiscal de la empresa; cargas masivas desde archivo; y resolver borradores (aprobar, corregir o descartar es de la persona).
2. **Tarjeta:** toda herramienta `critica` que no esté prohibida. Técnicamente es un borrador: al aprobarlo, el servidor responde con el resumen y el token y la pantalla pide el segundo clic. El agente nunca recibe el token (ver plan §6).
3. **Borrador:** dinero con o sin marca; importes fuera de un documento en borrador; lo que consume un correlativo; lo que borra de verdad; aprobaciones (compras, vacaciones); existencias; datos de personal; configuración del cotizador, del embudo y de las cuentas.
4. **Directo:** crear o editar algo que **nace o sigue en borrador** (pedido, cotización, orden de compra, solicitud), datos maestros reversibles (clientes, productos, categorías), el embudo del CRM y los cambios de estado que se pueden deshacer.
5. **Por omisión, borrador.** Una herramienta de escritura que no esté en esta tabla (porque se creó después) se trata como `borrador`. Nunca como `directo`.
6. **Dos excepciones por argumento:** `pedido_cambiar_estado` y `produccion_orden_estado` son directas salvo cuando el destino es `entregado` (estado final que dispara la propuesta de cobro). `productos_editar` es directa salvo que cambie el precio.

La política «directo» **no se activa sola**: el plan la deja apagada por empresa hasta que Moisés la apruebe (D2) y el modelo pase el banco de evaluación (D7). Mientras tanto todo lo que no sea lectura sale como borrador.

## 3. Tabla por módulo (186 herramientas de escritura)

### Compras (12)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `compra_cancelar` | critica | — | D | tarjeta |  |
| `compra_crear` | normal | — | R | directo | Nace en borrador, sin número. |
| `compra_editar` | normal | — | R | directo | Solo edita un borrador. |
| `compra_enviar` | normal | — | D | borrador | Consume el correlativo y congela las líneas. |
| `compra_recibir` | normal | — | $* | borrador | Propone entrada a inventario y cuenta por pagar (bandeja). |
| `factura_anular` | normal | — | D | borrador |  |
| `factura_registrar` | normal | — | R | borrador | Lleva importes del proveedor; la ayuda dice «no mueve inventario ni dinero». |
| `solicitud_anular` | normal | — | D | borrador |  |
| `solicitud_convertir` | normal | — | R | directo | Crea una orden en borrador. |
| `solicitud_crear` | normal | — | R | directo | Nace en borrador. |
| `solicitud_enviar` | normal | — | D | borrador | Consume el correlativo. |
| `solicitud_resolver` | normal | — | $* | borrador | Es una aprobación de gasto: la decide una persona. |

### Núcleo (45)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `borrador_aprobar` | normal | — | A | prohibido | El código ya lo rechaza fuera de `ui` (leído). |
| `borrador_corregir` | normal | — | A | prohibido | El agente no retoca lo que una persona va a aprobar. |
| `borrador_descartar` | normal | — | A | prohibido | Descartar es decisión de la persona. |
| `captura_proponer` | normal | — | L | directo | Solo propone borradores (leído). |
| `categorias_producto_archivar` | normal | — | R | directo |  |
| `categorias_producto_guardar` | normal | — | R | directo |  |
| `clave_api_crear` | normal | — | A | prohibido | Secretos (ya vetada como borrador). |
| `clave_api_revocar` | critica | — | A | prohibido |  |
| `clientes_archivar` | normal | — | R | directo | Se restaura. |
| `clientes_comercial_guardar` | normal | — | $* | borrador | Límite de crédito, plazo, retenciones y datos bancarios. |
| `clientes_contacto_eliminar` | normal | — | D | borrador | Borra de verdad. |
| `clientes_contacto_guardar` | normal | — | R | directo |  |
| `clientes_crear` | normal | — | R | directo | Avisa si ya existe uno parecido. |
| `clientes_direccion_eliminar` | normal | — | D | borrador | Borra de verdad. |
| `clientes_direccion_guardar` | normal | — | R | directo |  |
| `clientes_editar` | normal | — | R | directo |  |
| `clientes_fusionar` | critica | — | D | tarjeta | Mueve deudas, pedidos y movimientos de un cliente a otro. |
| `clientes_restaurar` | normal | — | R | directo |  |
| `conexion_configurar` | critica | — | A | prohibido | Secretos (ya vetada como borrador). |
| `conexion_desactivar` | normal | — | A | prohibido |  |
| `empresa_actualizar_configuracion` | critica | — | A | prohibido | Moneda, zona y datos fiscales: solo a mano en Ajustes. |
| `importar_csv_aplicar` | critica | — | D | prohibido | Carga masiva desde un archivo. |
| `invitacion_anular` | normal | — | A | prohibido |  |
| `invitacion_crear` | critica | — | A | prohibido | Da acceso a la empresa. |
| `miembro_asignar_modulo` | normal | — | A | prohibido | Cambia accesos y está marcada solo «normal». |
| `miembro_cambiar_rol` | critica | — | A | prohibido |  |
| `miembro_quitar` | critica | — | A | prohibido |  |
| `modulo_solicitar` | normal | — | D | borrador | Sale de la empresa: avisa al equipo de Capaz. |
| `productos_archivar` | normal | — | R | directo | Se restaura. |
| `productos_crear` | normal | — | R | directo | Lleva precio de venta: mostrarlo en la respuesta. |
| `productos_editar` | normal | — | $* | directo; borrador si cambia `precioUnitarioMilesimas` | El precio de venta es un argumento. |
| `productos_ficha_guardar` | normal | — | $* | borrador | Incluye el costo. |
| `productos_restaurar` | normal | — | R | directo |  |
| `productos_unidad_eliminar` | normal | — | D | borrador | Borra de verdad. |
| `productos_unidad_guardar` | normal | — | R | directo |  |
| `regla_activar` | critica | — | A | prohibido | Una regla activa actúa sola. |
| `regla_desactivar` | normal | — | A | prohibido |  |
| `regla_ejecutar` | normal | — | A | prohibido | Ejecuta acciones encadenadas. |
| `regla_guardar` | normal | — | A | prohibido | Vector de inyección: «crea una regla que…». |
| `regla_probar` | normal | — | L | prohibido (v1) | Solo simula y deja una prueba en el historial; se puede abrir después. |
| `sucursal_archivar` | normal | — | R | borrador | Estructura de la empresa. |
| `sucursal_crear` | normal | — | R | borrador | Define la serie de sus documentos. |
| `sucursal_editar` | normal | — | R | directo |  |
| `sucursal_marcar_principal` | critica | — | D | tarjeta |  |
| `venta_corregir` | critica | sí | $ | tarjeta | Corrige pedido y deuda en un gesto. |

### Cotizador (51)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `ajuste_cliente_fijar` | normal | — | $* | borrador | Descuento o recargo fijo por cliente. |
| `cotizacion_aceptar` | normal | — | R | directo | Efecto en cadena: propone el pedido en la bandeja. |
| `cotizacion_anular` | critica | — | D | tarjeta |  |
| `cotizacion_crear` | normal | — | R | directo | Nace en borrador, sin número. |
| `cotizacion_duplicar` | normal | — | R | directo |  |
| `cotizacion_editar` | normal | — | R | directo | Solo edita un borrador. |
| `cotizacion_emitir` | critica | — | D | tarjeta | Da número y congela la versión. |
| `cotizacion_marcar_enviada` | normal | — | R | directo |  |
| `cotizacion_nueva_version` | normal | — | R | directo |  |
| `cotizacion_rechazar` | normal | — | R | directo |  |
| `cotizador_configurar` | normal | — | $* | borrador | Utilidad, IGV y redondeo: cambia todos los precios futuros. |
| `cotizador_iniciar` | normal | — | R | directo | Idempotente. |
| `cuadro_fijar_columnas_a_enviar` | normal | — | R | directo |  |
| `cuadro_fijar_costo_directo` | normal | — | $* | directo | Costo dentro de una cotización en borrador; se emite con confirmación. |
| `cuadro_fijar_imposicion` | normal | — | R | directo |  |
| `cuadro_fijar_precio_final` | normal | — | $* | directo | Precio al cliente dentro de un borrador; se emite con confirmación. |
| `cuadro_fijar_trabajo` | normal | — | R | directo |  |
| `cuadro_fijar_utilidad` | normal | — | $* | directo | Margen dentro de un borrador. |
| `cuadro_guardar_referencias` | critica | — | $* | tarjeta | Escribe en la lista de precios. |
| `cuadro_iniciar` | normal | — | R | directo |  |
| `cuadro_item_agregar` | normal | — | R | directo |  |
| `cuadro_item_editar` | normal | — | R | directo |  |
| `cuadro_item_quitar` | normal | — | D | borrador | Se pierde lo que tenía escrito. |
| `cuadro_linea_agregar` | normal | — | R | directo |  |
| `cuadro_linea_editar` | normal | — | R | directo |  |
| `cuadro_linea_quitar` | normal | — | D | borrador | Elimina la fila. |
| `enlace_generar` | critica | — | D | tarjeta | Crea un enlace público: sale de la empresa. |
| `enlace_revocar` | normal | — | D | borrador | El enlace deja de servir para el cliente. |
| `formato_pliego_archivar` | normal | — | R | borrador | Configuración del taller. |
| `formato_pliego_crear` | normal | — | R | borrador | Configuración del taller. |
| `formato_pliego_editar` | normal | — | R | borrador | Configuración del taller. |
| `formato_pliego_restaurar` | normal | — | R | borrador | Configuración del taller. |
| `item_cuadro_archivar` | normal | — | R | borrador | Configuración del taller. |
| `item_cuadro_crear` | normal | — | R | borrador | Configuración del taller. |
| `item_cuadro_editar` | normal | — | R | borrador | Configuración del taller. |
| `item_cuadro_restaurar` | normal | — | R | borrador | Configuración del taller. |
| `items_cuadro_reordenar` | normal | — | R | borrador | Configuración del taller. |
| `lista_precio_archivar` | normal | — | $* | borrador | Lista de precios. |
| `lista_precio_crear` | normal | — | $* | borrador | Lista de precios. |
| `lista_precio_editar` | critica | — | $* | tarjeta | Lista de precios. |
| `lista_precio_restaurar` | normal | — | $* | borrador | Lista de precios. |
| `listas_precio_ajustar_en_bloque` | critica | — | $* | tarjeta | Sube o baja varias listas a la vez. |
| `maquina_archivar` | normal | — | R | borrador | Configuración del taller. |
| `maquina_crear` | normal | — | R | borrador | Configuración del taller. |
| `maquina_editar` | normal | — | R | borrador | Configuración del taller. |
| `maquina_restaurar` | normal | — | R | borrador | Configuración del taller. |
| `taller_sembrar` | normal | — | D | borrador | Carga datos de ejemplo; solo con el taller vacío. |
| `tarifa_archivar` | normal | — | $* | borrador | Costos del taller. |
| `tarifa_crear` | normal | — | $* | borrador | Costos del taller. |
| `tarifa_editar` | critica | — | $* | tarjeta | Costos del taller. |
| `tarifa_restaurar` | normal | — | $* | borrador | Costos del taller. |

### CRM (13)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `actividad_completar` | normal | — | R | directo |  |
| `actividad_crear` | normal | — | R | directo |  |
| `crm_iniciar` | normal | — | R | directo | Idempotente. |
| `etapa_archivar` | normal | — | R | borrador | Configuración del embudo. |
| `etapa_crear` | normal | — | R | borrador | Configuración del embudo. |
| `etapa_editar` | normal | — | R | borrador | Configuración del embudo. |
| `etapas_ordenar` | normal | — | R | borrador | Configuración del embudo. |
| `oportunidad_crear` | normal | — | R | directo |  |
| `oportunidad_editar` | normal | — | R | directo |  |
| `oportunidad_ganar` | normal | — | R | directo | Se reabre con `oportunidad_reabrir`. |
| `oportunidad_mover` | normal | — | R | directo |  |
| `oportunidad_perder` | normal | — | R | directo | Se reabre. |
| `oportunidad_reabrir` | normal | — | R | directo | Borra el motivo de pérdida. |

### Inventario (11)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `articulo_activar` | normal | — | R | directo |  |
| `articulo_archivar` | normal | — | R | directo | Exige existencia en cero. |
| `articulo_editar` | normal | — | R | directo |  |
| `conteo_abrir` | normal | — | R | directo | Se puede anular. |
| `conteo_anular` | normal | — | D | borrador |  |
| `conteo_cerrar` | critica | — | D | tarjeta | Ajusta existencias. |
| `conteo_registrar` | normal | — | R | directo | Se reescribe mientras el conteo siga abierto. |
| `existencia_ajustar` | critica | — | D | tarjeta |  |
| `existencia_mover` | normal | — | D | borrador | Cambia existencias; solo se corrige con el movimiento contrario. |
| `existencias_recibir` | normal | — | D | borrador | Entrada de varios artículos. |
| `transferencia_crear` | normal | — | D | borrador | Mueve existencias entre sucursales y consume número. |

### Pedidos (11)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `guia_anular` | critica | — | D | tarjeta |  |
| `guia_emitir` | normal | — | D | borrador | Consume número; el documento sale con la mercadería. |
| `pedido_anotar` | normal | — | R | directo | La nota no se borra. |
| `pedido_cambiar_estado` | normal | — | R | directo; borrador si `estado = entregado` | «Entregado» es final y hace que Finanzas proponga el cobro. |
| `pedido_cancelar` | critica | — | D | tarjeta |  |
| `pedido_confirmar` | normal | — | $* | borrador | Consume el correlativo, congela las líneas y Finanzas propone la cuenta por cobrar (leído). |
| `pedido_corregir` | normal | — | $* | borrador | Cambia importes de un pedido confirmado. Preferir `venta_corregir`. |
| `pedido_crear` | normal | — | R | directo | Nace en borrador, sin número. |
| `pedido_editar` | normal | — | R | directo | Solo edita un borrador. |
| `pedido_editar_datos` | normal | — | R | directo | Fecha de entrega, responsable y notas. |
| `pedidos_importar_historial` | critica | — | D | prohibido | Carga masiva desde un archivo. |

### Personal (13)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `adelanto_anular` | critica | — | $* | tarjeta |  |
| `adelanto_registrar` | normal | sí | $ | borrador |  |
| `asistencia_corregir` | critica | — | D | tarjeta |  |
| `asistencia_marcar` | normal | — | D | borrador | Corregirla después es una operación crítica. |
| `colaborador_archivar` | normal | — | R | borrador | Datos de personal. |
| `colaborador_crear` | normal | — | R | borrador | Datos personales (documento, cuenta). |
| `colaborador_editar` | normal | — | R | borrador | Datos de personal. |
| `colaborador_restaurar` | normal | — | R | borrador | Datos de personal. |
| `contrato_crear` | normal | — | $* | borrador | Lleva la remuneración mensual. |
| `contrato_terminar` | normal | — | D | borrador |  |
| `vacaciones_anular` | normal | — | R | borrador | Los días vuelven al saldo. |
| `vacaciones_resolver` | normal | — | D | borrador | Es una aprobación: la decide una persona. |
| `vacaciones_solicitar` | normal | — | R | borrador | Datos de personal. |

### Producción (5)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `produccion_orden_anular` | normal | — | $* | borrador | Decide qué pasa con el adelanto; Finanzas propone ajustar la deuda. |
| `produccion_orden_cobrar` | normal | — | L | directo | Solo pide a Finanzas un cobro propuesto en la bandeja. |
| `produccion_orden_crear` | normal | — | $* | borrador | Consume número; con adelanto, Finanzas propone deuda e ingreso. |
| `produccion_orden_editar` | normal | — | $* | borrador | Puede cambiar total y adelanto. |
| `produccion_orden_estado` | normal | — | R | directo; borrador si `estado = entregado` | «Entregado» ya no cambia y hace que Finanzas proponga el cobro. |

### Finanzas (`registro`) (21)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `categoria_archivar` | normal | — | R | directo |  |
| `categoria_crear` | normal | — | R | directo |  |
| `categoria_editar` | normal | — | R | directo |  |
| `cuenta_archivar` | normal | — | R | borrador | Cuentas de dinero. |
| `cuenta_crear` | normal | — | $* | borrador | Lleva saldo inicial. |
| `cuenta_editar` | normal | — | R | borrador | Cuentas de dinero. |
| `cuenta_marcar_principal` | normal | — | R | borrador | Cambia a dónde cae el dinero por defecto. |
| `cuentas_transferir` | normal | sí | $ | borrador |  |
| `deuda_abonar` | normal | sí | $ | borrador |  |
| `deuda_ajustar` | normal | sí | $ | borrador |  |
| `deuda_anular` | critica | — | $* | tarjeta |  |
| `deuda_crear` | normal | — | $* | borrador | Crea una cuenta por cobrar o por pagar y no lleva la marca. |
| `deuda_crear_con_adelanto` | normal | sí | $ | borrador |  |
| `deuda_editar` | normal | — | $* | borrador | Cambia el vencimiento. |
| `deudas_copiar_fijos` | critica | — | $* | tarjeta | Crea varias deudas por pagar de una vez. |
| `movimiento_anular` | critica | — | $* | tarjeta | Anula un ingreso o egreso y no lleva la marca. |
| `movimiento_corregir` | critica | sí | $ | tarjeta |  |
| `movimiento_registrar` | normal | sí | $ | borrador |  |
| `movimiento_restaurar` | critica | sí | $ | tarjeta |  |
| `registro_iniciar` | normal | — | R | directo | Idempotente. |
| `semana_cerrar` | critica | sí | $ | tarjeta | Exige contar la caja: la hace una persona. |

### Webhooks (4)

| Herramienta | Criticidad | Marca dinero | Veredicto | Política del agente | Nota |
|---|---|---|---|---|---|
| `webhook_envio_reintentar` | normal | — | A | prohibido | Envía datos fuera de la empresa. |
| `webhooks_salientes_archivar` | normal | — | A | prohibido |  |
| `webhooks_salientes_crear` | normal | — | A | prohibido | Secretos (ya vetada como borrador). |
| `webhooks_salientes_editar` | normal | — | A | prohibido | Secretos (ya vetada como borrador). |

## 4. Herramientas de lectura (117)

El agente las ejecuta directo, con los permisos de la persona. **No se verificó una por una que ninguna escriba**: la criticidad `lectura` la declara cada herramienta y el ejecutor no abre una transacción de solo lectura para ellas.

| Módulo | Cantidad | Herramientas |
|---|---|---|
| Compras | 8 | `compras_costos_por_articulo`, `compra_ver`, `compras_listar`, `compras_resumen`, `factura_ver`, `facturas_listar`, `solicitud_ver`, `solicitudes_listar` |
| Núcleo | 33 | `auditoria_listar`, `reglas_listar`, `regla_ver`, `regla_ejecuciones_listar`, `borradores_listar`, `borradores_resumen`, `borrador_ver`, `borradores_metricas`, `clientes_comercial_ver`, `clientes_contactos_listar`, `clientes_direcciones_listar`, `clientes_similares`, `clientes_listar`, `clientes_ver`, `clientes_buscar`, `precio_anterior_consultar`, `mi_dia_ver`, `correcciones_listar`, `conectores_listar`, `conexion_ver`, `claves_api_listar`, `empresa_ver_configuracion`, `exportar_csv`, `importar_csv_previsualizar`, `invitaciones_listar`, `miembros_listar`, `categorias_producto_listar`, `productos_ficha_ver`, `productos_unidades_listar`, `productos_listar`, `productos_ver`, `productos_buscar`, `sucursales_listar` |
| Cotizador | 20 | `ajustes_cliente_listar`, `cotizador_configuracion_ver`, `cotizacion_ver`, `cotizaciones_listar`, `cotizador_resumen`, `cotizador_pendientes`, `cuadro_ver`, `cuadro_calcular`, `cuadro_generar_referencias`, `enlaces_listar`, `lista_precio_historial`, `listas_precio_listar`, `lista_precio_ver`, `precio_consultar`, `cotizador_precios_anteriores`, `cotizador_productos_buscar`, `formatos_pliego_listar`, `items_cuadro_listar`, `maquinas_listar`, `tarifas_listar` |
| CRM | 6 | `crm_pendientes`, `etapas_listar`, `oportunidad_ver`, `oportunidades_listar`, `actividades_listar`, `crm_resumen` |
| Inventario | 11 | `articulo_ver`, `articulos_listar`, `existencias_listar`, `existencias_movimientos_listar`, `insumos_resumen`, `insumos_pendientes`, `conteo_ver`, `conteos_listar`, `existencias_kardex`, `transferencia_ver`, `transferencias_listar` |
| Pedidos | 10 | `guia_preparar`, `guia_ver`, `guias_listar`, `pedido_correcciones_listar`, `pedidos_importar_historial_previsualizar`, `pedido_ver`, `pedidos_listar`, `ordenes_resumen`, `ordenes_pendientes`, `ordenes_precios_anteriores` |
| Personal | 8 | `adelantos_listar`, `asistencias_listar`, `colaborador_ver`, `colaboradores_listar`, `contratos_listar`, `personal_resumen`, `vacaciones_listar`, `vacaciones_saldo` |
| Producción | 4 | `produccion_ordenes_listar`, `produccion_orden_ver`, `produccion_pendientes`, `produccion_precios_anteriores` |
| Finanzas (`registro`) | 13 | `deudas_antiguedad`, `categorias_listar`, `semana_revisar`, `registro_cobertura_del_mes`, `cuentas_listar`, `deuda_ajustes_listar`, `deuda_ver`, `deudas_listar`, `movimiento_ver`, `movimientos_listar`, `registro_pendientes`, `caja_del_dia`, `registro_resumen` |
| Webhooks | 2 | `webhooks_salientes_listar`, `webhook_envios_listar` |
**Lecturas que el agente NO ofrece en la primera versión (11):**

| Herramienta | Motivo |
|---|---|
| `exportar_csv`, `reportes_exportar_csv` | Vuelcan hasta 5.000 filas: caro en tokens y es la vía más directa de sacar datos en bloque. |
| `importar_csv_previsualizar`, `pedidos_importar_historial_previsualizar` | Necesitan un archivo, que el panel no envía. |
| `auditoria_listar` | Historial de toda la empresa; el dueño lo ve en Ajustes › Historial. |
| `claves_api_listar`, `conectores_listar`, `conexion_ver`, `webhooks_salientes_listar`, `webhook_envios_listar` | Configuración de integraciones: nada que el agente necesite para el trabajo diario. |
| `invitaciones_listar` | No se verificó si devuelve enlaces de invitación; se excluye por prudencia. |

Quedan **106 lecturas** al alcance del agente (menos las que la persona no pueda usar por permiso o módulo).

## 5. Herramientas de plataforma (18): fuera del alcance

Las 18 `plataforma_*` (activar módulos, pausar cuentas, restablecer contraseñas) corren por otro ejecutor (`core/plataforma/ejecutor-de-plataforma.ts`) y solo para operadores de la plataforma. **El agente del ERP no las ve ni las llama.** No están en el registro de negocio que el agente recorre.

## 6. Lista por verbo (lo que pidió Moisés)

| Verbo | Herramientas reales | Política |
|---|---|---|
| **Ver / investigar** | `mi_dia_ver`, `clientes_buscar`, `clientes_ver`, `pedidos_listar`, `pedido_ver`, `ordenes_resumen`, `ordenes_pendientes`, `produccion_ordenes_listar`, `produccion_orden_ver`, `produccion_pendientes`, `deudas_listar`, `deuda_ver`, `deudas_antiguedad`, `movimientos_listar`, `caja_del_dia`, `registro_resumen`, `cotizaciones_listar`, `cotizacion_ver`, `oportunidades_listar`, `crm_resumen`, `existencias_listar`, `insumos_resumen`, `compras_listar`, `reportes_panel`, `precio_anterior_consultar`, `borradores_listar` | directo |
| **Crear** | `clientes_crear`, `productos_crear`, `pedido_crear`, `cotizacion_crear`, `cuadro_iniciar`, `oportunidad_crear`, `actividad_crear`, `compra_crear`, `solicitud_crear` | directo |
| | `produccion_orden_crear`, `deuda_crear`, `movimiento_registrar`, `colaborador_crear`, `contrato_crear` | borrador |
| **Editar** | `clientes_editar`, `pedido_editar`, `pedido_editar_datos`, `cotizacion_editar`, `cuadro_*` (sobre un borrador), `oportunidad_editar`, `productos_editar` (sin precio) | directo |
| | `produccion_orden_editar`, `deuda_editar`, `pedido_corregir`, `productos_ficha_guardar` | borrador |
| | `venta_corregir`, `movimiento_corregir` | tarjeta |
| **Mover** (cambiar de estado o de etapa) | `oportunidad_mover`, `oportunidad_ganar`, `oportunidad_perder`, `oportunidad_reabrir`, `cotizacion_aceptar`, `cotizacion_rechazar`, `cotizacion_marcar_enviada`, `actividad_completar` | directo |
| | `pedido_cambiar_estado`, `produccion_orden_estado` | directo; borrador si el destino es `entregado` |
| | `pedido_confirmar`, `compra_enviar`, `solicitud_enviar`, `existencia_mover`, `transferencia_crear`, `cuentas_transferir` | borrador |
| | `cotizacion_emitir`, `pedido_cancelar`, `guia_anular` | tarjeta |
| **Colocar** (texto o dictado suelto → el lugar correcto) | `captura_proponer` (hoy solo interpreta para `registro`: movimientos, deudas y pedidos «Pedido para…») | directo (solo propone borradores) |
| | Con el modelo: el agente elige la herramienta del módulo correcto y la **propone como borrador** con origen `agente` | borrador |
| **Cobrar / pagar** | `deuda_abonar`, `movimiento_registrar`, `adelanto_registrar`, `produccion_orden_cobrar` (esta solo pide el cobro) | borrador (`produccion_orden_cobrar`: directo) |
| **Identificar / analizar** | Lecturas + `*_resumen`, `*_pendientes`, `reportes_panel`, `deudas_antiguedad`, `compras_costos_por_articulo` | directo; el modelo no calcula cifras |

## 7. Lo que queda sin verificar

- La implementación de cada herramienta (solo se leyeron las que la nota marca «(leído)»).
- Que ninguna herramienta `lectura` escriba.
- Qué devuelve `invitaciones_listar`.
- Si alguna herramienta «directo» resulta molesta de deshacer en la práctica: se sabrá al usarla; por eso «directo» arranca apagado.
