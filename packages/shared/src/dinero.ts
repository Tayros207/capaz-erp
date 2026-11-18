import { z } from 'zod';

// Dinero en céntimos enteros (regla 9): nunca `number` con decimales. Solo soles en la V1.

export const centimosSchema = z.number().int().safe().brand<'Centimos'>();
export type Centimos = z.infer<typeof centimosSchema>;

/** `'1234.50'` → 123450. Acepta hasta dos decimales, signo y espacios; rechaza todo lo demás. */
export function aCentimos(texto: string): Centimos {
  const limpio = texto.trim().replace(/\s+/g, '');
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(limpio);
  if (!m) throw new RangeError(`Monto inválido: «${texto}».`);
  const [, signo, enteros, decimales = ''] = m;
  const valor = Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
  return centimosSchema.parse(signo ? -valor : valor);
}

/** 123450 → `S/ 1,234.50`. Formato fijo (locale es-PE) sin depender del ICU del entorno. */
export function formatearSoles(valor: Centimos | number): string {
  const c = centimosSchema.parse(valor);
  const abs = Math.abs(c);
  const enteros = Math.trunc(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimales = (abs % 100).toString().padStart(2, '0');
  return `${c < 0 ? '-' : ''}S/ ${enteros}.${decimales}`;
}

export const milesimasSchema = z.number().int().safe().brand<'Milesimas'>();
export type Milesimas = z.infer<typeof milesimasSchema>;

/**
 * cantidad (milésimas) × precio unitario (milésimas) → céntimos, al céntimo más cercano
 * (mitad hacia arriba). Calcula con BigInt: no pierde precisión con montos grandes.
 * 1 unidad = 1000 milésimas; 1 sol = 100 céntimos = 1000 milésimas de sol.
 * Por eso: céntimos = cantidad × precio / 1000 / 1000 × 100 = cantidad × precio / 10 000.
 */
export function importe(cantidadMilesimas: number, precioUnitarioMilesimas: number): Centimos {
  const cantidad = BigInt(milesimasSchema.parse(cantidadMilesimas));
  const precio = BigInt(milesimasSchema.parse(precioUnitarioMilesimas));
  const producto = cantidad * precio;
  const divisor = 10_000n;
  // Mitad hacia arriba (hacia +infinito): floor((2p + d) / 2d).
  const doble = 2n * producto + divisor;
  const cociente = doble / (2n * divisor);
  const resto = doble % (2n * divisor);
  const piso = resto < 0n ? cociente - 1n : cociente;
  return centimosSchema.parse(Number(piso));
}

/** Suma el IGV a un monto que no lo trae: `round(monto × (100 + igv) / 100)`, mitad hacia arriba. Sirve para céntimos y milésimas. */
export function ponerIgv(montoSinIgv: number, igvPorcentaje: number): number {
  if (!Number.isSafeInteger(montoSinIgv) || montoSinIgv < 0) throw new RangeError('El monto no es un entero seguro no negativo.');
  if (!Number.isInteger(igvPorcentaje) || igvPorcentaje < 0 || igvPorcentaje > 100) throw new RangeError('El IGV debe ser un entero de 0 a 100.');
  return Number((BigInt(montoSinIgv) * BigInt(100 + igvPorcentaje) + 50n) / 100n);
}
