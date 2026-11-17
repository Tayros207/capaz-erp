import { useCallback, useEffect, useRef, useState } from 'react';
import type { EstadoDeReconocedor, ReconocedorDeVoz } from './reconocedor.ts';
import {
  AVISO_SIN_CONTEXTO_SEGURO, AVISO_SIN_RECONOCIMIENTO, avisoDeErrorDeVoz, recortarTexto, unirResultados, unirSesion, type ListaDeResultados,
} from './logica-reconocedor.ts';

// Reconocedor de voz del navegador (Web Speech). El audio nunca sale del navegador hacia nuestro servidor (R20).

type EventoDeResultado = { results: ListaDeResultados };
type EventoDeError = { error: string };
type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventoDeResultado) => void) | null;
  onerror: ((e: EventoDeError) => void) | null;
  onend: (() => void) | null;
};
type ConstructorDeReconocimiento = new () => Reconocimiento;

function constructorDelNavegador(): ConstructorDeReconocimiento | null {
  const w = window as Window & { SpeechRecognition?: ConstructorDeReconocimiento; webkitSpeechRecognition?: ConstructorDeReconocimiento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function disponibilidad(): { estado: EstadoDeReconocedor; aviso: string | null } {
  if (!window.isSecureContext) return { estado: 'sin_contexto_seguro', aviso: AVISO_SIN_CONTEXTO_SEGURO };
  if (!constructorDelNavegador()) return { estado: 'no_disponible', aviso: AVISO_SIN_RECONOCIMIENTO };
  return { estado: 'listo', aviso: null };
}

export function useReconocedorWebSpeech(): ReconocedorDeVoz {
  const [inicial] = useState(disponibilidad);
  const [estado, setEstado] = useState<EstadoDeReconocedor>(inicial.estado);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(inicial.aviso);

  const reconocimiento = useRef<Reconocimiento | null>(null);
  const android = useRef(false);
  const continuo = useRef(true);
  const transcrito = useRef('');
  const acumulado = useRef('');
  const mantener = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disponible = inicial.estado === 'listo';

  const terminar = useCallback(() => {
    mantener.current = false;
    setEstado((e) => (e === 'escuchando' ? 'listo' : e));
  }, []);

  const crear = useCallback((): Reconocimiento => {
    const Ctor = constructorDelNavegador()!;
    const rec = new Ctor();
    rec.lang = 'es-PE';
    rec.continuous = !android.current;
    rec.interimResults = true;
    continuo.current = rec.continuous;
    rec.onresult = (e) => {
      const sesion = unirResultados(e.results, continuo.current);
      const completo = android.current ? unirSesion(acumulado.current, sesion) : sesion;
      transcrito.current = recortarTexto(completo);
      setTexto(transcrito.current);
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      const mensaje = avisoDeErrorDeVoz(e.error, android.current);
      if (e.error === 'no-speech') {
        if (!transcrito.current) setAviso(mensaje);
        return;
      }
      mantener.current = false;
      setAviso(mensaje ?? 'No se pudo usar el micrófono. Escribe el texto.');
      setEstado('error');
    };
    rec.onend = () => {
      if (!mantener.current) {
        terminar();
        return;
      }
      if (android.current) {
        // En Android cada sesión es corta: se reinicia y se une con lo ya dicho.
        acumulado.current = transcrito.current;
        temporizador.current = setTimeout(() => {
          temporizador.current = null;
          if (!mantener.current) return;
          try {
            reconocimiento.current = crear();
            reconocimiento.current.start();
          } catch {
            terminar();
          }
        }, 180);
        return;
      }
      try {
        rec.start();
      } catch {
        terminar();
      }
    };
    return rec;
  }, [terminar]);

  const iniciar = useCallback(() => {
    if (!disponible) return;
    void (async () => {
      setAviso(null);
      transcrito.current = '';
      acumulado.current = '';
      android.current = /android/i.test(navigator.userAgent);
      try {
        // Pide el permiso antes de arrancar para dar un aviso claro si se niega.
        const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
        flujo.getTracks().forEach((pista) => pista.stop());
      } catch {
        setAviso(avisoDeErrorDeVoz('not-allowed', android.current));
        setEstado('error');
        return;
      }
      try {
        mantener.current = true;
        reconocimiento.current = crear();
        setTexto('');
        setEstado('escuchando');
        reconocimiento.current.start();
      } catch {
        mantener.current = false;
        setAviso('No pude iniciar el micrófono. Recarga la página e intenta de nuevo.');
        setEstado('error');
      }
    })();
  }, [disponible, crear]);

  const detener = useCallback(() => {
    mantener.current = false;
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    try {
      reconocimiento.current?.stop();
    } catch {
      /* ya estaba detenido */
    }
    setEstado((e) => (e === 'escuchando' ? 'listo' : e));
  }, []);

  const limpiar = useCallback(() => {
    detener();
    transcrito.current = '';
    acumulado.current = '';
    setTexto('');
    setAviso(null);
    if (disponible) setEstado('listo');
  }, [detener, disponible]);

  useEffect(
    () => () => {
      mantener.current = false;
      if (temporizador.current) clearTimeout(temporizador.current);
      try {
        reconocimiento.current?.abort();
      } catch {
        /* nada que cerrar */
      }
    },
    [],
  );

  return { estado, texto, aviso, iniciar, detener, limpiar };
}
