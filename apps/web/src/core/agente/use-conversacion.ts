import { useCallback } from 'react';
import type { PantallaDelAgente } from '@capaz/shared';
import { hayTexto } from '../captura/logica.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { useCapturaEnHilo, type EntradaDeTexto } from './use-captura-en-hilo.ts';
import { useTurno } from './use-turno.ts';

/**
 * Lo que el panel usa: una sola forma de conversar, con o sin modelo. Con el asistente activo cada mensaje es un turno por SSE;
 * apagado, se interpreta con las reglas de dictado. Los dos estados viven siempre; cambiar de modo no pierde la conversación del otro.
 */
export function useConversacion(voz: ReconocedorDeVoz, entrada: EntradaDeTexto, pantalla: PantallaDelAgente, conectado: boolean) {
  const captura = useCapturaEnHilo(voz, entrada);
  const turno = useTurno(pantalla);
  const { texto, olvidar, medicion } = entrada;

  const enviar = useCallback(async () => {
    if (!conectado) return captura.enviar();
    if (turno.ocupado || !hayTexto(texto)) return;
    if (voz.estado === 'escuchando') voz.detener();
    const { origen } = medicion();
    olvidar();
    await turno.enviar(texto, origen);
  }, [conectado, captura, turno, texto, voz, medicion, olvidar]);

  const nueva = useCallback(() => {
    captura.nueva();
    turno.nueva();
  }, [captura, turno]);

  /** Envía una frase de un toque (una respuesta rápida) sin pasar por la caja. Solo con el asistente activo. */
  const enviarTexto = useCallback(async (frase: string) => {
    if (turno.ocupado || !hayTexto(frase)) return;
    await turno.enviar(frase, 'texto');
  }, [turno]);

  return conectado
    ? { enviarTexto, hilo: turno.hilo, ocupado: turno.ocupado, uso: turno.uso, reintentable: turno.reintentable, detener: turno.detener, reintentar: turno.reintentar, abrir: turno.abrir, resolver: turno.resolver, enviar, nueva }
    : { enviarTexto: undefined, hilo: captura.hilo, ocupado: captura.enviando, uso: null, reintentable: null, detener: undefined, reintentar: undefined, abrir: undefined, resolver: captura.resolver, enviar, nueva };
}
