import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useReducer, useState } from 'react';
import { CLAVE_BANDEJA } from '../bandeja/claves.ts';
import { proponerCaptura } from '../captura/api.ts';
import { destinoSiEsPreguntaDePrecio, hayTexto, mensajeDeErrorDeCaptura } from '../captura/logica.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { reducirHilo } from './logica-hilo.ts';
import type { useEntradaDeTexto } from './use-entrada-de-texto.ts';
import { useResolverBorrador } from './use-resolver-borrador.ts';

type RespuestaDeCaptura = Awaited<ReturnType<typeof proponerCaptura>>;
export type EntradaDeTexto = ReturnType<typeof useEntradaDeTexto>;

/**
 * El panel SIN modelo (el asistente apagado): lo que se escribe o dicta pasa por las reglas de dictado (`captura_proponer`) y
 * vuelve como borradores en el hilo. Es la misma ruta que la pantalla de dictado. La caja de entrada la pone el panel.
 */
export function useCapturaEnHilo(voz: ReconocedorDeVoz, entrada: EntradaDeTexto) {
  const cliente = useQueryClient();
  const [hilo, despachar] = useReducer(reducirHilo, []);
  const [enviando, setEnviando] = useState(false);
  const resolver = useResolverBorrador(hilo, despachar);
  const { texto, olvidar, medicion } = entrada;

  const responder = useCallback((r: RespuestaDeCaptura) => {
    if (r.ok && 'datos' in r) {
      despachar({ tipo: 'captura_respondio', id: crypto.randomUUID(), propuesta: r.datos });
      void cliente.invalidateQueries({ queryKey: CLAVE_BANDEJA });
    } else if ('error' in r) {
      despachar({ tipo: 'aviso', id: crypto.randomUUID(), tono: 'error', texto: mensajeDeErrorDeCaptura(r.error.codigo, r.error.mensaje) });
    }
  }, [cliente]);

  const enviar = useCallback(async () => {
    if (enviando || !hayTexto(texto)) return;
    if (voz.estado === 'escuchando') voz.detener();
    const enviado = texto;
    const { origen, transcurrido } = medicion();
    despachar({ tipo: 'persona_envia', id: crypto.randomUUID(), texto: enviado });
    olvidar();
    // «¿Cuánto le cobramos a X por Y?» es una pregunta de precio, no un movimiento: se manda a /precios y no se crea nada.
    const destino = destinoSiEsPreguntaDePrecio(enviado);
    if (destino) {
      despachar({ tipo: 'aviso', id: crypto.randomUUID(), tono: 'info', texto: 'Eso se consulta en Precios.', enlace: { texto: 'Ver precio anterior', ruta: destino } });
      return;
    }
    setEnviando(true);
    responder(await proponerCaptura({ texto: enviado, origen, transcurridoMs: transcurrido, modulo: 'registro' }));
    setEnviando(false);
  }, [enviando, texto, voz, medicion, olvidar, responder]);

  const nueva = useCallback(() => {
    despachar({ tipo: 'limpiar' });
    olvidar();
  }, [olvidar]);

  return { hilo, enviando, enviar, resolver, nueva };
}
