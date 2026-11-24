import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import type { EventoDelAgente, PantallaDelAgente, UsoDelTurno } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { CLAVE_BANDEJA } from '../bandeja/claves.ts';
import { CLAVE_CONVERSACIONES, verConversacion } from './api.ts';
import { reducirHilo, type AccionDeHilo, type ElementoDeHilo } from './logica-hilo.ts';
import { mensajesAHilo } from './logica-historial.ts';
import { aplicarDetencion, aplicarEvento, aplicarRecuperacion, limpiarParaReintentar, puedeReintentar } from './logica-turno.ts';
import { recuperarTurno } from './recuperar-turno.ts';
import { enviarTurno } from './transporte-sse.ts';
import { useResolverBorrador } from './use-resolver-borrador.ts';

export type UsoMostrado = UsoDelTurno & { modelo: string };
type UltimoTurno = { turnoId: string; texto: string; origen: 'texto' | 'voz' };

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/** Lo que el turno recuerda entre un mensaje y otro. Las referencias sirven a las funciones asíncronas, que no ven el estado más nuevo. */
function useEstadoDelTurno() {
  const [hilo, setHilo] = useState<ElementoDeHilo[]>([]);
  const [conversacionId, setConversacion] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [uso, setUso] = useState<UsoMostrado | null>(null);
  const [reintentable, setReintentable] = useState<string | null>(null);
  const controlador = useRef<AbortController | null>(null);
  const ultimo = useRef<UltimoTurno | null>(null);
  const conversacion = useRef<string | null>(null);
  // Las referencias solo las toca quien las posee: los demás ganchos usan estas funciones.
  const fijarConversacion = useCallback((id: string | null) => {
    conversacion.current = id;
    setConversacion(id);
  }, []);
  const conversacionActual = useCallback(() => conversacion.current, []);
  const iniciarControl = useCallback(() => {
    controlador.current = new AbortController();
    return controlador.current;
  }, []);
  const abortar = useCallback(() => controlador.current?.abort(), []);
  const recordarUltimo = useCallback((u: UltimoTurno | null) => {
    ultimo.current = u;
  }, []);
  const ultimoTurno = useCallback(() => ultimo.current, []);
  const despachar = useCallback((a: AccionDeHilo) => setHilo((h) => reducirHilo(h, a)), []);
  return { hilo, setHilo, conversacionId, ocupado, setOcupado, uso, setUso, reintentable, setReintentable, fijarConversacion, conversacionActual, iniciarControl, abortar, recordarUltimo, ultimoTurno, despachar };
}

type Estado = ReturnType<typeof useEstadoDelTurno>;

/** Envía un turno por SSE y reparte sus eventos. Si la conexión se corta antes del final, consulta lo que el servidor alcanzó a guardar. */
function useCorrerTurno(e: Estado, pantalla: PantallaDelAgente) {
  const cliente = useQueryClient();
  const { setHilo, setOcupado, setUso, setReintentable, conversacionActual, iniciarControl, fijarConversacion } = e;

  const recuperar = useCallback(async (u: UltimoTurno) => {
    const r = await recuperarTurno({ consultar: verConversacion, esperar, ahora: Date.now }, { conversacionId: conversacionActual(), turnoId: u.turnoId });
    setHilo((h) => aplicarRecuperacion(h, r, u.turnoId));
    setReintentable(r.tipo === 'completo' ? null : u.turnoId);
  }, [conversacionActual, setHilo, setReintentable]);

  return useCallback(async (u: UltimoTurno) => {
    const control = iniciarControl();
    setOcupado(true);
    setReintentable(null);
    const alEvento = (ev: EventoDelAgente) => {
      if (ev.type === 'inicio') fijarConversacion(ev.conversacionId);
      if (ev.type === 'uso') setUso({ ...ev });
      if (ev.type === 'error' && puedeReintentar(ev.motivo)) setReintentable(u.turnoId);
      setHilo((h) => aplicarEvento(h, ev, u.turnoId));
    };
    const cuerpo = { turnoId: u.turnoId, ...(conversacionActual() ? { conversacionId: conversacionActual() ?? undefined } : {}), mensaje: u.texto, origen: u.origen, pantalla };
    if ((await enviarTurno(cuerpo, alEvento, control.signal)) === 'cortado') {
      if (control.signal.aborted) setHilo((h) => aplicarDetencion(h, u.turnoId));
      else await recuperar(u);
    }
    setOcupado(false);
    void cliente.invalidateQueries({ queryKey: CLAVE_CONVERSACIONES });
    void cliente.invalidateQueries({ queryKey: CLAVE_BANDEJA });
  }, [cliente, conversacionActual, fijarConversacion, iniciarControl, pantalla, recuperar, setHilo, setOcupado, setReintentable, setUso]);
}

/**
 * El asistente CON modelo: cada mensaje es un turno que llega por SSE. Si la conexión se corta se consulta la conversación
 * guardada antes de dar nada por perdido; «Reintentar» reenvía el MISMO `turnoId`, así el servidor decide si repetir o no.
 */
export function useTurno(pantalla: PantallaDelAgente) {
  const e = useEstadoDelTurno();
  const correr = useCorrerTurno(e, pantalla);
  const resolver = useResolverBorrador(e.hilo, e.despachar);
  const { ocupado, ultimoTurno, recordarUltimo, abortar, despachar, setHilo, setUso, setReintentable, fijarConversacion } = e;

  const enviar = useCallback(async (texto: string, origen: 'texto' | 'voz') => {
    if (ocupado) return;
    const u = { turnoId: crypto.randomUUID(), texto, origen };
    recordarUltimo(u);
    despachar({ tipo: 'persona_envia', id: `persona-${u.turnoId}`, texto });
    await correr(u);
  }, [ocupado, recordarUltimo, despachar, correr]);

  const reintentar = useCallback(async () => {
    const u = ultimoTurno();
    if (!u || ocupado) return;
    setHilo((h) => limpiarParaReintentar(h, u.turnoId));
    await correr(u);
  }, [ocupado, ultimoTurno, setHilo, correr]);

  /** Corta la conexión de esta pantalla. El servidor termina el turno por su cuenta: lo que falte lo verá el historial. */
  const detener = abortar;

  const reiniciar = useCallback((hilo: ElementoDeHilo[], conversacion: string | null) => {
    abortar();
    setHilo(hilo);
    setUso(null);
    setReintentable(null);
    recordarUltimo(null);
    fijarConversacion(conversacion);
  }, [abortar, setHilo, setUso, setReintentable, recordarUltimo, fijarConversacion]);

  const nueva = useCallback(() => reiniciar([], null), [reiniciar]);

  /** Abre una conversación guardada: se vuelve a pintar y la siguiente pregunta sigue en ella. */
  const abrir = useCallback(async (id: string): Promise<boolean> => {
    try {
      reiniciar(mensajesAHilo(datosOError(await verConversacion(id)).mensajes), id);
      return true;
    } catch {
      return false;
    }
  }, [reiniciar]);

  return { hilo: e.hilo, conversacionId: e.conversacionId, ocupado, uso: e.uso, reintentable: e.reintentable, enviar, reintentar, detener, nueva, abrir, resolver };
}
