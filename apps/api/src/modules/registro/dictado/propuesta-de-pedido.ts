// REGLA NUEVA: arma la propuesta `pedido_crear` a partir de lo dictado. Importa @capaz/shared (soles e importe) y por eso está
// en la excepción de pureza.spec. Solo propone: no crea clientes ni cobra el adelanto (se cobra al confirmar el pedido).
import { formatearSoles, importe } from '@capaz/shared';
import type { PropuestaInterpretada } from '../../../core/captura/tipos.js';
import type { LineaDictada, PedidoDictado } from './reglas/pedido.js';
import type { ResolucionDeContacto } from './resolver.js';

export const fechaCorta = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

const importeDe = (l: LineaDictada): number | null => (l.precioUnitarioMilesimas === null ? null : importe(l.cantidadMilesimas, l.precioUnitarioMilesimas));

/** Las claves van siempre en este orden; el precio se omite si no se dictó (contrato con la tarjeta de la web). */
const argumentosDeLinea = (l: LineaDictada): Record<string, unknown> => ({
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  ...(l.precioUnitarioMilesimas === null ? {} : { precioUnitarioMilesimas: l.precioUnitarioMilesimas }),
});

function faltaElCliente(p: PedidoDictado, r: ResolucionDeContacto): string[] {
  if (r.contacto) return [];
  if (!p.clienteNombre) return ['a quién es el pedido'];
  if (r.sugerencia?.opciones.length) return [`elige el cliente «${p.clienteNombre}» entre los parecidos`];
  return [`cliente nuevo: «${p.clienteNombre}» (créalo desde la tarjeta)`];
}

function faltanDeLineas(lineas: readonly LineaDictada[]): string[] {
  return lineas.flatMap((l) => {
    if (l.duda === 'sin_precio') return [`el precio de «${l.descripcion}»`];
    if (l.duda === 'total_o_unitario') return [`«${l.descripcion}»: tomé ${formatearSoles(importeDe(l) ?? 0)} como total; si era el precio de cada uno, corrígelo`];
    return [];
  });
}

export function propuestaDePedido(p: PedidoDictado, r: ResolucionDeContacto): { propuestas: PropuestaInterpretada[]; faltan: string[] } {
  if (p.lineas.length === 0) return { propuestas: [], faltan: [] };
  const importes = p.lineas.map(importeDe);
  const hayLineaSinPrecio = importes.some((i) => i === null);
  const total = importes.reduce<number>((suma, i) => suma + (i ?? 0), 0);
  const adelanto = p.adelantoCentimos;
  const notas = adelanto === null ? null : `Adelanto dictado: ${formatearSoles(adelanto)}. Cóbralo al confirmar el pedido.`;
  const args = { clienteId: r.contacto?.id ?? null, entregaEl: p.entregaEl, notas, lineas: p.lineas.map(argumentosDeLinea) };
  const n = p.lineas.length;
  const resumen =
    `Pedido para ${r.contacto?.nombre ?? p.clienteNombre ?? 'cliente por elegir'} · ${n} ${n === 1 ? 'línea' : 'líneas'} · ${hayLineaSinPrecio ? 'falta precio' : formatearSoles(total)}` +
    (adelanto === null ? '' : ` · adelanto ${formatearSoles(adelanto)}`) +
    (p.entregaEl === null ? '' : ` · entrega ${fechaCorta(p.entregaEl)}`);
  const faltan = [
    ...faltaElCliente(p, r),
    ...faltanDeLineas(p.lineas),
    ...(adelanto === null ? [] : [`el adelanto de ${formatearSoles(adelanto)} se cobra al confirmar el pedido`]),
    ...(adelanto !== null && !hayLineaSinPrecio && adelanto > total ? [`el adelanto (${formatearSoles(adelanto)}) supera el total (${formatearSoles(total)})`] : []),
  ];
  const sugerir = !r.contacto && r.sugerencia && r.sugerencia.opciones.length > 0;
  const propuesta: PropuestaInterpretada = {
    herramienta: 'pedido_crear',
    args,
    resumen,
    ...(sugerir ? { sugerencias: [{ ...r.sugerencia!, campo: 'clienteId' }] } : {}),
  };
  return { propuestas: [propuesta], faltan };
}
