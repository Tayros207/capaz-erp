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
