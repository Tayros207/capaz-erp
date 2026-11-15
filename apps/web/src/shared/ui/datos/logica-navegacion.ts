// Lógica pura de Pestanas (teclado) y BarraDeEstado (pasos).

/** Pestaña a enfocar con una tecla de flecha, Inicio o Fin; nulo si la tecla no navega. Salta las deshabilitadas. */
export function pestanaSegunTecla(tecla: string, actual: number, deshabilitadas: readonly boolean[]): number | null {
  const n = deshabilitadas.length;
  const paso = tecla === 'ArrowRight' ? 1 : tecla === 'ArrowLeft' ? -1 : 0;
  if (tecla === 'Home' || tecla === 'End') {
    const orden = tecla === 'Home' ? [...deshabilitadas.keys()] : [...deshabilitadas.keys()].reverse();
    return orden.find((i) => !deshabilitadas[i]) ?? null;
  }
  if (paso === 0 || n === 0) return null;
  for (let k = 1; k <= n; k++) {
    const i = (((actual + paso * k) % n) + n) % n;
    if (!deshabilitadas[i]) return i;
  }
  return null;
}

export type EstadoDePaso = 'hecho' | 'actual' | 'pendiente';

export function estadoDePaso(indice: number, actual: number): EstadoDePaso {
  return indice < actual ? 'hecho' : indice === actual ? 'actual' : 'pendiente';
}
