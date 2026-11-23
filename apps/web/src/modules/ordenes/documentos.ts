import type { CorreccionDePedidoDto, EstadoDePedido, LineaDePedidoDto, PedidoCompletoDto, VersionDePedidoDto } from '@capaz/shared';
import { textoDeFicha, textoDeFichaConEtiquetas } from '@capaz/shared';
import { formatearFecha } from '../../shared/formato/fechas.ts';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { filasDeTotales, formatoDeHoja, renglonesDeDocumento, type FilaDeTotal, type FormatoDeHoja } from '../../shared/impresion/logica-impresion.ts';
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

export type FilaDeDocumento = { n: number; descripcion: string; cantidad: string; precio?: string; importe?: string; ficha?: string };

/** «Tarjetas — couché 300 g · A5»: la descripción con la ficha pegada (nota y proforma); sin ficha, la descripción tal cual. */
export const descripcionConFicha = (l: Pick<LineaDePedidoDto, 'descripcion' | 'material' | 'medida' | 'colores' | 'acabado'>): string => {
  const ficha = textoDeFicha(l);
  return ficha ? `${l.descripcion} — ${ficha}` : l.descripcion;
};

/** Filas por posición. El unitario se imprime con sus milésimas (S/ 0.085, no 0.09) para que la cuenta cuadre con el importe. Sin precios (orden de trabajo) las filas no llevan ni precio ni importe. */
export function filasDelDocumento(detalle: readonly LineaDePedidoDto[], conPrecios: boolean): FilaDeDocumento[] {
  return [...detalle]
    .sort((a, b) => a.posicion - b.posicion)
    .map((l, i) => {
      const base: FilaDeDocumento = { n: i + 1, descripcion: l.descripcion, cantidad: formatearCantidad(l.cantidadMilesimas, l.unidad) };
      if (!conPrecios) {
        const ficha = textoDeFichaConEtiquetas(l);
        return { ...base, ...(ficha && { ficha }) };
      }
      return { ...base, descripcion: descripcionConFicha(l), precio: `S/ ${milesimasATexto(l.precioUnitarioMilesimas)}`, importe: formatearSoles(l.importeCentimos) };
    });
}

/** Subtotal, IGV con su porcentaje y total, tal como los calculó el servidor. */
export function totalesDelDocumento(p: Pick<PedidoCompletoDto, 'subtotalCentimos' | 'igvCentimos' | 'totalCentimos' | 'igvPorcentaje'>): FilaDeTotal[] {
  return filasDeTotales({ subtotal: p.subtotalCentimos, igv: p.igvCentimos, total: p.totalCentimos }, p.igvPorcentaje / 100);
}

/** Lo que el cliente ya dejó a cuenta del pedido, tomado de su deuda en Finanzas. */
export type AdelantoDelPedido = { abonadoCentimos: number; saldoCentimos: number };

/** Lo que dice la deuda real del pedido: estado, vencimiento y si ya pasó (`vencida` lo calcula Finanzas con el día de la empresa). */
export type EstadoDeLaDeuda = { estado: 'pendiente' | 'parcial' | 'pagada' | 'anulada'; vencida: boolean; venceEn: string | null };

export type EstadoDePago = 'Pagado' | 'Con saldo' | 'Sin pago' | 'Vencida';

/**
 * El estado de pago con palabras claras, sacado de la deuda real: «Vencida» si pasó el vencimiento y aún se debe algo, «Pagado»
 * si no queda saldo, «Con saldo» si hubo abonos y «Sin pago» si no. Sin deuda (o anulada) no hay estado: no se inventa ninguno.
 */
export function estadoDePago(d: EstadoDeLaDeuda | null | undefined): EstadoDePago | null {
  if (!d || d.estado === 'anulada') return null;
  if (d.estado === 'pagada') return 'Pagado';
  if (d.vencida) return 'Vencida';
  return d.estado === 'parcial' ? 'Con saldo' : 'Sin pago';
}

/** «vence el 30/11/2026» (o «venció el …» si ya pasó) mientras quede algo por cobrar y la deuda tenga fecha; si no, nada. */
export const textoDeVencimiento = (d: EstadoDeLaDeuda | null | undefined): string | null =>
  d && d.venceEn && (d.estado === 'pendiente' || d.estado === 'parcial') ? `${d.vencida ? 'venció' : 'vence'} el ${formatearDia(d.venceEn)}` : null;

/**
 * Con adelanto cobrado, el documento agrega «Adelanto recibido» y «Saldo por pagar» debajo del total. Sin adelanto, queda igual.
 * Si una corrección bajó el pedido por debajo de lo ya pagado, agrega «A favor del cliente» (no se devuelve) con la diferencia.
 */
