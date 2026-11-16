// Vocabulario del dominio que comparten varias features: la cotización (filas, utilidad) y la
// empresa (catálogo de insumos, configuración). Vive aquí para que ninguna importe de la otra.

/**
 * Los seis factores del cuadro (BUSINESS_LOGIC.md), siempre visibles aunque estén vacíos, en el orden
 * del cuadro de costos (PRP-007): material, placa, impresión, diseño, acabado y otros. Las claves
 * `planchas` e `indirectos` se conservan: lo que cambió es su nombre visible y el orden.
 */
export const FACTORES = [
  'material',
  'planchas',
  'impresion',
  'diseno',
  'acabado',
  'indirectos',
] as const
export type Factor = (typeof FACTORES)[number]

/** Cómo cambia una fila al correr el cuadro a otra cantidad (ADR-12). */
export const ESCALAS = ['fija', 'por_pliego', 'por_unidad'] as const
export type Escala = (typeof ESCALAS)[number]

/** `venta`: la utilidad es un % del precio. `costo`: es un recargo sobre el costo. */
export const BASES_DE_UTILIDAD = ['venta', 'costo'] as const
export type BaseDeUtilidad = (typeof BASES_DE_UTILIDAD)[number]

/**
 * Lo que le pasa a una cotización una vez emitida (PRP-003). Solo se agregan: nunca se edita ni se
 * borra un evento. `enviada` es el hecho de entregar el enlace, no una confirmación de WhatsApp.
 */
export const TIPOS_DE_EVENTO = ['emitida', 'enviada', 'vista', 'aprobada', 'rechazada', 'anulada'] as const
export type TipoDeEvento = (typeof TIPOS_DE_EVENTO)[number]

/**
 * El estado de una cotización: `borrador` mientras no se emite, y luego el del último evento que
 * cuenta (ver `estadoDesdeEventos`). Es lo que se muestra y se filtra en `/cotizaciones`.
 */
export const ESTADOS_DE_COTIZACION = ['borrador', ...TIPOS_DE_EVENTO] as const
export type EstadoDeCotizacion = (typeof ESTADOS_DE_COTIZACION)[number]

/**
 * Por dónde ocurrió un evento: las herramientas (`ui`, `voz`, `agente`, `whatsapp`) o el enlace
 * público que abre el cliente (`enlace`; también el canal de «copiar enlace» al enviar).
 */
export const CANALES_DE_EVENTO = ['ui', 'voz', 'agente', 'whatsapp', 'enlace'] as const
export type CanalDeEvento = (typeof CANALES_DE_EVENTO)[number]
