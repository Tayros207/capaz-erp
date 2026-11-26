import { useState, type ReactNode } from 'react';
import type { ConversacionDelAgente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { momentoDeConversacion, type GrupoDeConversaciones } from './logica-historial.ts';
import { CargandoLista, ErrorConReintento, SinNada, TARJETA } from './piezas-de-vista.tsx';

type Props = {
  estado: 'cargando' | 'error' | 'listo';
  mensajeDeError?: string;
  grupos: readonly GrupoDeConversaciones[];
  busqueda: string;
  alBuscar: (texto: string) => void;
  hayMas: boolean;
  cargandoMas: boolean;
  alVerMas: () => void;
  alReintentar: () => void;
  activaId: string | null;
  alAbrir: (id: string) => void;
  alFavorita: (id: string, favorita: boolean) => void;
  alRenombrar: (id: string, titulo: string) => void;
  alBorrar: (id: string) => void;
};

type PropsDeFila = { c: ConversacionDelAgente; activa: boolean; momento: string } & Pick<Props, 'alAbrir' | 'alFavorita' | 'alRenombrar' | 'alBorrar'>;

const FILA = 'border-t border-borde/70 first:border-t-0';
// Con cursor, renombrar y borrar se guardan hasta pasar por la fila o llegar con el teclado. En pantallas táctiles siempre se ven.
const ACCIONES_OCULTAS = '[@media(hover:hover)]:[li:not(:hover):not(:focus-within)_&]:w-0 [@media(hover:hover)]:[li:not(:hover):not(:focus-within)_&]:overflow-hidden [@media(hover:hover)]:[li:not(:hover):not(:focus-within)_&]:opacity-0';

function FilaEnEdicion({ c, alRenombrar, alTerminar }: Pick<PropsDeFila, 'c' | 'alRenombrar'> & { alTerminar: () => void }): ReactNode {
  const [titulo, setTitulo] = useState(c.titulo);
  const guardar = () => {
    const limpio = titulo.trim();
    if (limpio !== '' && limpio !== c.titulo) alRenombrar(c.id, limpio);
    alTerminar();
  };
  return (
    <li className={unir(FILA, 'flex items-center gap-1 p-2')}>
      <input
        autoFocus
        value={titulo}
        maxLength={120}
        aria-label="Nuevo título de la conversación"
        className="min-h-(--alto-control) min-w-0 flex-1 rounded-full border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') guardar();
          if (e.key === 'Escape') alTerminar();
        }}
      />
      <Boton variante="primario" icono="check" aria-label="Guardar el título" className="rounded-full" onClick={guardar} />
      <Boton variante="fantasma" icono="cerrar" aria-label="Cancelar" className="rounded-full" onClick={alTerminar} />
    </li>
  );
}

function FilaDeConversacion({ c, activa, momento, alAbrir, alFavorita, alRenombrar, alBorrar }: PropsDeFila): ReactNode {
  const [editando, setEditando] = useState(false);
  if (editando) return <FilaEnEdicion c={c} alRenombrar={alRenombrar} alTerminar={() => setEditando(false)} />;
  return (
    <li className={unir(FILA, 'flex items-center pr-1.5 transition-colors duration-150', activa ? 'bg-asistente-2/12' : 'hover:bg-asistente-2/8')}>
      <button type="button" aria-current={activa ? 'true' : undefined} className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pr-1 pl-3 text-left" onClick={() => alAbrir(c.id)}>
        <span className={unir('grid size-9 shrink-0 place-items-center rounded-xl', activa ? 'bg-linear-135 from-asistente-hondo-1 to-asistente-hondo-2 text-white' : 'bg-asistente-2/12 text-asistente-tinta-2')}><Icono nombre="conversacion" /></span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm leading-snug font-medium text-texto">{c.titulo}</span>
          <span className="text-xs text-texto-suave tabular-nums">{momento}</span>
        </span>
      </button>
      <span className={unir('flex shrink-0', ACCIONES_OCULTAS)}>
        <Boton variante="fantasma" icono="editar" aria-label="Renombrar la conversación" className="rounded-full" onClick={() => setEditando(true)} />
        <Boton variante="fantasma" icono="borrar" aria-label="Borrar la conversación" className="rounded-full hover:text-peligro!" onClick={() => alBorrar(c.id)} />
      </span>
      <Boton variante="fantasma" icono="favorita" aria-pressed={c.favorita} aria-label={c.favorita ? 'Quitar de favoritas' : 'Marcar como favorita'} className={unir('rounded-full', c.favorita && 'text-aviso! [&_svg]:fill-current')} onClick={() => alFavorita(c.id, !c.favorita)} />
    </li>
  );
}

function Buscador({ busqueda, alBuscar }: Pick<Props, 'busqueda' | 'alBuscar'>): ReactNode {
  return (
    <div className="relative">
      <Icono nombre="buscar" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-texto-suave" />
      <input
        type="search"
        value={busqueda}
        placeholder="Buscar una conversación"
        aria-label="Buscar una conversación"
        className="min-h-(--alto-control) w-full rounded-full border border-borde bg-superficie pr-4 pl-11 text-sm text-texto shadow-sutil placeholder:text-texto-suave/80"
        onChange={(e) => alBuscar(e.target.value)}
      />
    </div>
  );
}

function Grupo({ g, p }: { g: GrupoDeConversaciones; p: Props }): ReactNode {
  return (
    <section aria-label={g.titulo} className="flex flex-col gap-1.5">
      <h3 className="px-3 text-xs font-semibold text-texto-suave">{g.titulo}</h3>
      <ul className={unir(TARJETA, 'overflow-hidden')}>
        {g.items.map((c) => (
          <FilaDeConversacion key={c.id} c={c} activa={c.id === p.activaId} momento={momentoDeConversacion(c.actualizadoEn, g.clave)} alAbrir={p.alAbrir} alFavorita={p.alFavorita} alRenombrar={p.alRenombrar} alBorrar={p.alBorrar} />
        ))}
      </ul>
    </section>
  );
}

/** La lista de conversaciones de la persona: buscador, grupos por fecha y acciones de cada una. Solo presenta; los datos los trae su contenedor. */
export function ListaDeConversaciones(p: Props): ReactNode {
  if (p.estado === 'cargando') return <CargandoLista etiqueta="Cargando conversaciones" alto="h-14" />;
  if (p.estado === 'error') return <ErrorConReintento mensaje={p.mensajeDeError ?? 'No se pudieron cargar las conversaciones.'} alReintentar={p.alReintentar} />;
  return (
    <div className="flex flex-col gap-3">
      <Buscador busqueda={p.busqueda} alBuscar={p.alBuscar} />
      {p.grupos.length === 0 ? (
        <SinNada icono="conversacion" texto={p.busqueda.trim() === '' ? 'Aún no tienes conversaciones.' : 'Ninguna conversación coincide con la búsqueda.'} />
      ) : (
        p.grupos.map((g) => <Grupo key={g.clave} g={g} p={p} />)
      )}
      {p.hayMas ? <Boton variante="secundario" className="rounded-full" cargando={p.cargandoMas} onClick={p.alVerMas}>Ver más</Boton> : null}
    </div>
  );
}
