import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrigenDeCaptura } from '@capaz/shared';
import { decidirOrigen, instanteDeInicio, transcurridoMs } from '../captura/logica.ts';
import { recortarTexto, unirConBase } from '../captura/logica-reconocedor.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';

/**
 * Lo que la persona escribe o dicta en la caja. Guarda también lo que `captura_proponer` necesita medir: cuánto tardó
 * y si el texto vino de la voz (igual que la pantalla de dictado).
 */
export function useEntradaDeTexto(voz: ReconocedorDeVoz) {
  const [texto, setTexto] = useState('');
  const inicio = useRef<number | null>(null);
  const vinoDeVoz = useRef(false);
  const base = useRef('');

  // Lo que reconoce la voz se suma a lo ya escrito y se puede retocar a mano antes de enviar.
  useEffect(() => {
    if (!voz.texto) return;
    vinoDeVoz.current = true;
    setTexto(unirConBase(base.current, voz.texto));
  }, [voz.texto]);

  const olvidar = useCallback(() => {
    setTexto('');
    inicio.current = null;
    vinoDeVoz.current = false;
    base.current = '';
    voz.limpiar();
  }, [voz]);

  const alEscribir = useCallback((valor: string) => {
    inicio.current = instanteDeInicio(inicio.current, performance.now());
    setTexto(recortarTexto(valor));
  }, []);

  const alAlternarVoz = useCallback(() => {
    if (voz.estado === 'escuchando') {
      voz.detener();
      return;
    }
    base.current = texto;
    inicio.current = instanteDeInicio(inicio.current, performance.now());
    voz.iniciar();
  }, [voz, texto]);

  /** Origen y tiempo de lo que hay en la caja, para medir el dictado al enviarlo. */
  const medicion = useCallback((): { origen: OrigenDeCaptura; transcurrido: number } => ({
    origen: decidirOrigen(vinoDeVoz.current),
    transcurrido: transcurridoMs(inicio.current, performance.now()),
  }), []);

  return { texto, alEscribir, alAlternarVoz, olvidar, medicion };
}
