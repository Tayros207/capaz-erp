import { useState, type ReactNode } from 'react';
import type { ConversacionDelAgente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import type { GrupoDeConversaciones } from './logica-historial.ts';

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

type PropsDeFila = { c: ConversacionDelAgente; activa: boolean } & Pick<Props, 'alAbrir' | 'alFavorita' | 'alRenombrar' | 'alBorrar'>;

function FilaDeConversacion({ c, activa, alAbrir, alFavorita, alRenombrar, alBorrar }: PropsDeFila): ReactNode {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(c.titulo);
  const guardar = () => {
    const limpio = titulo.trim();
    if (limpio !== '' && limpio !== c.titulo) alRenombrar(c.id, limpio);
    setEditando(false);
  };
  if (editando) {
    return (
      <li className="flex items-center gap-1 rounded-control border border-borde-fuerte p-1">
        <input
          autoFocus
          value={titulo}
          maxLength={120}
          aria-label="Nuevo título de la conversación"
          className="min-h-(--alto-control) min-w-0 flex-1 rounded-control border border-borde-fuerte bg-superficie px-2 text-sm text-texto"
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardar();
            if (e.key === 'Escape') setEditando(false);
          }}
        />
        <Boton variante="primario" icono="check" aria-label="Guardar el título" onClick={guardar} />
        <Boton variante="fantasma" icono="cerrar" aria-label="Cancelar" onClick={() => setEditando(false)} />
      </li>
    );
  }
  return (
    <li className={`flex items-center gap-1 rounded-control border p-1 ${activa ? 'border-accion bg-accion/5' : 'border-borde'}`}>
      <button type="button" aria-current={activa ? 'true' : undefined} className="min-h-(--alto-control) min-w-0 flex-1 cursor-pointer px-2 text-left text-sm text-texto" onClick={() => alAbrir(c.id)}>
        <span className="block truncate">{c.titulo}</span>
      </button>
      <Boton variante={c.favorita ? 'secundario' : 'fantasma'} icono="favorita" aria-pressed={c.favorita} aria-label={c.favorita ? 'Quitar de favoritas' : 'Marcar como favorita'} onClick={() => alFavorita(c.id, !c.favorita)} />
      <Boton variante="fantasma" icono="editar" aria-label="Renombrar la conversación" onClick={() => { setTitulo(c.titulo); setEditando(true); }} />
      <Boton variante="fantasma" icono="borrar" aria-label="Borrar la conversación" onClick={() => alBorrar(c.id)} />
    </li>
  );
}

/** La lista de conversaciones de la persona: buscador, grupos por fecha y acciones de cada una. Solo presenta; los datos los trae su contenedor. */
export function ListaDeConversaciones(p: Props): ReactNode {
  if (p.estado === 'cargando') {
    return (
      <div aria-busy="true" aria-label="Cargando conversaciones" className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => <Esqueleto key={i} className="h-11 w-full" />)}
      </div>
    );
  }
  if (p.estado === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-control border border-peligro/40 bg-peligro/10 p-3 text-sm text-texto">
        <p>{p.mensajeDeError ?? 'No se pudieron cargar las conversaciones.'}</p>
        <Boton variante="secundario" onClick={p.alReintentar}>Reintentar</Boton>
      </div>
    );
  }
  const vacia = p.grupos.length === 0;
  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={p.busqueda}
        placeholder="Buscar una conversación"
        aria-label="Buscar una conversación"
        className="min-h-(--alto-control) w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto placeholder:text-texto-suave/80"
        onChange={(e) => p.alBuscar(e.target.value)}
      />
      {vacia ? (
        <p className="py-4 text-center text-sm text-texto-suave">{p.busqueda.trim() === '' ? 'Aún no tienes conversaciones.' : 'Ninguna conversación coincide con la búsqueda.'}</p>
      ) : (
        p.grupos.map((g) => (
          <section key={g.clave} aria-label={g.titulo} className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold tracking-wide text-texto-suave uppercase">{g.titulo}</h3>
            <ul className="flex flex-col gap-1">
              {g.items.map((c) => (
                <FilaDeConversacion key={c.id} c={c} activa={c.id === p.activaId} alAbrir={p.alAbrir} alFavorita={p.alFavorita} alRenombrar={p.alRenombrar} alBorrar={p.alBorrar} />
              ))}
            </ul>
          </section>
        ))
      )}
      {p.hayMas ? <Boton variante="secundario" cargando={p.cargandoMas} onClick={p.alVerMas}>Ver más</Boton> : null}
    </div>
  );
}
