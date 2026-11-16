// REGLA NUEVA (no portada de Tairos.RC): ¿la frase dicta una deuda nueva y de qué lado?
// Se evalúa DESPUÉS de esAbonoDeuda: si es abono, no es deuda nueva.

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const palabra = (cuerpo: string): RegExp => new RegExp(`(?<![\\p{L}])(?:${cuerpo})(?![\\p{L}])`, 'u');

// Me deben a mí.
const POR_COBRAR = [
  palabra('me\\s+(?:deben?|adeudan?)'),
  palabra('me\\s+(?:quedo|quedaron|quedan)\\s+debiendo'),
  palabra('(?:le|les)\\s+fie'),
];

// Yo debo.
const POR_PAGAR = [
  palabra('(?:le|les)\\s+debo'),
  palabra('(?:quede|quedamos)\\s+debiendo'),
  palabra('me\\s+(?:fiaron|fio)'),
  palabra('debo'),
];

export function tipoDeDeudaDictada(texto: string): 'por_cobrar' | 'por_pagar' | null {
  const t = normalizar(texto);
  if (POR_COBRAR.some((r) => r.test(t))) return 'por_cobrar';
  if (POR_PAGAR.some((r) => r.test(t))) return 'por_pagar';
  return null;
}
