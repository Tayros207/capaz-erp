import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { MAXIMO_DE_TEXTO_DE_CAPTURA, type EstadoDelAgente } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { useEsAncho } from '../../shared/ui/use-ancho.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { useReconocedor } from '../captura/use-reconocedor.ts';
import { CLAVE_ESTADO_DEL_AGENTE, estadoDelAgente } from './api.ts';
import { CajaDeMensaje } from './caja-de-mensaje.tsx';
import { Hilo } from './hilo.tsx';
import { HistorialConectado } from './historial-conectado.tsx';
import { InsigniaDeUso } from './insignia-de-uso.tsx';
import { estadoVivo, type EstadoVivo } from './logica-acciones.ts';
import { almacenDelNavegador, leerConversacionRecordada, olvidarConversacion, recordarConversacion } from './logica-recordar.ts';
import { OrbeDelAsistente } from './orbe-del-asistente.tsx';
import { SUGERENCIAS_CON_ASISTENTE, SUGERENCIAS_INICIALES } from './logica-hilo.ts';
import { AVISO_SIN_IA, AVISO_SIN_PERMISO, AVISO_TOPE, MARCADOR_DE_LA_CAJA, SALUDO_CON_ASISTENTE, SALUDO_VACIO } from './logica-panel.ts';
import { pantallaDesdeRuta } from './logica-pantalla.ts';
import { EncabezadoDeVista } from './piezas-de-vista.tsx';
import { AjustesDelAsistente } from './ajustes-conectado.tsx';
import { useConversacion } from './use-conversacion.ts';
import { useEfectosDelPanel } from './use-efectos-del-panel.ts';
import { useEntradaDeTexto } from './use-entrada-de-texto.ts';
import { VistaDeHistorial } from './vista-de-historial.tsx';

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  /** Dónde está la persona, para que sepa qué pantalla tiene delante el asistente (migas de la carcasa). */
  migas: string[];
  /** El panel no usa `useYo()`: la carcasa lo decide con `puedeDictar(yo)` y lo pasa. */
  puedeDictar: boolean;
};

type Vista = 'conversacion' | 'historial' | 'modelo';
type Conversacion = ReturnType<typeof useConversacion>;

type PropsDeCabecera = { pista: string; conectado: boolean; vivo: EstadoVivo | null; alNueva: () => void; alHistorial: () => void; alModelo: () => void; alCerrar?: () => void; amplio?: boolean; alAmpliar?: () => void; conOrbe?: boolean };

const REDONDO = 'rounded-full';

/** Dos flechas que se alejan (ampliar) o se acercan (reducir). Dibujo propio, sin depender del juego de iconos. */
function IconoAmpliar({ amplio }: { amplio: boolean }): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {amplio ? <path d="M9 4v5H4M15 20v-5h5M4 9l6-6M20 15l-6 6" /> : <path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6" />}
    </svg>
  );
}

/** El cabezal: el orbe (que piensa cuando trabaja), el nombre y una línea que dice qué está haciendo AHORA o dónde está la persona. */
function Cabecera({ pista, conectado, vivo, alNueva, alHistorial, alModelo, alCerrar, amplio = false, alAmpliar, conOrbe = true }: PropsDeCabecera): ReactNode {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        {conOrbe ? <OrbeDelAsistente tamano="size-9" nivel={vivo ? 'trabajando' : 'reposo'} /> : null}
        <div className="min-w-0">
          {alCerrar ? <h2 className="font-titulo text-base leading-tight font-semibold tracking-tight">Asistente</h2> : null}
          <p aria-live="polite" className={vivo ? 'truncate text-xs font-medium text-asistente-2' : 'truncate text-xs text-texto-suave'}>{vivo ? vivo.texto : pista || 'En línea'}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Boton variante="fantasma" icono="nueva" aria-label="Nueva conversación" className={REDONDO} onClick={alNueva} />
        <Boton variante="fantasma" icono="historial" aria-label="Historial" className={REDONDO} onClick={alHistorial} />
        {conectado ? <Boton variante="fantasma" icono="modelo" aria-label="Ajustes del asistente" className={REDONDO} onClick={alModelo} /> : null}
        {alAmpliar ? (
          <button type="button" aria-label={amplio ? 'Reducir el panel' : 'Ampliar el panel'} aria-pressed={amplio} onClick={alAmpliar} className="inline-grid min-h-(--alto-control) min-w-(--alto-control) cursor-pointer place-items-center rounded-full text-texto-suave transition-colors duration-150 hover:bg-superficie-alta hover:text-texto active:scale-95">
            <IconoAmpliar amplio={amplio} />
          </button>
        ) : null}
        {alCerrar ? <Boton variante="fantasma" icono="cerrar" aria-label="Cerrar" className={REDONDO} onClick={alCerrar} /> : null}
      </div>
    </div>
  );
}

