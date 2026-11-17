import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Compras · operaciones de empresa grande (0026): solicitudes de compra con aprobación y facturas del proveedor
// conciliadas contra la orden y lo recibido. Dinero en céntimos enteros; cantidades en milésimas.

export const ESTADOS_DE_SOLICITUD_DE_COMPRA = ['borrador', 'pendiente', 'aprobada', 'rechazada', 'convertida', 'anulada'] as const;
export type EstadoDeSolicitudDeCompra = (typeof ESTADOS_DE_SOLICITUD_DE_COMPRA)[number];
export const FILTROS_DE_SOLICITUDES_DE_COMPRA = ['abiertas', ...ESTADOS_DE_SOLICITUD_DE_COMPRA, 'todas'] as const;
export const DECISIONES_DE_SOLICITUD_DE_COMPRA = ['aprobar', 'rechazar'] as const;
export const MAXIMO_DE_LINEAS_DE_SOLICITUD = 100;

export const MONEDAS_DE_FACTURA = ['PEN', 'USD', 'EUR'] as const;
export const FILTROS_DE_FACTURAS = ['vigentes', 'anuladas', 'todas'] as const;
export const ESTADOS_DE_CONCILIACION = ['sin_orden', 'coincide', 'difiere', 'otra_moneda'] as const;
/** Diferencia máxima, en céntimos, que se acepta entre la factura y la orden por redondeos del proveedor. */
export const TOLERANCIA_DE_CONCILIACION_CENTIMOS = 10;

const texto = (max: number) => z.string().trim().max(max);
const id = z.uuid();
const soloId = z.strictObject({ id });
const dia = z.iso.date();
const centimosNoNegativos = z.number().int().safe().min(0, { error: 'El monto no puede ser negativo.' });

// ───────── Solicitudes de compra ─────────

export const solicitudDeCompraLineaSchema = z.strictObject({
  posicion: z.number().int(),
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
});

export const solicitudDeCompraSchema = z.strictObject({
  id: z.string(),
  /** «SC-0001-2026»; nulo mientras es borrador. */
  codigo: z.string().nullable(),
  numero: z.number().int().nullable(),
  anio: z.number().int().nullable(),
  estado: z.enum(ESTADOS_DE_SOLICITUD_DE_COMPRA),
  fecha: z.string(),
  necesariaEl: z.string().nullable(),
  area: z.string().nullable(),
  motivo: z.string().nullable(),
  ordenId: z.string().nullable(),
  solicitadoPor: z.string(),
  resueltoPor: z.string().nullable(),
  resueltoEn: z.iso.datetime().nullable(),
  motivoResolucion: z.string().nullable(),
  lineas: z.array(solicitudDeCompraLineaSchema),
  creadoEn: z.iso.datetime(),
});
export type SolicitudDeCompraDto = z.infer<typeof solicitudDeCompraSchema>;

export const lineaDeSolicitudEntradaSchema = z
  .strictObject({
    productoId: id.nullish(),
    descripcion: texto(300).optional(),
    unidad: texto(20).optional(),
    cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
  })
  .refine((l) => Boolean(l.productoId) || Boolean(l.descripcion), { error: 'Una línea sin producto necesita descripción.' });

export const crearSolicitudSchema = z.strictObject({
  fecha: dia.optional(),
  necesariaEl: dia.optional(),
  area: texto(100).optional(),
  motivo: texto(500).optional(),
  lineas: z.array(lineaDeSolicitudEntradaSchema).min(1, { error: 'Indica al menos una línea.' }).max(MAXIMO_DE_LINEAS_DE_SOLICITUD),
});

export const resolverSolicitudSchema = z
  .strictObject({ id, decision: z.enum(DECISIONES_DE_SOLICITUD_DE_COMPRA), motivo: texto(300).optional() })
  .refine((v) => v.decision === 'aprobar' || Boolean(v.motivo), { error: 'Indica el motivo del rechazo.' });

export const convertirSolicitudSchema = z.strictObject({
  id,
  proveedorId: id,
  sucursalId: id.optional(),
  entregaEl: dia.optional(),
  /** Costo unitario (milésimas, IGV incluido) por posición de la solicitud; sin él, la línea queda en cero para completarla en el borrador. */
  costos: z.array(z.strictObject({ posicion: z.number().int().min(1), costoUnitarioMilesimas: z.number().int().safe().min(0) })).max(MAXIMO_DE_LINEAS_DE_SOLICITUD).optional(),
});

export const anularSolicitudSchema = z.strictObject({ id, motivo: texto(300).min(1, { error: 'Indica el motivo.' }) });
export const listarSolicitudesSchema = z.strictObject({ ...paginaSchema.shape, estado: z.enum(FILTROS_DE_SOLICITUDES_DE_COMPRA).default('abiertas') });

// ───────── Facturas del proveedor ─────────

