import type { CotizacionCompletaDto } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { filasDeTotales, type FilaDeTotal } from '../../shared/impresion/logica-impresion.ts';
import { soles } from './logica.ts';

// Lógica pura del documento «Cotización» y del mensaje de WhatsApp. El documento NO lleva costo ni margen:
// solo se leen los campos de precio de la cotización. Todo importe sale del servidor.

export const TITULO_DE_DOCUMENTO = 'Cotización';
export const AVISO_DE_COTIZACION = 'Cotización, no válida como comprobante de pago';
export const MENSAJE_POR_DEFECTO_ETIQUETA = 'Te adjuntamos la cotización en PDF.';

export const formatearDia = (dia: string | null): string => {
  const m = dia ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

export type FilaDeDocumento = { n: number; descripcion: string; cantidad: string; precio: string; importe: string; total: string };

/**
 * El precio unitario que se imprime. Si el guardado (3 decimales) multiplicado por la cantidad da el importe, ese; si no
 * (un cuadro por partes da S/ 5,386.50 por 1,000 y el precio guardado es 5.387), el exacto con hasta 4 decimales:
 * así el cliente que multiplica no encuentra una diferencia.
 */
export function precioQueCuadra(l: Pick<CotizacionCompletaDto['lineas'][number], 'cantidadMilesimas' | 'precioUnitarioMilesimas' | 'importeCentimos'>): string {
  if (Math.round((l.cantidadMilesimas * l.precioUnitarioMilesimas) / 10_000) === l.importeCentimos || l.cantidadMilesimas <= 0) return `S/ ${milesimasATexto(l.precioUnitarioMilesimas)}`;
  const diezmilesimas = Math.round((l.importeCentimos * 100_000) / l.cantidadMilesimas);
  const enteros = Math.trunc(diezmilesimas / 10_000).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimales = String(diezmilesimas % 10_000).padStart(4, '0').replace(/(\d{2}\d*?)0+$/, '$1');
  return `S/ ${enteros}.${decimales}`;
}

export function filasDelDocumento(lineas: CotizacionCompletaDto['lineas']): FilaDeDocumento[] {
  return [...lineas].sort((a, b) => a.posicion - b.posicion).map((l, i) => ({
    n: i + 1,
    descripcion: l.descripcion,
    cantidad: formatearCantidad(l.cantidadMilesimas, l.unidad),
    precio: precioQueCuadra(l),
    importe: soles(l.importeCentimos),
    total: soles(l.totalCentimos),
  }));
}

/** Subtotal, IGV y total de la versión; sin total general cuando las líneas son opciones. */
export function totalesDelDocumento(c: Pick<CotizacionCompletaDto, 'conOpciones' | 'subtotalCentimos' | 'igvCentimos' | 'totalCentimos' | 'igvPorcentaje'>): FilaDeTotal[] | undefined {
  if (c.conOpciones) return undefined;
  const filas = filasDeTotales({ subtotal: c.subtotalCentimos, igv: c.igvCentimos, total: c.totalCentimos }, c.igvPorcentaje / 100);
  // Sin IGV (no se factura): solo el total, sin desglose.
  return c.igvPorcentaje > 0 ? filas : filas.filter((f) => f.destacado);
}

export const textoDeOpciones = (igvPorcentaje: number): string =>
  `Estas líneas son opciones: puedes elegir una o varias.${igvPorcentaje > 0 ? ' El importe de cada una ya incluye su IGV en la última columna.' : ''}`;
/** Aviso del IGV al pie; sin IGV (no se factura) no se dice nada. */
export const textoDeIgv = (igvPorcentaje: number): string => (igvPorcentaje > 0 ? `Precios sin IGV; el IGV (${igvPorcentaje} %) se suma en cada línea.` : '');

/** Condiciones con texto, en el orden en que se leen. Las vacías no salen. */
export function condicionesParaDocumento(c: Pick<CotizacionCompletaDto, 'condiciones' | 'validaHasta'>): Array<{ etiqueta: string; valor: string }> {
  const k = c.condiciones;
  const pares = [
    { etiqueta: 'Válida hasta', valor: c.validaHasta ? formatearDia(c.validaHasta) : k.validezDias ? `${k.validezDias} días desde la emisión` : '' },
    { etiqueta: 'Plazo de entrega', valor: k.plazoEntrega },
    { etiqueta: 'Forma de pago', valor: k.formaPago },
    { etiqueta: 'Tolerancia', valor: k.tolerancia },
    { etiqueta: 'No incluye', valor: k.noIncluye },
  ];
  return pares.filter((p) => p.valor.trim() !== '');
}

// --- WhatsApp ---

/** Solo dígitos para `wa.me`. Un celular peruano de 9 dígitos (empieza en 9) recibe el 51. Menos de 8 dígitos no sirve. */
export function telefonoParaWhatsApp(telefono: string | null | undefined): string | null {
  let d = (telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('9')) d = `51${d}`;
  return d.length >= 8 && d.length <= 15 ? d : null;
}

/** El mensaje de la configuración si lo hay; si no, uno por defecto. Con opciones no se anuncia un total general. */
export function mensajeDeWhatsApp(
  c: Pick<CotizacionCompletaDto, 'codigo' | 'clienteNombre' | 'totalCentimos' | 'conOpciones'>,
  plantilla: string | null | undefined,
): string {
  if (plantilla && plantilla.trim() !== '') return plantilla.trim();
  const saludo = c.clienteNombre ? `Hola ${c.clienteNombre}, ` : 'Hola, ';
  const monto = c.conOpciones ? 'con sus opciones' : `por un total de ${soles(c.totalCentimos)}`;
  return `${saludo}te enviamos la cotización ${c.codigo} ${monto}. ${MENSAJE_POR_DEFECTO_ETIQUETA}`;
}

export function enlaceDeWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = telefonoParaWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
}
