import {
  UMBRAL_DE_TRABAJADOR_CENTIMOS,
  UMBRAL_DE_TRABAJADOR_PORCENTAJE,
  calcularTotalesDePedido,
  formatearSoles,
  importe,
  type CorreccionDePedidoDto,
  type EstadoDePedido,
  type LineaACorregir,
} from '@capaz/shared';
import { NOMBRE_DE_ESTADO } from './estados.js';

// Reglas puras de «Corregir pedido confirmado» (versión 2): quién puede, en qué estado, qué líneas cambian, lo que impiden las
// guías de remisión, el umbral del trabajador y el reparto de un total fijado. Sin base ni framework.
//
// Regla del trabajador: hoy los permisos son solo «completo/lectura» por módulo (core/modulos/acceso.ts), así que «quién es
// dueño o administrador» se decide con `ctx.rol` (`owner` o `admin`). Cualquier otro rol corrige solo dentro del umbral.

export type LineaActual = {
  id: string;
  posicion: number;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  afectoIgv: boolean;
  importeCentimos: number;
};

export const esAdministrador = (rol: string | null): boolean => rol === 'owner' || rol === 'admin';

export type ModoDeCorreccion =
  | { ok: true; modo: 'completa' | 'solo_precio' }
  | { ok: false; codigo: 'conflicto' | 'sin_permiso'; motivo: string };

/**
 * Confirmado, en proceso o listo: se cambian montos y líneas. Entregado: solo precio e IGV y solo dueño o administrador.
 * Borrador se edita con `pedido_editar`; cancelado no se corrige.
 */
export function modoDeCorreccion(estado: EstadoDePedido, rol: string | null): ModoDeCorreccion {
  if (estado === 'confirmado' || estado === 'en_proceso' || estado === 'listo') return { ok: true, modo: 'completa' };
  if (estado === 'entregado') {
    return esAdministrador(rol)
      ? { ok: true, modo: 'solo_precio' }
      : { ok: false, codigo: 'sin_permiso', motivo: 'Un pedido entregado solo lo corrige el dueño o un administrador.' };
  }
  if (estado === 'borrador') return { ok: false, codigo: 'conflicto', motivo: 'Un pedido en borrador se edita con «Editar pedido»; esta corrección es para pedidos ya confirmados.' };
  return { ok: false, codigo: 'conflicto', motivo: `Un pedido «${NOMBRE_DE_ESTADO[estado]}» ya no se puede corregir.` };
}

export type LineasResueltas = {
  conservadas: { actual: LineaActual; nueva: LineaACorregir }[];
  agregadas: LineaACorregir[];
  quitadas: LineaActual[];
};

/** Empareja las líneas que llegan con las guardadas por `id`. `null` y el motivo si un `id` no es del pedido o se repite. */
export function resolverLineas(actuales: readonly LineaActual[], nuevas: readonly LineaACorregir[]): { ok: true; lineas: LineasResueltas } | { ok: false; motivo: string } {
  const porId = new Map(actuales.map((l) => [l.id, l]));
  const usadas = new Set<string>();
  const conservadas: LineasResueltas['conservadas'] = [];
  const agregadas: LineaACorregir[] = [];
  for (const [i, n] of nuevas.entries()) {
    if (!n.id) {
      agregadas.push(n);
      continue;
    }
    const actual = porId.get(n.id);
    if (!actual) return { ok: false, motivo: `Línea ${i + 1}: no es una línea de este pedido.` };
    if (usadas.has(n.id)) return { ok: false, motivo: `Línea ${i + 1}: esa línea del pedido aparece dos veces.` };
    usadas.add(n.id);
    conservadas.push({ actual, nueva: n });
  }
  return { ok: true, lineas: { conservadas, agregadas, quitadas: actuales.filter((l) => !usadas.has(l.id)) } };
}

/** Un pedido entregado solo admite cambios de precio e IGV: nada de líneas nuevas o quitadas, cantidades ni descripciones. */
export function comprobarSoloPrecioEIgv(l: LineasResueltas): { ok: true } | { ok: false; motivo: string } {
  if (l.agregadas.length > 0 || l.quitadas.length > 0) return { ok: false, motivo: 'En un pedido entregado no se agregan ni se quitan líneas: solo se corrige el precio o el IGV.' };
  const tocada = l.conservadas.find(({ actual: a, nueva: n }) => a.cantidadMilesimas !== n.cantidadMilesimas || a.descripcion !== n.descripcion || a.unidad !== n.unidad || (a.productoId ?? null) !== (n.productoId ?? a.productoId));
  return tocada ? { ok: false, motivo: `En un pedido entregado solo se corrige el precio o el IGV: «${tocada.actual.descripcion}» cambia otra cosa.` } : { ok: true };
}

export type LineaResultante = {
  id: string | null;
  posicion: number;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  afectoIgv: boolean;
  importeCentimos: number;
};

const valores = (l: Pick<LineaActual, 'descripcion' | 'unidad' | 'cantidadMilesimas' | 'precioUnitarioMilesimas' | 'afectoIgv' | 'importeCentimos'>) => ({
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  precioUnitarioMilesimas: l.precioUnitarioMilesimas,
  afectoIgv: l.afectoIgv,
  importeCentimos: l.importeCentimos,
});