/** El aviso fijo de arriba: sin modelo explica qué se puede hacer; con el tope alcanzado, también. Con el asistente activo no hace falta. */
function avisoDeEstado(estado: EstadoDelAgente | undefined): string | null {
  if (estado?.activo) return null;
  return estado?.motivo === 'tope_mensual' ? AVISO_TOPE : AVISO_SIN_IA;
}

type PropsDeCuerpo = { c: Conversacion; vista: Vista; estado: EstadoDelAgente | undefined; alVolver: () => void; alNavegar: (ruta: string) => void; alAbrir: (id: string) => void; alElegirSugerencia: (frase: string) => void };

function Cuerpo({ c, vista, estado, alVolver, alNavegar, alAbrir, alElegirSugerencia }: PropsDeCuerpo): ReactNode {
  const conectado = estado?.activo === true;
  if (vista === 'historial') {
    const contenido = conectado ? <HistorialConectado activaId={c.conversacionId} alAbrir={alAbrir} alBorrada={() => undefined} /> : undefined;
    return <VistaDeHistorial alVolver={alVolver} contenido={contenido} />;
  }
  if (vista === 'modelo') {
    return (
      <section aria-label="Ajustes del asistente" className="flex flex-col gap-3">
        <EncabezadoDeVista titulo="Ajustes" alVolver={alVolver} />
        <AjustesDelAsistente puedeConfigurar={estado?.puedeConfigurar === true} />
      </section>
    );
  }
  const aviso = avisoDeEstado(estado);
  return (
    <div className="flex flex-col gap-3">
      {aviso ? <p role="note" className="rounded-2xl border border-borde bg-superficie-alta px-3 py-2 text-xs text-texto-suave">{aviso}</p> : null}
      <Hilo elementos={c.hilo} alResolver={c.resolver} alElegirSugerencia={alElegirSugerencia} alRespuestaRapida={c.enviarTexto ? (f) => void c.enviarTexto?.(f) : undefined} ocupado={c.ocupado} conAsistente={conectado} alNavegar={alNavegar} sugerencias={conectado ? SUGERENCIAS_CON_ASISTENTE : SUGERENCIAS_INICIALES} saludo={conectado ? SALUDO_CON_ASISTENTE : SALUDO_VACIO} reintentable={c.reintentable} alReintentar={c.reintentar} />
      {c.uso ? <InsigniaDeUso uso={c.uso} /> : null}
    </div>
  );
}

type PropsDePie = { c: Conversacion; voz: ReconocedorDeVoz; entrada: ReturnType<typeof useEntradaDeTexto>; puedeDictar: boolean; refTexto: RefObject<HTMLTextAreaElement | null> };

function Pie({ c, voz, entrada, puedeDictar, refTexto }: PropsDePie): ReactNode {
  if (!puedeDictar) return <p role="status" className="text-sm text-texto-suave">{AVISO_SIN_PERMISO}</p>;
  return (
    <CajaDeMensaje
      valor={entrada.texto}
      alCambiar={entrada.alEscribir}
      alEnviar={() => void c.enviar()}
      alAlternarVoz={entrada.alAlternarVoz}
      voz={voz}
      ocupado={c.ocupado}
      maximo={MAXIMO_DE_TEXTO_DE_CAPTURA}
      marcador={MARCADOR_DE_LA_CAJA}
      refTexto={refTexto}
      alDetener={c.detener}
    />
  );
}

/**
 * El panel del asistente. Escritorio: una ventana no modal abajo a la derecha (la persona sigue usando la pantalla de la que
 * habla). Móvil: una hoja inferior. Se monta la primera vez que se abre y se queda: cerrarlo no borra la conversación.
 * Con el asistente activo cada mensaje es un turno con el modelo; apagado, registra lo que se dicta con las reglas de siempre.
 */