export const conciliacionSchema = z.strictObject({
  estado: z.enum(ESTADOS_DE_CONCILIACION),
  ordenTotalCentimos: z.number().int().nullable(),
  recibidoCentimos: z.number().int().nullable(),
  /** Factura menos orden; positivo = el proveedor cobra de más. */
  diferenciaConOrdenCentimos: z.number().int().nullable(),
  /** Factura menos lo recibido; positivo = se factura más de lo que llegó. */
  diferenciaConRecibidoCentimos: z.number().int().nullable(),
});
export type ConciliacionDto = z.infer<typeof conciliacionSchema>;

export const facturaSchema = z.strictObject({
  id: z.string(),
  proveedorId: z.string(),
  proveedorNombre: z.string(),
  ordenId: z.string().nullable(),
  ordenCodigo: z.string().nullable(),
  serie: z.string(),
  numero: z.string(),
  /** «F001-123». */
  comprobante: z.string(),
  fecha: z.string(),
  venceEl: z.string().nullable(),
  moneda: z.enum(MONEDAS_DE_FACTURA),
  subtotalCentimos: z.number().int(),
  igvCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  notas: z.string().nullable(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
  conciliacion: conciliacionSchema,
  creadoEn: z.iso.datetime(),
});
export type FacturaDto = z.infer<typeof facturaSchema>;

export const registrarFacturaSchema = z.strictObject({
  proveedorId: id,
  ordenId: id.optional(),
  serie: texto(20).min(1, { error: 'La serie es obligatoria.' }),
  numero: texto(30).min(1, { error: 'El número es obligatorio.' }),
  fecha: dia.optional(),
  venceEl: dia.optional(),
  moneda: z.enum(MONEDAS_DE_FACTURA).default('PEN'),
  subtotalCentimos: centimosNoNegativos,
  igvCentimos: centimosNoNegativos.default(0),
  notas: texto(500).optional(),
});
export const anularFacturaSchema = z.strictObject({ id, motivo: texto(300).min(1, { error: 'Indica el motivo.' }) });
export const listarFacturasSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_FACTURAS).default('vigentes'),
  proveedorId: id.optional(),
  ordenId: id.optional(),
});

export const contratosDeComprasOperaciones = {
  solicitud_crear: contrato(crearSolicitudSchema, solicitudDeCompraSchema),
  solicitud_enviar: contrato(soloId, solicitudDeCompraSchema),
  solicitud_resolver: contrato(resolverSolicitudSchema, solicitudDeCompraSchema),
  solicitud_convertir: contrato(convertirSolicitudSchema, solicitudDeCompraSchema),
  solicitud_anular: contrato(anularSolicitudSchema, solicitudDeCompraSchema),
  solicitud_ver: contrato(soloId, solicitudDeCompraSchema),
  solicitudes_listar: contrato(listarSolicitudesSchema, listadoSchema(solicitudDeCompraSchema)),
  factura_registrar: contrato(registrarFacturaSchema, facturaSchema),
  factura_anular: contrato(anularFacturaSchema, facturaSchema),
  factura_ver: contrato(soloId, facturaSchema),
  facturas_listar: contrato(listarFacturasSchema, listadoSchema(facturaSchema)),
} as const;

export const eventosDeComprasOperaciones = {
  'solicitud.resuelta': z.strictObject({ id: z.string(), decision: z.enum(DECISIONES_DE_SOLICITUD_DE_COMPRA) }),
  'factura.registrada': z.strictObject({ id: z.string(), proveedorId: z.string(), totalCentimos: z.number().int(), conciliacion: z.enum(ESTADOS_DE_CONCILIACION) }),
} as const;

/**
 * Compara la factura con la orden y lo recibido. Pura: la usan el servidor y las pruebas.
 * Solo se compara en la misma moneda (las órdenes de compra están en soles); otra moneda se marca aparte.
 */
export function conciliarFactura(f: { totalCentimos: number; moneda: string; ordenTotalCentimos: number | null; recibidoCentimos: number | null }): ConciliacionDto {
  if (f.ordenTotalCentimos === null) return { estado: 'sin_orden', ordenTotalCentimos: null, recibidoCentimos: null, diferenciaConOrdenCentimos: null, diferenciaConRecibidoCentimos: null };
  if (f.moneda !== 'PEN') return { estado: 'otra_moneda', ordenTotalCentimos: f.ordenTotalCentimos, recibidoCentimos: f.recibidoCentimos, diferenciaConOrdenCentimos: null, diferenciaConRecibidoCentimos: null };
  const conOrden = f.totalCentimos - f.ordenTotalCentimos;
  const conRecibido = f.recibidoCentimos === null ? null : f.totalCentimos - f.recibidoCentimos;
  // Coincide si cuadra con la orden, o con lo recibido cuando la recepción fue parcial y ya se facturó solo eso.
  const cuadra = (d: number | null) => d !== null && Math.abs(d) <= TOLERANCIA_DE_CONCILIACION_CENTIMOS;
  return {
    estado: cuadra(conOrden) || (cuadra(conRecibido) && (f.recibidoCentimos ?? 0) > 0) ? 'coincide' : 'difiere',
    ordenTotalCentimos: f.ordenTotalCentimos,
    recibidoCentimos: f.recibidoCentimos,
    diferenciaConOrdenCentimos: conOrden,
    diferenciaConRecibidoCentimos: conRecibido,
  };
}
