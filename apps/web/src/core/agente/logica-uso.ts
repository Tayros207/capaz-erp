import type { UsoDelTurno } from '@capaz/shared';

// Cómo se muestra lo que gastó un turno y lo que cuesta un modelo. Solo presentación: el dinero se guarda y se suma en
// millonésimas de dólar enteras en el servidor; aquí únicamente se escribe.

/** «US$ 0.0003» si es menos de un centavo, «US$ 0.05» si no. */
export function formatoUsd(microusd: number): string {
  const usd = microusd / 1_000_000;
  return `US$ ${usd >= 0.01 ? usd.toFixed(2) : usd.toFixed(4)}`;
}

/** El precio por millón de tokens de un modelo, o `null` si no se pudo consultar. */
export const precioPorMillon = (microusd: number | null): string | null => (microusd === null ? null : `US$ ${(microusd / 1_000_000).toFixed(2)} por millón`);

export function formatoDeTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return String(n);
}

export function formatoDeDuracion(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  const s = ms / 1_000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

/** Una línea corta bajo la respuesta: «1.2 K entrada · 20 salida · 1.5 s · US$ 0.0003». */
export function textoDeUso(u: UsoDelTurno): string {
  return [`${formatoDeTokens(u.tokensEntrada)} entrada`, `${formatoDeTokens(u.tokensSalida)} salida`, formatoDeDuracion(u.duracionMs), u.costoMicrousd > 0 ? formatoUsd(u.costoMicrousd) : null]
    .filter((x): x is string => x !== null)
    .join(' · ');
}
