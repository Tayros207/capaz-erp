import { formatearSoles, textoDeFicha, type CorreccionDePedidoDto, type FichaParcial, type MotivoDeCorreccion } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { formatearDia } from './logica.ts';

// Lectura de la huella de una corrección («corregido»): palabras para el historial, la lista de Correcciones y el documento.
// Lógica pura; no importa nada de la pantalla.

export const ETIQUETA_DE_MOTIVO: Readonly<Record<MotivoDeCorreccion, string>> = {
  igv: 'IGV',
  precio_acordado: 'Precio acordado',
  cantidad: 'Cantidad',
  lineas: 'Líneas',
  error_digitacion: 'Error de digitación',
  otro: 'Otro',
};

/** «+S/ 10.00», «−S/ 10.00» o «Sin cambio». */
export function textoDeDelta(centimos: number): string {
  if (centimos === 0) return 'Sin cambio';
  return `${centimos > 0 ? '+' : '−'}${formatearSoles(Math.abs(centimos))}`;
}

/** Sube el total: más ingreso (éxito); baja: menos ingreso (peligro, con el signo escrito además del color). */
export const tonoDeDelta = (centimos: number): 'exito' | 'peligro' | 'neutro' => (centimos > 0 ? 'exito' : centimos < 0 ? 'peligro' : 'neutro');

type Valores = { cantidadMilesimas: number; unidad?: string; precioUnitarioMilesimas: number; afectoIgv: boolean; importeCentimos: number };

/** «50 unidad × S/ 15.00 = S/ 750.00» (el unitario con sus tres decimales si hacen falta: 0.085). */
export function textoDeValoresDeLinea(v: Valores & { unidad: string }): string {
  const igv = v.afectoIgv ? '' : ' (no afecto a IGV)';
  return `${formatearCantidad(v.cantidadMilesimas, v.unidad)} × S/ ${milesimasATexto(v.precioUnitarioMilesimas)} = ${formatearSoles(v.importeCentimos)}${igv}`;
}

/** «ficha: A → B» si la ficha cambió; nada si es la misma. */
export function textoDeCambioDeFicha(antes: FichaParcial, despues: FichaParcial): string[] {
  const a = textoDeFicha(antes);
  const d = textoDeFicha(despues);
  return a === d ? [] : [`ficha: ${a || 'sin ficha'} → ${d || 'sin ficha'}`];
}

export function textoDeLineaCorregida(l: CorreccionDePedidoDto['lineas'][number]): string {
  if (l.antes && l.despues) {
    const va = textoDeValoresDeLinea(l.antes);
    const vd = textoDeValoresDeLinea(l.despues);
    const partes = [...(va === vd ? [] : [`${va} → ${vd}`]), ...textoDeCambioDeFicha(l.antes, l.despues)];
    return `«${l.descripcion}»: ${(partes.length ? partes : [`${va} → ${vd}`]).join(' · ')}`;
  }
  if (l.despues) {
    const ficha = textoDeFicha(l.despues);
    return `Se agregó «${l.descripcion}»: ${textoDeValoresDeLinea(l.despues)}${ficha ? ` · ficha: ${ficha}` : ''}`;
  }
  return `Se quitó «${l.descripcion}»${l.antes ? `: ${textoDeValoresDeLinea(l.antes)}` : ''}`;
}

const CAMPO = { entregaEl: 'Entrega', notas: 'Notas', clienteId: 'Cliente' } as const;

function textoDeDato(d: CorreccionDePedidoDto['datos'][number]): string {
  const ver = (v: string | null, etiqueta: string | null | undefined) => (v === null ? '—' : d.campo === 'entregaEl' ? formatearDia(v) : (etiqueta ?? v));
  return `${CAMPO[d.campo]}: ${ver(d.antes, d.antesEtiqueta)} → ${ver(d.despues, d.despuesEtiqueta)}`;
}

/** «IGV» o «IGV · se acordó por teléfono». */
export const textoDeMotivo = (codigo: MotivoDeCorreccion, texto: string | null | undefined): string => [ETIQUETA_DE_MOTIVO[codigo], texto?.trim()].filter(Boolean).join(' · ');

export function textoDeTotal(c: Pick<CorreccionDePedidoDto, 'totalAnteriorCentimos' | 'totalNuevoCentimos' | 'deltaCentimos'>): string {
  return `Total: ${formatearSoles(c.totalAnteriorCentimos)} → ${formatearSoles(c.totalNuevoCentimos)} (${textoDeDelta(c.deltaCentimos)})`;
}

/** Lo que cambió, sin el motivo: líneas, otros datos y total. Sirve para el recuadro «Qué cambió» del documento. */
export function lineasDeCambio(c: CorreccionDePedidoDto): string[] {
  return [...c.lineas.map(textoDeLineaCorregida), ...c.datos.map(textoDeDato), textoDeTotal(c)];
}

/** La huella completa para el historial: versión, motivo, cambios y, si quedó a favor del cliente, cuánto. */
export function lineasDeHuellaDeCorreccion(c: CorreccionDePedidoDto): string[] {
  const aFavor = c.aFavorCentimos ?? 0;
  return [
    `Versión ${c.versionAnterior} → ${c.versionNueva}`,
    `Motivo: ${textoDeMotivo(c.motivoCodigo, c.motivoTexto)}`,
    ...lineasDeCambio(c),
    ...(aFavor > 0 ? [`A favor del cliente: ${formatearSoles(aFavor)} (no se devuelve)`] : []),
  ];
}
