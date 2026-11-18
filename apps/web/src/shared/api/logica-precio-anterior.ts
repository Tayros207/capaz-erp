import type { FilaConCoincidencia } from '@capaz/shared';

// Lógica pura de «precio anterior» que comparten las pantallas de pedidos, cotizaciones y la de precios.

export type PrecioAnterior = FilaConCoincidencia;

export const MINIMO_DE_LETRAS_DE_DESCRIPCION = 3;
export const ESPERA_DE_SUGERENCIA_MS = 400;

/** ¿Vale la pena preguntar? Hace falta cliente y, además, un producto o al menos 3 letras de descripción. */
export const puedeSugerir = (clienteId: string | null | undefined, productoId: string | null | undefined, descripcion: string): boolean =>
  !!clienteId && (!!productoId || descripcion.trim().length >= MINIMO_DE_LETRAS_DE_DESCRIPCION);

/**
 * El precio unitario (milésimas) que «Usar» pone en la fila, en la base con la que se está trabajando. El «valor acordado» de una
 * orden de trabajo no trae desglose: se usa tal cual.
 */
export function precioParaUsar(f: Pick<PrecioAnterior, 'baseDePrecio' | 'precioUnitarioMilesimas' | 'precioConIgvMilesimas' | 'precioSinIgvMilesimas'>, conIgv: boolean): number {
  if (f.baseDePrecio === 'sin_desglose') return f.precioUnitarioMilesimas;
  return (conIgv ? f.precioConIgvMilesimas : f.precioSinIgvMilesimas) ?? f.precioUnitarioMilesimas;
}

/**
 * La unidad que queda en la fila al tocar «Usar»: el precio anterior vale POR su unidad (S/ 85 por millar no es S/ 85 por
 * unidad), así que se copia mientras la persona no haya elegido una. Si ya la eligió, se respeta la suya.
 */
export function unidadAlUsar(actual: string, elegidaPorLaPersona: boolean, delPrecio: string): string {
  return !elegidaPorLaPersona && delPrecio.trim() !== '' ? delPrecio : actual;
}

/** Con qué IGV se muestra el precio que ofrece `precioParaUsar`. */
export function baseMostrada(f: Pick<PrecioAnterior, 'baseDePrecio'>, conIgv: boolean): 'con IGV' | 'sin IGV' | 'precio final acordado' {
  if (f.baseDePrecio === 'sin_desglose') return 'precio final acordado';
  return conIgv ? 'con IGV' : 'sin IGV';
}

export const ETIQUETA_DE_FUENTE: Record<PrecioAnterior['fuente'], string> = { pedido: 'Pedido', cotizacion: 'Cotizado', orden_trabajo: 'Orden de trabajo' };

/** `2026-05-10` → `10/05/2026`. Se corta el texto: pasar por `Date` correría el día por la zona horaria. */
export function diaATexto(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** Milésimas → texto plano para un campo editable (sin comas de miles): 118000 → «118», 240 → «0.24», 12505 → «12.505». */
export function milesimasATextoPlano(milesimas: number): string {
  const enteros = Math.trunc(milesimas / 1000);
  const decimales = String(milesimas % 1000).padStart(3, '0').replace(/0+$/, '');
  return decimales ? `${enteros}.${decimales}` : String(enteros);
}

/** Dónde se abre el documento de una fila (ficha de pedido, de cotización o de orden de trabajo). */
export function rutaDelDocumento(f: Pick<PrecioAnterior, 'fuente' | 'documento'>): string {
  switch (f.fuente) {
    case 'pedido':
      return `/m/ordenes/${f.documento.id}`;
    case 'cotizacion':
      return `/m/cotizador/cotizaciones/${f.documento.id}`;
    case 'orden_trabajo':
      return `/m/produccion/${f.documento.id}`;
  }
}