export function PanelDelAgente({ abierto, alCerrar, migas, puedeDictar }: Props): ReactNode {
  const ancho = useEsAncho();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const voz = useReconocedor();
  const entrada = useEntradaDeTexto(voz);
  const estado = useQuery({ queryKey: CLAVE_ESTADO_DEL_AGENTE, queryFn: async () => datosOError(await estadoDelAgente()), enabled: abierto, staleTime: 30_000 });
  const c = useConversacion(voz, entrada, pantallaDesdeRuta(pathname), estado.data?.activo === true);
  const [vista, setVista] = useState<Vista>('conversacion');
  const [amplio, setAmplio] = useState(false);
  const restaurada = useRef(false);
  const conectado = estado.data?.activo === true;
  const { abrir, conversacionId, hilo, ocupado } = c;

  // Al volver (recargar la página, volver mañana) se reabre la conversación que se estaba usando, si fue hace poco y el panel sigue vacío.
  useEffect(() => {
    if (!abierto || !conectado || restaurada.current || !abrir) return;
    restaurada.current = true;
    const id = leerConversacionRecordada(almacenDelNavegador(), Date.now());
    if (id && hilo.length === 0) void abrir(id).then((ok) => (ok ? undefined : olvidarConversacion(almacenDelNavegador())));
  }, [abierto, conectado, abrir, hilo.length]);

  // Cada vez que una respuesta termina, se anota cuál es la conversación (y cuándo), para poder reabrirla.
  useEffect(() => {
    if (conversacionId && !ocupado) recordarConversacion(almacenDelNavegador(), conversacionId, Date.now());
  }, [conversacionId, ocupado]);
  const refTexto = useRef<HTMLTextAreaElement>(null);
  useEfectosDelPanel({ abierto, ancho, voz, alCerrar, refTexto });

  if (!abierto) return null;

  const alNavegar = (ruta: string) => {
    void navegar(ruta);
    if (!ancho) alCerrar();
  };
  const alAbrir = async (id: string) => {
    if (c.abrir && (await c.abrir(id))) setVista('conversacion');
  };
  const cabecera = (
    <Cabecera conOrbe={vista !== 'conversacion' || c.hilo.length > 0} pista={migas.join(' › ')} vivo={estadoVivo(c.hilo, c.ocupado)} conectado={estado.data?.activo === true} alNueva={() => { olvidarConversacion(almacenDelNavegador()); c.nueva(); setVista('conversacion'); }} alHistorial={() => setVista('historial')} alModelo={() => setVista('modelo')} alCerrar={ancho ? alCerrar : undefined} amplio={amplio} alAmpliar={ancho ? () => setAmplio((a) => !a) : undefined} />
  );
  const cuerpo = <Cuerpo c={c} vista={vista} estado={estado.data} alVolver={() => setVista('conversacion')} alNavegar={alNavegar} alAbrir={(id) => void alAbrir(id)} alElegirSugerencia={entrada.alEscribir} />;
  const pie = vista === 'conversacion' ? <Pie c={c} voz={voz} entrada={entrada} puedeDictar={puedeDictar} refTexto={refTexto} /> : null;

  if (!ancho) {
    return (
      <HojaInferior abierto alCerrar={alCerrar} titulo="Asistente" alta pie={pie}>
        <div className="flex flex-col gap-3">
          {cabecera}
          {cuerpo}
        </div>
      </HojaInferior>
    );
  }
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label="Asistente"
      className={`fixed right-6 bottom-6 z-30 flex origin-bottom-right flex-col overflow-hidden rounded-[2rem] border border-borde/70 bg-superficie/95 shadow-[0_32px_70px_-24px_color-mix(in_oklab,var(--color-asistente-hondo-2)_45%,transparent),var(--shadow-elevada)] backdrop-blur-2xl transition-[width,height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-safe:animate-[asistente-entra_280ms_cubic-bezier(0.2,0.8,0.2,1)_both] print:hidden ${amplio ? 'h-[min(52rem,calc(100dvh-4rem))] w-[min(48rem,calc(100vw-3rem))]' : 'h-[min(44rem,calc(100dvh-4rem))] w-[27rem]'}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(70%_70%_at_10%_0%,color-mix(in_oklab,var(--color-asistente-1)_24%,transparent),transparent),radial-gradient(65%_65%_at_95%_8%,color-mix(in_oklab,var(--color-asistente-3)_24%,transparent),transparent),radial-gradient(45%_45%_at_50%_42%,color-mix(in_oklab,var(--color-asistente-2)_10%,transparent),transparent)]" />
      <div className="relative px-4 pt-3 pb-1">{cabecera}</div>
      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-color:var(--color-borde)_transparent] [scrollbar-width:thin]">{cuerpo}</div>
      {pie ? <div className="relative px-3 pt-2 pb-3">{pie}</div> : null}
    </section>
  );
}
