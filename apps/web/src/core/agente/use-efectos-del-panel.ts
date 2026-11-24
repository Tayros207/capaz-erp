import { useEffect, type RefObject } from 'react';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';

type Entrada = {
  abierto: boolean;
  ancho: boolean;
  voz: ReconocedorDeVoz;
  alCerrar: () => void;
  refTexto: RefObject<HTMLTextAreaElement | null>;
};

/** Los efectos de abrir y cerrar el panel: foco, micrófono y la tecla Escape. */
export function useEfectosDelPanel({ abierto, ancho, voz, alCerrar, refTexto }: Entrada): void {
  const escuchando = voz.estado === 'escuchando';

  // Al abrir en escritorio el foco va a la caja. En el móvil no: enfocar levanta el teclado y tapa la pantalla.
  useEffect(() => {
    if (abierto && ancho) requestAnimationFrame(() => refTexto.current?.focus());
  }, [abierto, ancho, refTexto]);

  // Cerrar el panel corta el micrófono: nada queda escuchando a escondidas.
  useEffect(() => {
    if (!abierto && escuchando) voz.detener();
  }, [abierto, escuchando, voz]);

  // Escape: primero detiene el micrófono; si no, cierra. En móvil lo maneja la hoja; si hay otro diálogo abierto, es de él.
  useEffect(() => {
    if (!abierto || !ancho) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      if (escuchando) voz.detener();
      else alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, ancho, escuchando, voz, alCerrar]);
}
