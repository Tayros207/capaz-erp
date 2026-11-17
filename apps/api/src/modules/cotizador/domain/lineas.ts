// Líneas de una cotización: de la lista (el servidor calcula el precio) o manuales. Precios SIN IGV; el IGV va por línea.
import { importe, type LineaDeCotizacionEntrada } from '@capaz/shared';
import { igvDeImporte } from './igv.js';
import { cotizarDesdeLista, type ListaParaCotizar, type RedondeoComercial } from './precios.js';

export type CodigoDeRechazoDeLinea = 'conflicto' | 'argumentos_invalidos' | 'no_encontrado';
export type RechazoDeLinea = { ok: false; codigo: CodigoDeRechazoDeLinea; mensaje: string };

/** Lo que se necesita de una lista para cotizar una línea. */
export type ListaDeLinea = ListaParaCotizar & { id: string; nombre: string; unidad: string; productoId: string | null; archivada: boolean };

export type LineaArmada = {
  tipo: 'lista' | 'manual';
  productoId: string | null;
  listaId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  importeCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  /** Rastro del cálculo de una línea de lista (texto y números); `{}` en una manual. */
  detalle: Record<string, string | number | boolean | null>;
};
export type ContextoDeLineas = {
  listas: ReadonlyMap<string, ListaDeLinea>;
  /** Ajuste del cliente como lo guarda la base ('-5.000'); `null` si no hay cliente o no tiene. */
  ajusteClientePct: string | null;
  redondeo: RedondeoComercial;
  igvPorcentaje: number;
};
export type Totales = { subtotalCentimos: number; igvCentimos: number; totalCentimos: number };

const rechazoEn = (posicion: number, codigo: CodigoDeRechazoDeLinea, mensaje: string): RechazoDeLinea => ({ ok: false, codigo, mensaje: `Línea ${posicion + 1}: ${mensaje}` });

function armarDeLista(e: Extract<LineaDeCotizacionEntrada, { tipo: 'lista' }>, i: number, c: ContextoDeLineas): { ok: true; linea: LineaArmada } | RechazoDeLinea {
  const lista = c.listas.get(e.listaId);
  if (!lista) return rechazoEn(i, 'no_encontrado', 'no existe esa lista de precios.');
  if (lista.archivada) return rechazoEn(i, 'conflicto', `la lista «${lista.nombre}» está archivada.`);
  const r = cotizarDesdeLista(lista, { cantidadMilesimas: e.cantidadMilesimas, ajusteClientePct: c.ajusteClientePct, redondeo: c.redondeo, ajuste: { tipo: 'ninguno' }, igvPorcentaje: c.igvPorcentaje });
  if (!r.ok) return rechazoEn(i, r.codigo, r.mensaje);
  const v = r.valor;
  return {
    ok: true,
    linea: {
      tipo: 'lista',
      productoId: lista.productoId,
      listaId: lista.id,
      descripcion: e.descripcion ?? lista.nombre,
      unidad: lista.unidad,
      cantidadMilesimas: e.cantidadMilesimas,
      precioUnitarioMilesimas: v.precioUnitarioMilesimas,
      importeCentimos: v.importeCentimos,
      igvCentimos: v.igvCentimos,
      totalCentimos: v.totalCentimos,
      detalle: { precioListaCentimos: v.precioListaCentimos, minimoAplicado: v.minimoAplicado, ajusteClientePct: v.ajusteClientePct, redondeo: c.redondeo },
    },
  };
}

function armarManual(e: Extract<LineaDeCotizacionEntrada, { tipo: 'manual' }>, i: number, igvPorcentaje: number): { ok: true; linea: LineaArmada } | RechazoDeLinea {
  let importeCentimos: number;
  try {
    importeCentimos = importe(e.cantidadMilesimas, e.precioUnitarioMilesimas);
    const igvCentimos = igvDeImporte(importeCentimos, igvPorcentaje);
    return {
      ok: true,
      linea: {
        tipo: 'manual',
        productoId: e.productoId ?? null,
        listaId: null,
        descripcion: e.descripcion,
        unidad: e.unidad,
        cantidadMilesimas: e.cantidadMilesimas,
        precioUnitarioMilesimas: e.precioUnitarioMilesimas,
        importeCentimos,
        igvCentimos,
        totalCentimos: importeCentimos + igvCentimos,
        detalle: {},
      },
    };
  } catch {
    return rechazoEn(i, 'argumentos_invalidos', 'el importe es demasiado grande.');
  }
}

/** Arma todas las líneas, en orden; la primera que no se puede cotizar detiene el proceso. */
export function armarLineas(entradas: readonly LineaDeCotizacionEntrada[], c: ContextoDeLineas): { ok: true; lineas: LineaArmada[] } | RechazoDeLinea {
  const lineas: LineaArmada[] = [];
  for (const [i, e] of entradas.entries()) {
    const r = e.tipo === 'lista' ? armarDeLista(e, i, c) : armarManual(e, i, c.igvPorcentaje);
    if (!r.ok) return r;
    lineas.push(r.linea);
  }
  return { ok: true, lineas };
}

/** Los totales de la versión: sumas de las líneas (el IGV ya se calculó por línea). */
export function totalesDe(lineas: readonly Pick<LineaArmada, 'importeCentimos' | 'igvCentimos' | 'totalCentimos'>[]): Totales {
  const suma = (f: (l: (typeof lineas)[number]) => number) => lineas.reduce((a, l) => a + f(l), 0);
  const t = { subtotalCentimos: suma((l) => l.importeCentimos), igvCentimos: suma((l) => l.igvCentimos), totalCentimos: suma((l) => l.totalCentimos) };
  if (![t.subtotalCentimos, t.igvCentimos, t.totalCentimos].every(Number.isSafeInteger)) throw new RangeError('El total de la cotización es demasiado grande.');
  return t;
}

export type LineaGuardada = Pick<LineaArmada, 'tipo' | 'productoId' | 'listaId' | 'descripcion' | 'unidad' | 'cantidadMilesimas' | 'precioUnitarioMilesimas'>;

/** Una línea ya guardada, vuelta a su forma de entrada (para recalcular las de lista con los precios de hoy). */
export function entradaDeLineaGuardada(l: LineaGuardada): LineaDeCotizacionEntrada {
  if (l.tipo === 'lista' && l.listaId) return { tipo: 'lista', listaId: l.listaId, cantidadMilesimas: l.cantidadMilesimas, descripcion: l.descripcion };
  return { tipo: 'manual', productoId: l.productoId, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas };
}
