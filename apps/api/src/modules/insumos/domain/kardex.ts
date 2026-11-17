// Kardex valorizado (costo promedio ponderado móvil). Puro: sin base ni framework. Cantidades y costos en milésimas
// enteras; el valor sale en céntimos (cantidad/1000 × costo/1000 × 100 = cantidad × costo / 10 000).

export type MovimientoParaKardex = {
  movimientoId: string;
  fecha: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  /** Con signo: entrada > 0, salida < 0, ajuste ≠ 0. */
  cantidadMilesimas: number;
  /** Solo entradas que lo traen. */
  costoUnitarioMilesimas: number | null;
  motivo: string | null;
};

export type FilaDeKardex = {
  movimientoId: string;
  fecha: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  motivo: string | null;
  entradaMilesimas: number;
  salidaMilesimas: number;
  saldoMilesimas: number;
  costoUnitarioMilesimas: number | null;
  costoPromedioMilesimas: number;
  saldoValorizadoCentimos: number;
};

export type Kardex = {
  items: FilaDeKardex[];
  saldoMilesimas: number;
  costoPromedioMilesimas: number;
  valorTotalCentimos: number;
  costosIncompletos: boolean;
};

/** Valor en céntimos de una cantidad a un costo unitario, redondeado al céntimo. */
export const valorEnCentimos = (cantidadMilesimas: number, costoUnitarioMilesimas: number): number => Math.round((cantidadMilesimas * costoUnitarioMilesimas) / 10_000);

/**
 * Recorre los movimientos en orden. Una entrada con costo recalcula el promedio: (valor anterior + valor entrante) / saldo
 * nuevo. Una entrada sin costo entra al promedio vigente y marca `costosIncompletos`. Una salida o un ajuste a la baja
 * salen al promedio vigente. Un ajuste al alza entra al promedio vigente (no cambia el costo). Con saldo cero el promedio
 * se conserva como último conocido, para valorizar la próxima salida si hiciera falta.
 */
export function calcularKardex(movimientos: readonly MovimientoParaKardex[]): Kardex {
  let saldo = 0;
  let valorMilesimas = 0; // saldo (milésimas) × costo (milésimas): se divide entre 10 000 solo al mostrar, para no acumular redondeos
  let promedio = 0;
  let incompletos = false;
  const items: FilaDeKardex[] = [];
  for (const m of movimientos) {
    const entra = m.cantidadMilesimas > 0 ? m.cantidadMilesimas : 0;
    const sale = m.cantidadMilesimas < 0 ? -m.cantidadMilesimas : 0;
    if (entra > 0) {
      const costo = m.tipo === 'entrada' && m.costoUnitarioMilesimas !== null ? m.costoUnitarioMilesimas : promedio;
      if (m.tipo === 'entrada' && m.costoUnitarioMilesimas === null) incompletos = true;
      valorMilesimas += entra * costo;
      saldo += entra;
      if (saldo > 0) promedio = Math.round(valorMilesimas / saldo);
    } else {
      saldo -= sale;
      valorMilesimas = saldo * promedio;
    }
    items.push({
      movimientoId: m.movimientoId,
      fecha: m.fecha,
      tipo: m.tipo,
      motivo: m.motivo,
      entradaMilesimas: entra,
      salidaMilesimas: sale,
      saldoMilesimas: saldo,
      costoUnitarioMilesimas: m.costoUnitarioMilesimas,
      costoPromedioMilesimas: promedio,
      saldoValorizadoCentimos: valorEnCentimos(saldo, promedio),
    });
  }
  return { items, saldoMilesimas: saldo, costoPromedioMilesimas: promedio, valorTotalCentimos: valorEnCentimos(saldo, promedio), costosIncompletos: incompletos };
}
