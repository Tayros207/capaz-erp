import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { MAXIMO_DE_TEXTO_DE_CAPTURA, type EstadoDelAgente } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { useEsAncho } from '../../shared/ui/use-ancho.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { useReconocedorWebSpeech } from '../captura/use-reconocedor-web-speech.ts';
import { CLAVE_ESTADO_DEL_AGENTE, estadoDelAgente } from './api.ts';
import { CajaDeMensaje } from './caja-de-mensaje.tsx';
import { Hilo } from './hilo.tsx';
import { HistorialConectado } from './historial-conectado.tsx';
import { InsigniaDeUso } from './insignia-de-uso.tsx';
import { estadoVivo, type EstadoVivo } from './logica-acciones.ts';
import { OrbeDelAsistente } from './orbe-del-asistente.tsx';
import { SUGERENCIAS_CON_ASISTENTE, SUGERENCIAS_INICIALES } from './logica-hilo.ts';
import { AVISO_SIN_IA, AVISO_SIN_PERMISO, AVISO_TOPE, MARCADOR_DE_LA_CAJA, SALUDO_CON_ASISTENTE, SALUDO_VACIO } from './logica-panel.ts';
import { pantallaDesdeRuta } from './logica-pantalla.ts';
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

type PropsDeCabecera = { pista: string; conectado: boolean; vivo: EstadoVivo | null; alNueva: () => void; alHistorial: () => void; alModelo: () => void; alCerrar?: () => void };

/** El cabezal: el orbe (que piensa cuando trabaja), el nombre y una línea que dice qué está haciendo AHORA o dónde está la persona. */
function Cabecera({ pista, conectado, vivo, alNueva, alHistorial, alModelo, alCerrar }: PropsDeCabecera): ReactNode {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <OrbeDelAsistente tamano="size-9" nivel={vivo ? 'trabajando' : 'reposo'} />
        <div className="min-w-0">
          {alCerrar ? <h2 className="font-titulo text-base leading-tight font-semibold tracking-tight">Asistente</h2> : null}
          <p aria-live="polite" className={vivo ? 'truncate text-xs font-medium text-asistente-2' : 'truncate text-xs text-texto-suave'}>{vivo ? vivo.texto : pista || 'En línea'}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Boton variante="fantasma" icono="nueva" aria-label="Nueva conversación" onClick={alNueva} />
        <Boton variante="fantasma" icono="historial" aria-label="Historial" onClick={alHistorial} />
        {conectado ? <Boton variante="fantasma" icono="modelo" aria-label="Ajustes del asistente" onClick={alModelo} /> : null}
        {alCerrar ? <Boton variante="fantasma" icono="cerrar" aria-label="Cerrar" onClick={alCerrar} /> : null}
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
    const contenido = conectado ? <HistorialConectado activaId={null} alAbrir={alAbrir} alBorrada={() => undefined} /> : undefined;
    return <VistaDeHistorial alVolver={alVolver} contenido={contenido} />;
  }
  if (vista === 'modelo') {
    return (
      <section aria-label="Ajustes del asistente" className="flex flex-col gap-3">
        <div><Boton variante="fantasma" icono="atras" onClick={alVolver}>Volver a la conversación</Boton></div>
        <AjustesDelAsistente puedeConfigurar={estado?.puedeConfigurar === true} />
      </section>
    );
  }
  const aviso = avisoDeEstado(estado);
  return (
    <div className="flex flex-col gap-3">
      {aviso ? <p role="note" className="rounded-control border border-borde bg-superficie-alta p-2 text-xs text-texto-suave">{aviso}</p> : null}
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
  const voz = useReconocedorWebSpeech();
  const entrada = useEntradaDeTexto(voz);
  const estado = useQuery({ queryKey: CLAVE_ESTADO_DEL_AGENTE, queryFn: async () => datosOError(await estadoDelAgente()), enabled: abierto, staleTime: 30_000 });
  const c = useConversacion(voz, entrada, pantallaDesdeRuta(pathname), estado.data?.activo === true);
  const [vista, setVista] = useState<Vista>('conversacion');
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
    <Cabecera pista={migas.join(' › ')} vivo={estadoVivo(c.hilo, c.ocupado)} conectado={estado.data?.activo === true} alNueva={() => { c.nueva(); setVista('conversacion'); }} alHistorial={() => setVista('historial')} alModelo={() => setVista('modelo')} alCerrar={ancho ? alCerrar : undefined} />
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
      className="fixed right-6 bottom-6 z-30 flex h-[min(42rem,calc(100dvh-6rem))] w-[27rem] flex-col overflow-hidden rounded-[1.5rem] border border-borde bg-superficie shadow-elevada motion-safe:animate-[asistente-entra_260ms_cubic-bezier(0.2,0.8,0.2,1)_both] print:hidden"
    >
      <div className="border-b border-borde bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-asistente-1)_10%,transparent),transparent)] px-4 py-3">{cabecera}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{cuerpo}</div>
      {pie ? <div className="px-3 pt-1 pb-3">{pie}</div> : null}
    </section>
  );
}
