import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/** Número que sube hasta su valor en ~0,6 s. Sin movimiento si la persona lo pidió. */
export function CifraAnimada({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducir = useReducedMotion();
  const anterior = useRef(0);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    if (reducir) {
      nodo.textContent = String(valor);
      anterior.current = valor;
      return;
    }
    const control = animate(anterior.current, valor, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        nodo.textContent = String(Math.round(v));
      },
    });
    anterior.current = valor;
    return () => control.stop();
  }, [valor, reducir]);
  return <span ref={ref} className={className}>{valor}</span>;
}
