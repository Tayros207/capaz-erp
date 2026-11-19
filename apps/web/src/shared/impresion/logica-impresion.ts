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

/** Tamaños de hoja: A4 completo, A5 (media hoja) y A6 (cuarto de hoja, para documentos de pocas líneas). */
export type FormatoDeHoja = 'a4' | 'a5' | 'a6';

/** Cuánto ocupa la hoja además de sus líneas: sin precios (guía, orden de trabajo del pedido) o con precios, totales y adelanto. */
export type PerfilDeHoja = 'sin-precios' | 'con-precios';

/** Hasta cuántos renglones cabe cada perfil en A6 y en A5; con más, A4. */
export const RENGLONES_POR_FORMATO: Readonly<Record<PerfilDeHoja, { a6: number; a5: number }>> = {
  'sin-precios': { a6: 2, a5: 8 },
  'con-precios': { a6: 1, a5: 6 },
};
export const CARACTERES_POR_RENGLON = 80;
export const CARACTERES_DE_NOTA_POR_RENGLON = 100;

/** La hoja más chica en la que cabe el documento sin cortarse. */
export function formatoDeHoja(perfil: PerfilDeHoja, renglones: number): FormatoDeHoja {
  const limite = RENGLONES_POR_FORMATO[perfil];
  if (renglones <= limite.a6) return 'a6';
  return renglones <= limite.a5 ? 'a5' : 'a4';
}

/** Cada línea cuenta 1, y 1 más por cada 80 caracteres de descripción; las notas cuentan 1 por cada 100 caracteres. */
export function renglonesDeDocumento(descripciones: readonly string[], notas?: string | null): number {
  const deLineas = descripciones.reduce((s, d) => s + Math.max(1, Math.ceil(d.trim().length / CARACTERES_POR_RENGLON)), 0);
  return deLineas + Math.ceil((notas?.trim() ?? '').length / CARACTERES_DE_NOTA_POR_RENGLON);
}

/** Crédito que va al pie de todo documento que sale del ERP hacia un cliente. */
export const TEXTO_DE_CREDITO = 'Generado por ERP Capaz, un producto de Datayros';

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
