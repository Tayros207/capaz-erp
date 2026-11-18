import { z } from 'zod';
import { contrato } from '../herramientas.js';

// «Precio anterior»: ¿cuánto le cobramos la última vez a este cliente por este producto? Cada módulo con ventas (pedidos,
// cotizaciones, órdenes de trabajo) entrega sus filas con `<modulo>_precios_anteriores`; el núcleo las compara y las junta
// con `precio_anterior_consultar`. Aquí solo están los esquemas: los contratos de cada subherramienta viven en el archivo de
// su módulo y el del composer se registra en `contratosDePreciosAnteriores`.

const dia = z.iso.date();
const texto = (max: number) => z.string().trim().max(max);

export const FUENTES_DE_PRECIO_ANTERIOR = ['pedido', 'cotizacion', 'orden_trabajo'] as const;
export const BASES_DE_PRECIO = ['con_igv', 'sin_igv', 'sin_desglose'] as const;
/** `del_cliente`: sin producto buscado, lo último que se le cobró al cliente por cada cosa (una fila por producto). */
export const COINCIDENCIAS_DE_PRECIO = ['producto', 'misma_descripcion', 'parecida', 'del_cliente'] as const;
export const MAXIMO_DE_RAICES = 12;
export const LIMITE_DE_DOCUMENTOS_POR_DEFECTO = 60;
export const MAXIMO_DE_DOCUMENTOS = 200;
export const MAXIMO_DEL_HISTORIAL = 30;

/** Una línea vendida o cotizada antes, con el documento del que salió. Cantidad y precio en milésimas; el importe, en céntimos. */
export const filaDePrecioAnteriorSchema = z.strictObject({
  fuente: z.enum(FUENTES_DE_PRECIO_ANTERIOR),
  documento: z.strictObject({ id: z.string(), codigo: z.string(), estado: z.string(), fecha: dia }),
  cliente: z.strictObject({ id: z.string(), nombre: z.string() }),
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int().safe(),
  precioUnitarioMilesimas: z.number().int().safe(),
  /** Con qué IGV viene `precioUnitarioMilesimas`: una orden de trabajo guarda el «valor acordado» sin desglose. */
  baseDePrecio: z.enum(BASES_DE_PRECIO),
  igvPorcentaje: z.number().int().min(0).max(100).nullable(),
  precioConIgvMilesimas: z.number().int().safe().nullable(),
  precioSinIgvMilesimas: z.number().int().safe().nullable(),
  importeCentimos: z.number().int().safe(),
  /** De qué nació el documento (p. ej. el pedido que salió de una cotización). */
  origen: z.strictObject({ tipo: z.string(), id: z.string() }).nullable(),
});
export type FilaDePrecioAnterior = z.infer<typeof filaDePrecioAnteriorSchema>;

/** Entrada común de las subherramientas: solo filtra en SQL (cliente, producto, raíces de la descripción, desde cuándo). */
export const entradaDePreciosAnterioresSchema = z
  .strictObject({
    clienteId: z.uuid().optional(),
    productoId: z.uuid().optional(),
    raices: z.array(z.string().regex(/^[a-z0-9]{2,20}$/, { error: 'Raíz no válida.' })).max(MAXIMO_DE_RAICES).optional(),
    desde: dia.optional(),
    limiteDocumentos: z.number().int().min(1).max(MAXIMO_DE_DOCUMENTOS).default(LIMITE_DE_DOCUMENTOS_POR_DEFECTO),
  })
  .refine((v) => v.clienteId !== undefined || v.productoId !== undefined || (v.raices?.length ?? 0) > 0, {
    error: 'Indica el cliente o el producto.',
  });
export const salidaDePreciosAnterioresSchema = z.strictObject({ filas: z.array(filaDePrecioAnteriorSchema) });
export type SalidaDePreciosAnteriores = z.infer<typeof salidaDePreciosAnterioresSchema>;

export const filaConCoincidenciaSchema = filaDePrecioAnteriorSchema.extend({
  coincidencia: z.enum(COINCIDENCIAS_DE_PRECIO),
  /** 1 para el mismo producto; el puntaje de parecido de la descripción en los demás casos. */
  puntaje: z.number().min(0).max(1),
});
export type FilaConCoincidencia = z.infer<typeof filaConCoincidenciaSchema>;

export const entradaDePrecioAnteriorSchema = z
  .strictObject({
    clienteId: z.uuid().optional(),
    clienteTexto: texto(120).min(1).optional(),
    productoId: z.uuid().optional(),
    texto: texto(300).min(1).optional(),
    limite: z.number().int().min(1).max(MAXIMO_DEL_HISTORIAL).default(10),
  })
  // Solo con el cliente se listan sus últimos precios, uno por producto; sin cliente hace falta el producto.
  .refine((v) => v.productoId || v.texto || v.clienteId || v.clienteTexto, { error: 'Indica el cliente o el producto.' });

export const salidaDePrecioAnteriorSchema = z.strictObject({
  /** El cliente resuelto; `null` si se buscó solo por producto o si hubo que elegir entre candidatos. */
  cliente: z.strictObject({ id: z.string(), nombre: z.string() }).nullable(),
  candidatosDeCliente: z.array(z.strictObject({ id: z.string(), nombre: z.string(), parecido: z.number() })),
  ultimo: filaConCoincidenciaSchema.nullable(),
  historial: z.array(filaConCoincidenciaSchema),
  /** Qué módulos se consultaron y cuáles no («no incluye órdenes de trabajo: sin acceso»). */
  fuentesConsultadas: z.array(z.strictObject({ fuente: z.enum(FUENTES_DE_PRECIO_ANTERIOR), incluida: z.boolean(), aviso: z.string().nullable() })),
});
export type PrecioAnteriorDto = z.infer<typeof salidaDePrecioAnteriorSchema>;

export const contratosDePreciosAnteriores = {
  precio_anterior_consultar: contrato(entradaDePrecioAnteriorSchema, salidaDePrecioAnteriorSchema),
} as const;
