// El conocimiento de cómo se encadenan los módulos del ERP, para que el asistente lo conozca y no lo adivine. Cada fila describe UN
// consumidor de eventos real (`RegistroDeConsumidores`): una prueba de integración falla si un consumidor no tiene fila, si una fila
// nombra un consumidor que ya no existe o una herramienta que no existe. Los textos salen de lo que el propio código del consumidor
// documenta. Todo efecto entre módulos llega como PROPUESTA en la Bandeja (regla R5): nada mueve dinero por su cuenta.
// Las cadenas no son importaciones (regla 7): son nombres.

export type FlujoDelErp = {
  /** El nombre del consumidor de eventos que lo hace. */
  consumidor: string;
  /** Los módulos que intervienen: el que origina y el que propone. */
  modulos: readonly [string, string];
  cuando: string;
  efecto: string;
  /** Herramientas que disparan el evento. */
  herramientas: readonly string[];
};

export const FLUJOS_DEL_ERP: readonly FlujoDelErp[] = [
  { consumidor: 'registro_pedido_confirmado', modulos: ['ordenes', 'registro'], cuando: 'Se confirma un pedido con importe', efecto: 'Finanzas propone su cuenta por cobrar como borrador, salvo que ya exista una deuda viva de ese pedido. No la crees a mano.', herramientas: ['pedido_confirmar'] },
  { consumidor: 'registro_pedido_cancelado', modulos: ['ordenes', 'registro'], cuando: 'Se cancela un pedido', efecto: 'Finanzas propone anular su deuda viva, con prioridad alta. Sin deuda viva no hace nada.', herramientas: ['pedido_cancelar'] },
  { consumidor: 'registro_pedido_entregado', modulos: ['ordenes', 'registro'], cuando: 'Se entrega un pedido con saldo pendiente', efecto: 'Finanzas propone cobrar el saldo. Sin deuda viva, sin saldo o con un cobro ya propuesto no hace nada.', herramientas: ['pedido_cambiar_estado'] },
  { consumidor: 'registro_pedido_datos_editados', modulos: ['ordenes', 'registro'], cuando: 'Se corrige la fecha de entrega de un pedido', efecto: 'Finanzas propone mover el vencimiento de su deuda viva, solo si vencía justo en la entrega anterior.', herramientas: ['pedido_editar_datos'] },
  { consumidor: 'registro_pedido_corregido', modulos: ['ordenes', 'registro'], cuando: 'Se corrige un pedido ya confirmado', efecto: 'Finanzas propone ajustar su deuda al total nuevo; dos entregas del mismo evento no duplican.', herramientas: ['pedido_corregir'] },
  { consumidor: 'ordenes_cotizacion_aceptada', modulos: ['cotizador', 'ordenes'], cuando: 'Se acepta una cotización', efecto: 'Pedidos propone el pedido, salvo que ya exista un pedido vivo de esa cotización.', herramientas: ['cotizacion_aceptar'] },
  { consumidor: 'ordenes_cotizacion_anulada', modulos: ['cotizador', 'ordenes'], cuando: 'Se anula una cotización', efecto: 'Pedidos propone cancelar su pedido solo si sigue en borrador; en cualquier otro caso no hace nada.', herramientas: ['cotizacion_anular'] },
  { consumidor: 'insumos_compra_recibida', modulos: ['compras', 'insumos'], cuando: 'Se recibe una compra', efecto: 'Inventario propone la entrada de lo recibido (agrupada por artículo); si esa recepción ya entró, no propone nada.', herramientas: ['compra_recibir'] },
  { consumidor: 'registro_compra_recibida', modulos: ['compras', 'registro'], cuando: 'Se recibe una compra con importe', efecto: 'Finanzas propone su cuenta por pagar por lo recibido; el origen es la recepción, así no se duplica.', herramientas: ['compra_recibir'] },
  { consumidor: 'registro_adelanto_registrado', modulos: ['personal', 'registro'], cuando: 'Se registra un adelanto de sueldo', efecto: 'Finanzas propone un egreso en «Sueldos». No lo registres a mano.', herramientas: ['adelanto_registrar'] },
  { consumidor: 'registro_produccion_orden_creada', modulos: ['produccion', 'registro'], cuando: 'Se crea una orden de trabajo del taller con total', efecto: 'Finanzas propone su cuenta por cobrar; con adelanto, la deuda y el adelanto nacen juntos.', herramientas: ['produccion_orden_crear'] },
  { consumidor: 'registro_produccion_orden_entregada', modulos: ['produccion', 'registro'], cuando: 'Se entrega una orden de trabajo', efecto: 'Finanzas propone cobrar lo que falta.', herramientas: ['produccion_orden_estado'] },
  { consumidor: 'registro_produccion_cobro_pedido', modulos: ['produccion', 'registro'], cuando: 'Se anota que el cliente ya pagó una orden de trabajo', efecto: 'Finanzas propone cobrar lo que falta de la orden.', herramientas: ['produccion_orden_cobrar'] },
  { consumidor: 'registro_produccion_orden_anulada', modulos: ['produccion', 'registro'], cuando: 'Se anula una orden de trabajo', efecto: 'Finanzas propone anular su deuda viva, con prioridad alta; si había adelanto, el resumen dice qué se hizo con él.', herramientas: ['produccion_orden_anular'] },
  { consumidor: 'registro_produccion_orden_corregida', modulos: ['produccion', 'registro'], cuando: 'Se corrige una orden de trabajo', efecto: 'Finanzas propone un aviso sobre su deuda; la persona decide después si la anula y la vuelve a crear.', herramientas: ['produccion_orden_editar'] },
];

/** Los flujos en los que interviene un módulo, o en los que interviene una herramienta. */
export const flujosDelModulo = (modulo: string): readonly FlujoDelErp[] => FLUJOS_DEL_ERP.filter((f) => f.modulos.includes(modulo));
export const flujosDeLaHerramienta = (herramienta: string): readonly FlujoDelErp[] => FLUJOS_DEL_ERP.filter((f) => f.herramientas.includes(herramienta));
