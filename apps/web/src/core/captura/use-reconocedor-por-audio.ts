import { useCallback, useEffect, useState } from 'react';
import { GrabadoraDeVoz } from './grabadora-de-voz.ts';
import { AVISO_TOPE_DE_GRABACION } from './logica-reconocedor.ts';
import type { EstadoDeReconocedor, ReconocedorDeVoz } from './reconocedor.ts';

// Dictado por audio para los navegadores sin Web Speech (Firefox): graba, y al terminar el servidor lo transcribe (ver
// `grabadora-de-voz.ts`). El texto vuelve como `texto`, igual que el de Web Speech: se suma a la caja y se corrige antes de enviar.

/** `disponible` lo decide el selector (`use-reconocedor.ts`) según lo que trae el navegador. */
export function useReconocedorPorAudio(disponible: boolean): ReconocedorDeVoz {
  const [estado, setEstado] = useState<EstadoDeReconocedor>(disponible ? 'listo' : 'no_disponible');
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [grabadora] = useState(
    () =>
      new GrabadoraDeVoz({
        alGrabar: () => {
          setPausado(false);
          setSegundos(0);
          setEstado('escuchando');
        },
        alPausar: setPausado,
        alCancelar: () => {
          setPausado(false);
          setSegundos(0);
          setAviso(null);
          setEstado('listo');
        },
        alTranscribir: (porTope) => {
          setPausado(false);
          setEstado('transcribiendo');
          if (porTope) setAviso(AVISO_TOPE_DE_GRABACION);
        },
        alResultado: (d) => {
          setTexto(d.texto);
          // Si se cortó por el tope y salió bien, el aviso del tope se queda: explica por qué falta el final.
          setAviso((previo) => d.aviso ?? (previo === AVISO_TOPE_DE_GRABACION ? previo : null));
          setEstado(d.estado);
        },
        alFallar: (mensaje) => {
          setAviso(mensaje);
          setEstado('error');
        },
      }, disponible),
  );

  const iniciar = useCallback(() => {
    if (!grabadora.conServicio || !grabadora.libre) return;
    // Vaciar el texto hace que dos dictados iguales seguidos también lleguen a la caja.
    setAviso(null);
    setTexto('');
    grabadora.empezar();
  }, [grabadora]);

  const detener = useCallback(() => grabadora.terminar(false), [grabadora]);

  const limpiar = useCallback(() => {
    grabadora.soltar();
    setTexto('');
    // Sin servicio queda la nota que explica por qué no hay micrófono.
    if (!grabadora.conServicio) return;
    setAviso(null);
    setEstado('listo');
  }, [grabadora]);

  // El contador sube mientras se graba (las pausas no cuentan).
  useEffect(() => {
    if (estado !== 'escuchando') return;
    const reloj = setInterval(() => setSegundos(grabadora.segundos), 250);
    return () => clearInterval(reloj);
  }, [estado, grabadora]);

  const pausar = useCallback(() => grabadora.pausar(), [grabadora]);
  const reanudar = useCallback(() => grabadora.reanudar(), [grabadora]);
  const cancelar = useCallback(() => grabadora.cancelar(), [grabadora]);

  // Al salir de la pantalla no queda nada grabando ni nada que llegue tarde.
  useEffect(() => () => grabadora.soltar(), [grabadora]);

  return { estado, texto, aviso, iniciar, detener, limpiar, via: 'audio', pausado, segundos, pausar, reanudar, cancelar };
}
