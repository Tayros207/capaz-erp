/** Vacío es «sin dato»; si hay texto, un número ≥ 0 (con decimales solo si `entero` es falso). */
export function numeroOpcional(t: string, entero: boolean): { ok: true; valor: number | null } | { ok: false; error: string } {
  const limpio = t.trim().replace(',', '.');
  if (limpio === '') return { ok: true, valor: null };
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0 || (entero && !Number.isInteger(n))) return { ok: false, error: entero ? 'Escribe un número entero.' : 'Escribe un número válido.' };
  return { ok: true, valor: n };
}
