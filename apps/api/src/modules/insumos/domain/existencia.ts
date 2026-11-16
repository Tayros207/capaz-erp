// Reglas de existencias (FICHAS-OLA-3 §2 y §6.1). Puras: sin base ni framework. Todo en milésimas enteras.
// P3-1: la existencia nunca queda negativa; una salida mayor a lo que hay se rechaza con el faltante.

export type TipoDeMovimiento = 'entrada' | 'salida' | 'ajuste';
export type TipoManual = 'entrada' | 'salida';

/** Un movimiento con signo: entrada > 0, salida < 0, ajuste ≠ 0 (los mismos `CHECK` de la tabla). */
export type Movimiento = { tipo: TipoDeMovimiento; cantidadMilesimas: number };

export type Aplicado = {
  ok: true;
  /** Existencia después del movimiento: va a `existencia_resultante_milesimas`. */
  resultanteMilesimas: number;
  /** La existencia queda por debajo del mínimo. */
  bajoMinimo: boolean;
  /** Estaba en el mínimo o por encima y queda por debajo: solo entonces se avisa (`existencia.bajo_minimo`). */
  cruzaMinimo: boolean;
};
export type Faltante = { ok: false; disponibleMilesimas: number; faltanteMilesimas: number };

/** Entrada o salida tecleada: la cantidad llega positiva y aquí toma su signo. */
export function movimientoManual(tipo: TipoManual, cantidadMilesimas: number): Movimiento {
  if (!Number.isSafeInteger(cantidadMilesimas) || cantidadMilesimas <= 0) throw new RangeError('La cantidad debe ser un entero mayor que cero.');
  return { tipo, cantidadMilesimas: tipo === 'entrada' ? cantidadMilesimas : -cantidadMilesimas };
}

/** Ajuste a lo contado: la diferencia con lo que hay. `null` si ya coincide (un ajuste nunca es cero). */
export function movimientoDeAjuste(actualMilesimas: number, contadaMilesimas: number): Movimiento | null {
  if (!Number.isSafeInteger(contadaMilesimas) || contadaMilesimas < 0) throw new RangeError('La existencia contada no puede ser negativa.');
  const diferencia = contadaMilesimas - actualMilesimas;
  return diferencia === 0 ? null : { tipo: 'ajuste', cantidadMilesimas: diferencia };
}

/** Por debajo del mínimo. Con mínimo cero nunca lo está (la existencia no baja de cero). */
export const estaBajoMinimo = (cantidadMilesimas: number, minimoMilesimas: number): boolean => cantidadMilesimas < minimoMilesimas;

/** Aplica el movimiento a la existencia actual. Si dejaría la existencia negativa, devuelve el faltante y no cambia nada. */
export function aplicarMovimiento(actualMilesimas: number, m: Movimiento, minimoMilesimas: number): Aplicado | Faltante {
  const resultante = actualMilesimas + m.cantidadMilesimas;
  if (resultante < 0) return { ok: false, disponibleMilesimas: actualMilesimas, faltanteMilesimas: -resultante };
  const antes = estaBajoMinimo(actualMilesimas, minimoMilesimas);
  const despues = estaBajoMinimo(resultante, minimoMilesimas);
  return { ok: true, resultanteMilesimas: resultante, bajoMinimo: despues, cruzaMinimo: !antes && despues };
}

/** 12000 → «12»; 12500, «kg» → «12.5 kg»; 1234567 → «1,234.567». Con signo si es negativa. */
export function textoDeCantidad(milesimas: number, unidad?: string): string {
  const abs = Math.abs(milesimas);
  const enteros = Math.trunc(abs / 1000)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimales = String(abs % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  const numero = `${milesimas < 0 ? '-' : ''}${enteros}${decimales ? `.${decimales}` : ''}`;
  return unidad?.trim() ? `${numero} ${unidad.trim()}` : numero;
}

/** El mensaje del rechazo de una salida que no alcanza: dice cuánto hay y cuánto falta. */
export const mensajeDeFaltante = (f: Faltante, unidad: string): string =>
  `No alcanza: hay ${textoDeCantidad(f.disponibleMilesimas, unidad)} y faltan ${textoDeCantidad(f.faltanteMilesimas, unidad)}.`;
