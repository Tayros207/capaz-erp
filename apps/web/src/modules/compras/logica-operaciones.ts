import type { Centimos, ConciliacionDto, EntradaDe, EstadoDeSolicitudDeCompra } from '@capaz/shared';
import type { Opcion as OpcionDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Reglas puras de las pantallas de solicitudes de compra y facturas del proveedor: sin React ni red.

export const ETIQUETA_DE_SOLICITUD: Readonly<Record<EstadoDeSolicitudDeCompra, string>> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente de aprobar',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  convertida: 'Convertida en orden',
  anulada: 'Anulada',
};

export const TONO_DE_SOLICITUD: Readonly<Record<EstadoDeSolicitudDeCompra, TonoDeInsignia>> = {
  borrador: 'neutro',
  pendiente: 'aviso',
  aprobada: 'info',
  rechazada: 'peligro',
  convertida: 'exito',
  anulada: 'neutro',
};

export const FILTROS_DE_SOLICITUD = {
  abiertas: 'Abiertas',
  pendiente: 'Pendientes de aprobar',
  aprobada: 'Aprobadas',
  convertida: 'Convertidas',
  rechazada: 'Rechazadas',
  anulada: 'Anuladas',
  todas: 'Todas',
} as const;

/** Qué se puede hacer con una solicitud según su estado (quién puede hacerlo lo decide el permiso). */
export const accionesDeSolicitud = (estado: EstadoDeSolicitudDeCompra) => ({
  enviar: estado === 'borrador',
  resolver: estado === 'pendiente',
  convertir: estado === 'aprobada',
  anular: estado === 'borrador' || estado === 'pendiente' || estado === 'aprobada',
});

export const ETIQUETA_DE_CONCILIACION: Readonly<Record<ConciliacionDto['estado'], string>> = {
  sin_orden: 'Sin orden',
  coincide: 'Cuadra',
  difiere: 'Difiere',
  otra_moneda: 'Otra moneda',
};

export const TONO_DE_CONCILIACION: Readonly<Record<ConciliacionDto['estado'], TonoDeInsignia>> = {
  sin_orden: 'neutro',
  coincide: 'exito',
  difiere: 'peligro',
  otra_moneda: 'aviso',
};

/** «+S/ 12.00 de más» o «S/ 5.00 de menos»; nulo si no hay diferencia que decir. */
export function textoDeDiferencia(centimos: number | null, soles: (c: number) => string): string | null {
  if (centimos === null || centimos === 0) return null;
  return `${soles(Math.abs(centimos))} ${centimos > 0 ? 'de más' : 'de menos'}`;
}

// --- Solicitud nueva ---

export type LineaDeSolicitud = { clave: number; producto: OpcionDeRegistro | null; descripcion: string; cantidad: number | null };
export type FormularioDeSolicitud = { area: string; necesariaEl: string; motivo: string; lineas: LineaDeSolicitud[] };
export type ErroresDeSolicitud = { lineas?: string; necesariaEl?: string };

export const lineaDeSolicitudVacia = (clave: number): LineaDeSolicitud => ({ clave, producto: null, descripcion: '', cantidad: null });
const llena = (l: LineaDeSolicitud) => l.producto !== null || l.descripcion.trim() !== '' || l.cantidad !== null;

export function validarSolicitud(f: FormularioDeSolicitud, hoy: string): ErroresDeSolicitud {
  const e: ErroresDeSolicitud = {};
  const llenas = f.lineas.filter(llena);
  if (llenas.length === 0) e.lineas = 'Agrega al menos una línea con lo que se necesita.';
  else if (llenas.some((l) => (!l.producto && !l.descripcion.trim()) || !l.cantidad || l.cantidad <= 0)) e.lineas = 'Cada línea necesita un producto o una descripción, y una cantidad mayor que cero.';
  if (f.necesariaEl && f.necesariaEl < hoy) e.necesariaEl = 'La fecha no puede ser anterior a hoy.';
  return e;
}

export function argumentosDeSolicitud(f: FormularioDeSolicitud): EntradaDe<'solicitud_crear'> {
  return {
    ...(f.area.trim() && { area: f.area.trim() }),
    ...(f.necesariaEl && { necesariaEl: f.necesariaEl }),
    ...(f.motivo.trim() && { motivo: f.motivo.trim() }),
    lineas: f.lineas.filter(llena).map((l) => ({
      ...(l.producto && { productoId: l.producto.id }),
      ...(l.descripcion.trim() && { descripcion: l.descripcion.trim() }),
      cantidadMilesimas: l.cantidad!,
    })),
  };
}

// --- Factura nueva ---

export type FormularioDeFactura = {
  proveedor: OpcionDeRegistro | null;
  ordenId: string;
  serie: string;
  numero: string;
  fecha: string;
  venceEl: string;
  moneda: 'PEN' | 'USD' | 'EUR';
  subtotal: Centimos | null;
  igv: Centimos | null;
  notas: string;
};
export type ErroresDeFactura = Partial<Record<'proveedor' | 'serie' | 'numero' | 'subtotal' | 'venceEl', string>>;

export function validarFactura(f: FormularioDeFactura): ErroresDeFactura {
  const e: ErroresDeFactura = {};
  if (!f.proveedor) e.proveedor = 'Elige el proveedor.';
  if (!f.serie.trim()) e.serie = 'Escribe la serie.';
  if (!f.numero.trim()) e.numero = 'Escribe el número.';
  if (f.subtotal === null) e.subtotal = 'Escribe la base sin IGV.';
  if (f.venceEl && f.fecha && f.venceEl < f.fecha) e.venceEl = 'El vencimiento no puede ser anterior a la fecha.';
  return e;
}

export function argumentosDeFactura(f: FormularioDeFactura): EntradaDe<'factura_registrar'> {
  return {
    proveedorId: f.proveedor!.id,
    ...(f.ordenId && { ordenId: f.ordenId }),
    serie: f.serie.trim(),
    numero: f.numero.trim(),
    ...(f.fecha && { fecha: f.fecha }),
    ...(f.venceEl && { venceEl: f.venceEl }),
    moneda: f.moneda,
    subtotalCentimos: f.subtotal ?? 0,
    igvCentimos: f.igv ?? 0,
    ...(f.notas.trim() && { notas: f.notas.trim() }),
  };
}
