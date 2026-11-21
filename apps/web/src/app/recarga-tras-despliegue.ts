// Tras un despliegue, una pestaña abierta puede pedir un trozo de JS que ya no existe (los nombres llevan hash).
// Vite avisa con `vite:preloadError`: se recarga la página una vez para tomar el `index.html` nuevo. Si ya se
// recargó hace poco, no se insiste (evita un bucle) y el error llega a `ErrorDeRuta`, que ofrece «Reintentar».

const CLAVE = 'capaz-recarga-tras-despliegue';
const VENTANA_MS = 60_000;

/** Pura: ¿toca recargar? Sí si nunca se recargó o si la última recarga fue hace más de la ventana. */
export function debeRecargar(ultima: number | null, ahora: number): boolean {
  return ultima === null || !Number.isFinite(ultima) || ahora - ultima > VENTANA_MS;
}

function leerUltima(): number | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    return crudo === null ? null : Number(crudo);
  } catch {
    return null;
  }
}

/** Escucha `vite:preloadError`. No cancela el evento: si no se recarga, el error sigue su camino. */
export function recargarTrasDespliegue(): void {
  window.addEventListener('vite:preloadError', () => {
    const ahora = Date.now();
    if (!debeRecargar(leerUltima(), ahora)) return;
    try {
      sessionStorage.setItem(CLAVE, String(ahora));
    } catch {
      // Sin almacenamiento no se puede recordar la recarga: mejor no recargar que arriesgar un bucle.
      return;
    }
    window.location.reload();
  });
}