export function totalesConAdelanto(base: FilaDeTotal[], adelanto: AdelantoDelPedido | null | undefined, totalDelPedidoCentimos?: number): FilaDeTotal[] {
  if (!adelanto || adelanto.abonadoCentimos <= 0) return base;
  const aFavor = totalDelPedidoCentimos === undefined ? 0 : Math.max(0, adelanto.abonadoCentimos - totalDelPedidoCentimos);
  return [
    ...base,
    { etiqueta: 'Adelanto recibido', valor: formatearSoles(adelanto.abonadoCentimos) },
    { etiqueta: 'Saldo por pagar', valor: formatearSoles(adelanto.saldoCentimos), destacado: aFavor === 0 },
    ...(aFavor > 0 ? [{ etiqueta: 'A favor del cliente (no se devuelve)', valor: formatearSoles(aFavor), destacado: true }] : []),
  ];
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

export function mensajeDeWhatsApp(p: Pick<PedidoCompletoDto, 'codigo' | 'clienteNombre' | 'totalCentimos' | 'estado'> & { version?: number }): string {
  if ((p.version ?? 1) > 1 && p.estado !== 'borrador') return `Hola ${p.clienteNombre}, te enviamos la versión ${p.version} del pedido ${p.codigo}, que reemplaza a la anterior, por un total de ${formatearSoles(p.totalCentimos)}. Te adjuntamos el documento en PDF.`;
  const documento = p.estado === 'borrador' ? 'la proforma' : 'el pedido';
  return `Hola ${p.clienteNombre}, te enviamos ${documento} ${p.codigo} por un total de ${formatearSoles(p.totalCentimos)}. Te adjuntamos el documento en PDF.`;
}

/** Enlace `https://wa.me/<teléfono>?text=<mensaje>`; nulo si el cliente no tiene teléfono utilizable. */
export function enlaceDeWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = telefonoParaWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
}

/** Lo pagado y lo que falta de un pedido corregido, tomado de su deuda. */
export type PagosParaMensaje = { abonadoCentimos: number; saldoCentimos: number; aFavorCentimos: number };

/** «versión 2 del pedido PED-…, reemplaza a la anterior: total S/ X, ya dejaste S/ Y, falta S/ Z» (o «a tu favor S/ W»). */
export function mensajeDeWhatsAppDeVersion(p: Pick<PedidoCompletoDto, 'codigo' | 'clienteNombre' | 'totalCentimos' | 'version'>, pagos: PagosParaMensaje | null): string {
  const base = `Hola ${p.clienteNombre}, versión ${p.version} del pedido ${p.codigo}, reemplaza a la anterior: total ${formatearSoles(p.totalCentimos)}`;
  if (!pagos) return `${base}. Te adjuntamos el documento en PDF.`;
  const resto = pagos.aFavorCentimos > 0 ? `a tu favor ${formatearSoles(pagos.aFavorCentimos)}` : `falta ${formatearSoles(pagos.saldoCentimos)}`;
  return `${base}, ya dejaste ${formatearSoles(pagos.abonadoCentimos)}, ${resto}. Te adjuntamos el documento en PDF.`;
}

// --- Versiones: el pedido corregido («versión 2») y la reimpresión de una versión reemplazada ---

export const textoDeReemplazada = (versionNueva: number): string => `REEMPLAZADA por la versión ${versionNueva}`;

/** El pedido tal como era en la versión `version` (la foto guardada), para reimprimirlo; `null` si esa versión no existe. */
export function pedidoDeVersion(p: PedidoCompletoDto, version: number): PedidoCompletoDto | null {
  const v = p.versiones.find((x) => x.version === version);
  if (!v) return null;
  const f = v.foto;
  return { ...p, version, estado: f.estado, clienteId: f.clienteId, clienteNombre: f.clienteNombre, fecha: f.fecha, entregaEl: f.entregaEl, notas: f.notas, igvPorcentaje: f.igvPorcentaje, subtotalCentimos: f.subtotalCentimos, igvCentimos: f.igvCentimos, totalCentimos: f.totalCentimos, detalle: f.lineas };
}

/** «Versión 2 · reemplaza a la del 18/11/2026»; `null` en la versión 1. La fecha es la de la versión anterior (el pedido, o cuando esa se creó). */
export function textoDeVersion(version: number, fecha: string, versiones: readonly Pick<VersionDePedidoDto, 'version' | 'creadoEn'>[]): string | null {
  if (version <= 1) return null;
  const anterior = version - 1 === 1 ? formatearDia(fecha) : formatearFecha(versiones.find((v) => v.version === version - 2)?.creadoEn ?? fecha);
  return `Versión ${version} · reemplaza a la del ${anterior}`;
}

/** La corrección que dio origen a la versión vigente (la última `corregido` del historial). */
export function correccionVigente(p: Pick<PedidoCompletoDto, 'version' | 'historial'>): CorreccionDePedidoDto | null {
  for (const e of [...p.historial].reverse()) {
    const c = e.tipo === 'corregido' ? e.detalle?.correccion : undefined;
    if (c && c.versionNueva === p.version) return c;
  }
  return null;
}

/** La orden de trabajo (sin precios) admite más líneas por hoja; su ficha cuenta como un renglón propio. */
export function formatoDelDocumento(tipo: TipoDeDocumento, p: Pick<PedidoCompletoDto, 'detalle' | 'notas'>): FormatoDeHoja {
  if (tipo !== 'orden-de-trabajo') return formatoDeHoja('con-precios', renglonesDeDocumento(p.detalle.map(descripcionConFicha), p.notas));
  const renglones = p.detalle.flatMap((x) => {
    const f = textoDeFichaConEtiquetas(x);
    return f ? [x.descripcion, f] : [x.descripcion];
  });
  return formatoDeHoja('sin-precios', renglonesDeDocumento(renglones, p.notas));
}
