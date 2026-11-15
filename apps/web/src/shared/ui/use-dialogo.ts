import { useEffect, useRef } from 'react';

/** Abre y cierra un `<dialog>` nativo (modal: atrapa el foco, Escape lo cierra, el fondo queda inerte). */
export function useDialogo(abierto: boolean, alCerrar: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);
  // `cancel` (Escape) y `close` (cualquier cierre) avisan a quien controla el estado.
  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    const cerrado = () => alCerrar();
    dialogo.addEventListener('close', cerrado);
    return () => dialogo.removeEventListener('close', cerrado);
  }, [alCerrar]);
  return ref;
}
