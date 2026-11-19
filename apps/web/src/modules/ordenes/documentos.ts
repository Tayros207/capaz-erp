import type { EstadoDePedido, LineaDePedidoDto, PedidoCompletoDto } from '@capaz/shared';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { filasDeTotales, type FilaDeTotal } from '../../shared/impresion/logica-impresion.ts';
import { formatearDia, sumarDias } from './logica.ts';

// Lógica pura de los documentos imprimibles del pedido: sin React ni red, nada se guarda.

export type TipoDeDocumento = 'proforma' | 'nota' | 'orden-de-trabajo';

export const DIAS_DE_VIGENCIA = 7;

export const TITULO_DE_DOCUMENTO: Readonly<Record<TipoDeDocumento, string>> = {
  proforma: 'Proforma',
  nota: 'Nota de pedido',
  'orden-de-trabajo': 'Orden de trabajo',
};

const DESDE_CONFIRMADO: readonly EstadoDePedido[] = ['confirmado', 'en_proceso', 'listo', 'entregado'];

const ESTADOS_PERMITIDOS: Readonly<Record<TipoDeDocumento, readonly EstadoDePedido[]>> = {
  proforma: ['borrador', 'confirmado'],
  nota: DESDE_CONFIRMADO,
  'orden-de-trabajo': DESDE_CONFIRMADO,
};

/** Qué estados permiten cada documento: la proforma, borrador o confirmado; los otros, confirmado o posterior (nunca cancelado). */
export const sePuedeImprimir = (tipo: TipoDeDocumento, estado: EstadoDePedido): boolean => ESTADOS_PERMITIDOS[tipo].includes(estado);

export const documentosDisponibles = (estado: EstadoDePedido): TipoDeDocumento[] =>
  (Object.keys(ESTADOS_PERMITIDOS) as TipoDeDocumento[]).filter((t) => sePuedeImprimir(t, estado));

export const esTipoDeDocumento = (valor: string): valor is TipoDeDocumento => valor in ESTADOS_PERMITIDOS;

/** «Válida por 7 días desde el 01/03/2026 (hasta el 08/03/2026)». Texto calculado, no se guarda. */
export function textoDeVigencia(fecha: string, dias = DIAS_DE_VIGENCIA): string {
  return `Válida por ${dias} días desde el ${formatearDia(fecha)} (hasta el ${formatearDia(sumarDias(fecha, dias))})`;
}

export type FilaDeDocumento = { n: number; descripcion: string; cantidad: string; precio?: string; importe?: string };

/** Filas por posición. Sin precios (orden de trabajo) las filas no llevan ni precio ni importe. */
export function filasDelDocumento(detalle: readonly LineaDePedidoDto[], conPrecios: boolean): FilaDeDocumento[] {
  return [...detalle]
    .sort((a, b) => a.posicion - b.posicion)
    .map((l, i) => {
      const base: FilaDeDocumento = { n: i + 1, descripcion: l.descripcion, cantidad: formatearCantidad(l.cantidadMilesimas, l.unidad) };
      if (!conPrecios) return base;
      return { ...base, precio: formatearSoles(Math.round(l.precioUnitarioMilesimas / 10)), importe: formatearSoles(l.importeCentimos) };
    });
}

/** Subtotal, IGV con su porcentaje y total, tal como los calculó el servidor. */
export function totalesDelDocumento(p: Pick<PedidoCompletoDto, 'subtotalCentimos' | 'igvCentimos' | 'totalCentimos' | 'igvPorcentaje'>): FilaDeTotal[] {
  return filasDeTotales({ subtotal: p.subtotalCentimos, igv: p.igvCentimos, total: p.totalCentimos }, p.igvPorcentaje / 100);
}

/** Lo que el cliente ya dejó a cuenta del pedido, tomado de su deuda en Finanzas. */
export type AdelantoDelPedido = { abonadoCentimos: number; saldoCentimos: number };

/** Con adelanto cobrado, el documento agrega «Adelanto recibido» y «Saldo por pagar» debajo del total. Sin adelanto, queda igual. */
export function totalesConAdelanto(base: FilaDeTotal[], adelanto: AdelantoDelPedido | null | undefined): FilaDeTotal[] {
  if (!adelanto || adelanto.abonadoCentimos <= 0) return base;
  return [...base, { etiqueta: 'Adelanto recibido', valor: formatearSoles(adelanto.abonadoCentimos) }, { etiqueta: 'Saldo por pagar', valor: formatearSoles(adelanto.saldoCentimos), destacado: true }];
}

/** Texto del IGV para el pie de la proforma: «Los precios incluyen IGV (18 %)». */
export const textoDeIgvIncluido = (igvPorcentaje: number): string => `Los precios incluyen IGV (${igvPorcentaje} %)`;

/** Solo dígitos para `wa.me`. Un celular peruano de 9 dígitos (empieza en 9) recibe el 51. Menos de 8 dígitos no sirve. */
export function telefonoParaWhatsApp(telefono: string | null | undefined): string | null {
  let d = (telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('9')) d = `51${d}`;
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export function mensajeDeWhatsApp(p: Pick<PedidoCompletoDto, 'codigo' | 'clienteNombre' | 'totalCentimos' | 'estado'>): string {
  const documento = p.estado === 'borrador' ? 'la proforma' : 'el pedido';
  return `Hola ${p.clienteNombre}, te enviamos ${documento} ${p.codigo} por un total de ${formatearSoles(p.totalCentimos)}. Te adjuntamos el documento en PDF.`;
}

/** Enlace `https://wa.me/<teléfono>?text=<mensaje>`; nulo si el cliente no tiene teléfono utilizable. */
export function enlaceDeWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = telefonoParaWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
}
