import { useState } from 'react';
import { elegirViaDeVoz, type CapacidadesDeVoz } from './logica-reconocedor.ts';
import type { ReconocedorDeVoz } from './reconocedor.ts';
import { useReconocedorPorAudio } from './use-reconocedor-por-audio.ts';
import { useReconocedorWebSpeech } from './use-reconocedor-web-speech.ts';

// El micrófono que sirva en ESTE navegador: Web Speech si lo trae (Chrome, Edge, Safari); si no, grabar y que el servidor transcriba
// (Firefox); si ninguna sirve, el reconocedor de siempre dice «Este navegador no reconoce voz» con su nota discreta.

function capacidadesDelNavegador(): CapacidadesDeVoz {
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return {
    contextoSeguro: window.isSecureContext,
    reconocimiento: Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition),
    grabadora: typeof MediaRecorder !== 'undefined',
    microfono: typeof navigator.mediaDevices?.getUserMedia === 'function',
    audio: typeof AudioContext !== 'undefined',
  };
}

export function useReconocedor(): ReconocedorDeVoz {
  // Se decide una vez: el navegador no cambia mientras la pantalla está abierta.
  const [via] = useState(() => elegirViaDeVoz(capacidadesDelNavegador()));
  // Los dos hooks se llaman siempre (reglas de los hooks); el que no se usa no abre nada.
  const navegador = useReconocedorWebSpeech();
  const audio = useReconocedorPorAudio(via === 'audio');
  return via === 'audio' ? audio : navegador;
}