const distinta = (a: LineaActual, d: LineaResultante): boolean =>
  a.descripcion !== d.descripcion || a.unidad !== d.unidad || a.cantidadMilesimas !== d.cantidadMilesimas || a.precioUnitarioMilesimas !== d.precioUnitarioMilesimas || a.afectoIgv !== d.afectoIgv || (a.productoId ?? null) !== (d.productoId ?? null);

/** Solo las líneas que cambian, con su antes y su después (la huella). `nuevas` ya trae el `id` de las que se conservan. */
export function diferenciasDeLineas(antes: readonly LineaActual[], despues: readonly LineaResultante[]): CorreccionDePedidoDto['lineas'] {
  const salida: CorreccionDePedidoDto['lineas'] = [];
  const conservadas = new Set<string>();
  for (const d of despues) {
    const a = d.id ? antes.find((x) => x.id === d.id) : undefined;
    if (!a) {
      salida.push({ cambio: 'agregada', lineaId: d.id ?? '', descripcion: d.descripcion, antes: null, despues: valores(d) });
      continue;
    }
    conservadas.add(a.id);
    if (distinta(a, d) || a.importeCentimos !== d.importeCentimos) salida.push({ cambio: 'cambiada', lineaId: a.id, descripcion: d.descripcion, antes: valores(a), despues: valores(d) });
  }
  for (const a of antes) if (!conservadas.has(a.id)) salida.push({ cambio: 'quitada', lineaId: a.id, descripcion: a.descripcion, antes: valores(a), despues: null });
  return salida;
}

/** Lo que las guías de remisión (por línea) impiden. `codigosPorLinea`: guías de cualquier estado; `enviadas`: milésimas en guías emitidas. */
export function comprobarGuias(
  l: LineasResueltas,
  guias: { codigosPorLinea: ReadonlyMap<string, readonly string[]>; enviadas: ReadonlyMap<string, number> },
): { ok: true } | { ok: false; motivo: string } {
  for (const q of l.quitadas) {
    const codigos = guias.codigosPorLinea.get(q.id);
    if (codigos?.length) return { ok: false, motivo: `No se puede quitar «${q.descripcion}»: ya figura en la guía ${codigos.join(', ')} (una guía anulada también la conserva). Déjala o cambia su precio.` };
  }
  for (const { actual, nueva } of l.conservadas) {
    const enviado = guias.enviadas.get(actual.id) ?? 0;
    if (nueva.cantidadMilesimas < enviado) {
      return { ok: false, motivo: `No se puede bajar «${actual.descripcion}» a ${nueva.cantidadMilesimas / 1000}: ya se enviaron ${enviado / 1000} en guías emitidas. Anula la guía o deja al menos esa cantidad.` };
    }
  }
  return { ok: true };
}

export type Umbral = { ok: true } | { ok: false; motivo: string };

/**
 * Un trabajador corrige sin aprobación solo si la diferencia es de hasta 10 % del total anterior Y hasta S/ 100, sin
 * excedente a favor del cliente (lo ya abonado no supera el total nuevo). El estado entregado ya lo excluye `modoDeCorreccion`.
 * `abonadoCentimos` `null` = no se sabe: no se puede comprobar el excedente (la corrección por `venta_corregir` siempre lo sabe).
 */
export function comprobarUmbralDeTrabajador(c: { totalAnteriorCentimos: number; totalNuevoCentimos: number; abonadoCentimos: number | null }): Umbral {
  const delta = Math.abs(c.totalNuevoCentimos - c.totalAnteriorCentimos);
  const dentroDelPorcentaje = delta * 100 <= c.totalAnteriorCentimos * UMBRAL_DE_TRABAJADOR_PORCENTAJE;
  const dentroDelImporte = delta <= UMBRAL_DE_TRABAJADOR_CENTIMOS;
  const aFavor = c.abonadoCentimos !== null && c.abonadoCentimos > c.totalNuevoCentimos;
  if (dentroDelPorcentaje && dentroDelImporte && !aFavor) return { ok: true };
  const signo = c.totalNuevoCentimos >= c.totalAnteriorCentimos ? 'sube' : 'baja';
  const porque = aFavor
    ? 'el cliente ya pagó más que el total nuevo y quedaría saldo a su favor'
    : `la diferencia (${formatearSoles(delta)}) pasa de ${UMBRAL_DE_TRABAJADOR_PORCENTAJE} % del total o de ${formatearSoles(UMBRAL_DE_TRABAJADOR_CENTIMOS)}`;
  return {
    ok: false,
    motivo: `Esta corrección ${signo} el total de ${formatearSoles(c.totalAnteriorCentimos)} a ${formatearSoles(c.totalNuevoCentimos)}: ${porque}. Hasta ${UMBRAL_DE_TRABAJADOR_PORCENTAJE} % y ${formatearSoles(UMBRAL_DE_TRABAJADOR_CENTIMOS)} se corrige sin aprobación; esto lo aprueba el dueño o un administrador.`,
  };
}

