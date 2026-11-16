import { formatearSoles } from '@capaz/shared';

/** Datos de la empresa para el encabezado. Todo es opcional: los llena otro carril desde la configuración. */
export type DatosDeEmpresaImpresion = {
  razonSocial: string | null;
  ruc: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  correo: string | null;
  pieDeDocumento: string | null;
  logoDataUrl: string | null;
};

export const AVISO_DOCUMENTO_INTERNO = 'Documento interno, no válido como comprobante de pago';

const VACIA: DatosDeEmpresaImpresion = {
  razonSocial: null,
  ruc: null,
  direccionFiscal: null,
  telefono: null,
  correo: null,
  pieDeDocumento: null,
  logoDataUrl: null,
};

function limpio(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  return texto ? texto : null;
}

/** Texto vacío, espacios o `undefined` pasan a `null`; el logo solo vale si es una imagen en `data:`. */
export function normalizarEmpresa(entrada?: Partial<DatosDeEmpresaImpresion> | null): DatosDeEmpresaImpresion {
  if (!entrada) return { ...VACIA };
  const logo = limpio(entrada.logoDataUrl);
  return {
    razonSocial: limpio(entrada.razonSocial),
    ruc: limpio(entrada.ruc),
    direccionFiscal: limpio(entrada.direccionFiscal),
    telefono: limpio(entrada.telefono),
    correo: limpio(entrada.correo),
    pieDeDocumento: limpio(entrada.pieDeDocumento),
    logoDataUrl: logo && /^data:image\//i.test(logo) ? logo : null,
  };
}

/** Líneas del encabezado, en orden fijo y sin las vacías. */
export function lineasDelEncabezado(empresa: DatosDeEmpresaImpresion): string[] {
  const contacto = [empresa.telefono && `Tel. ${empresa.telefono}`, empresa.correo].filter(Boolean).join(' · ');
  return [empresa.ruc && `RUC ${empresa.ruc}`, empresa.direccionFiscal, contacto].filter((x): x is string => Boolean(x));
}

/** Líneas del pie: primero el texto libre de la empresa, al final el aviso (si no se apaga con `null`). */
export function lineasDelPie(pieLibre: string | null | undefined, aviso: string | null = AVISO_DOCUMENTO_INTERNO): string[] {
  return [limpio(pieLibre), limpio(aviso)].filter((x): x is string => x !== null);
}

export type FormatoDeColumna = 'texto' | 'soles' | 'numero';
export type AlineacionDeColumna = 'izquierda' | 'centro' | 'derecha';
export type ValorDeCelda = string | number | null | undefined;

/** Los números y los soles van a la derecha salvo que se indique otra cosa. */
export function alineacionPorDefecto(formato: FormatoDeColumna): AlineacionDeColumna {
  return formato === 'texto' ? 'izquierda' : 'derecha';
}

/** `soles` espera céntimos enteros; `numero` muestra hasta 3 decimales con separadores es-PE. */
export function formatearCelda(valor: ValorDeCelda, formato: FormatoDeColumna = 'texto'): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (formato === 'texto') return String(valor);
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return String(valor);
  if (formato === 'soles') return formatearSoles(valor);
  return valor.toLocaleString('es-PE', { maximumFractionDigits: 3 });
}

export type TotalesDeDocumento = { subtotal: number; igv: number; total: number };

/** Parte de una base sin IGV (céntimos enteros). La tasa se pasa en tanto por uno (0.18). */
export function totalesConIgv(subtotalCentimos: number, tasaIgv = 0.18): TotalesDeDocumento {
  const igv = Math.round(subtotalCentimos * tasaIgv);
  return { subtotal: subtotalCentimos, igv, total: subtotalCentimos + igv };
}

/** Parte de un total que ya incluye IGV: deduce la base y el impuesto sin perder céntimos. */
export function totalesDesdeTotal(totalCentimos: number, tasaIgv = 0.18): TotalesDeDocumento {
  const subtotal = Math.round(totalCentimos / (1 + tasaIgv));
  return { subtotal, igv: totalCentimos - subtotal, total: totalCentimos };
}

export type FilaDeTotal = { etiqueta: string; valor: string; destacado?: boolean };

/** Filas listas para la tabla de totales: Subtotal, IGV (con su porcentaje) y Total. */
export function filasDeTotales(t: TotalesDeDocumento, tasaIgv = 0.18): FilaDeTotal[] {
  const pct = Number((tasaIgv * 100).toFixed(2));
  return [
    { etiqueta: 'Subtotal', valor: formatearSoles(t.subtotal) },
    { etiqueta: `IGV (${pct}%)`, valor: formatearSoles(t.igv) },
    { etiqueta: 'Total', valor: formatearSoles(t.total), destacado: true },
  ];
}
