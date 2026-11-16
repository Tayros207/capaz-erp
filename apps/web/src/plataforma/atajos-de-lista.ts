import { useEffect, useState } from 'react';

const ESCRIBIENDO = /^(input|textarea|select)$/i;

/**
 * Atajos de teclado de una lista: j/k mueven la fila activa, Enter la abre y «/» enfoca la búsqueda.
 * No actúa mientras se escribe, con una hoja abierta o con modificadores pulsados.
 */
export function useAtajosDeLista(cantidad: number, abrir: (indice: number) => void, enfocarBusqueda: () => void) {
  const [activa, setActiva] = useState(-1);
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (ESCRIBIENDO.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        setActiva((a) => Math.min(cantidad - 1, Math.max(0, e.key === 'j' ? a + 1 : a - 1)));
      } else if (e.key === 'Enter' && activa >= 0 && activa < cantidad && !(t && t.closest('a,button'))) {
        e.preventDefault();
        abrir(activa);
      } else if (e.key === '/') {
        e.preventDefault();
        enfocarBusqueda();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [cantidad, activa, abrir, enfocarBusqueda]);
  return [Math.min(activa, cantidad - 1), setActiva] as const;
}