/** Lo que el cliente pagó de más con el total nuevo (queda a su favor, no se devuelve). */
export const aFavorDelCliente = (abonadoCentimos: number, totalNuevoCentimos: number): number => Math.max(0, abonadoCentimos - totalNuevoCentimos);

/**
 * Deja el total en `totalDeseado` repartiendo el cambio entre los precios de las líneas en proporción a su importe actual.
 * El precio va en milésimas, así que casi siempre se llega al céntimo exacto; el resto se ajusta en la línea de cantidad más
 * chica. `null` si con estas cantidades no hay precio que dé ese total exacto o si todas las líneas valen cero.
 */
export function fijarTotal<T extends { cantidadMilesimas: number; precioUnitarioMilesimas: number; afectoIgv: boolean }>(lineas: readonly T[], totalDeseado: number, igvPorcentaje: number): T[] | null {
  const actuales = calcularTotalesDePedido(lineas, igvPorcentaje).lineas.map((l) => BigInt(l.importeCentimos));
  const suma = actuales.reduce((a, b) => a + b, 0n);
  if (suma === 0n || lineas.length === 0) return null;
  const total = BigInt(totalDeseado);
  const base = actuales.map((i) => (total * i) / suma);
  let sobrante = Number(total - base.reduce((a, b) => a + b, 0n));
  const orden = actuales.map((_, i) => i).sort((a, b) => Number(actuales[b]! - actuales[a]!));
  for (let k = 0; sobrante > 0; k = (k + 1) % orden.length, sobrante--) base[orden[k]!]! += 1n;
  const precioPara = (c: number, objetivo: bigint) => Number((objetivo * 10_000n + BigInt(c) / 2n) / BigInt(c));
  const nuevas = lineas.map((l, i) => ({ ...l, precioUnitarioMilesimas: precioPara(l.cantidadMilesimas, base[i]!) }));
  const importes = nuevas.map((l) => importe(l.cantidadMilesimas, l.precioUnitarioMilesimas));
  let faltante = totalDeseado - importes.reduce((a, b) => a + b, 0);
  if (faltante === 0) return nuevas;
  // El redondeo del precio dejó una diferencia de céntimos: se busca, línea por línea (la de cantidad más chica primero), un precio que la cierre.
  const porCantidad = nuevas.map((_, i) => i).sort((a, b) => nuevas[a]!.cantidadMilesimas - nuevas[b]!.cantidadMilesimas);
  for (const i of porCantidad) {
    const l = nuevas[i]!;
    const meta = importes[i]! + faltante;
    if (meta < 0) continue;
    for (let d = 1; d <= 3000; d++) {
      for (const p of [l.precioUnitarioMilesimas + d, l.precioUnitarioMilesimas - d]) {
        if (p >= 0 && importe(l.cantidadMilesimas, p) === meta) {
          nuevas[i] = { ...l, precioUnitarioMilesimas: p };
          faltante = 0;
          return nuevas;
        }
      }
    }
  }
  return null;
}

/** El aviso para quien corrige: el taller ya tiene la orden impresa. */
export function avisosDeCorreccion(estado: EstadoDePedido, versionNueva: number, hayGuiasEmitidas: boolean): string[] {
  const avisos: string[] = [];
  if (estado === 'en_proceso' || estado === 'listo') avisos.push(`El taller ya trabaja en este pedido: reimprime la orden de trabajo versión ${versionNueva}.`);
  if (hayGuiasEmitidas) avisos.push('Este pedido tiene guías de remisión emitidas: revisa que sigan de acuerdo con las líneas corregidas.');
  return avisos;
}

/** Una frase con el antes y el después, para la lista de correcciones. */
export function resumenDeCorreccion(c: Pick<CorreccionDePedidoDto, 'lineas' | 'datos' | 'totalAnteriorCentimos' | 'totalNuevoCentimos' | 'versionAnterior' | 'versionNueva'>): string {
  const partes: string[] = [];
  const n = (cambio: string) => c.lineas.filter((l) => l.cambio === cambio).length;
  if (n('cambiada')) partes.push(`${n('cambiada')} línea${n('cambiada') === 1 ? '' : 's'} cambiada${n('cambiada') === 1 ? '' : 's'}`);
  if (n('agregada')) partes.push(`${n('agregada')} agregada${n('agregada') === 1 ? '' : 's'}`);
  if (n('quitada')) partes.push(`${n('quitada')} quitada${n('quitada') === 1 ? '' : 's'}`);
  if (c.datos.length) partes.push(c.datos.map((d) => ({ entregaEl: 'entrega', notas: 'notas', clienteId: 'cliente' })[d.campo]).join(', '));
  const dinero = c.totalAnteriorCentimos === c.totalNuevoCentimos ? `total sin cambio (${formatearSoles(c.totalNuevoCentimos)})` : `total ${formatearSoles(c.totalAnteriorCentimos)} → ${formatearSoles(c.totalNuevoCentimos)}`;
  return `v${c.versionAnterior} → v${c.versionNueva}: ${[...partes, dinero].join(' · ')}`;
}
