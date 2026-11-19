import { Icono } from './icono.tsx';
import type { Opcion } from './logica-selector.ts';
import { unir } from './unir.ts';

type Props = {
  id: string;
  etiqueta: string;
  abierto: boolean;
  activo: number;
  opciones: Opcion[];
  cargando: boolean;
  falla: boolean;
  textoVacio: string;
  /** Texto de la opción «crear», siempre la última y fija abajo; nulo si no se ofrece. */
  crear: string | null;
  alElegir: (i: number) => void;
};

const BASE = 'flex min-h-(--alto-control) w-full cursor-pointer items-center px-3 text-left';

/** Lista desplegable del selector de registro: resultados, estados de carga y la opción de crear fija abajo. */
export function ListaDelSelector({ id, etiqueta, abierto, activo, opciones, cargando, falla, textoVacio, crear, alElegir }: Props) {
  return (
    <div id={`${id}-lista`} role="listbox" aria-label={`Resultados de ${etiqueta}`} hidden={!abierto}
      className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-control border border-borde-fuerte bg-superficie shadow-lg">
      {opciones.map((o, i) => (
        <button key={o.id} id={`${id}-op-${i}`} type="button" role="option" aria-selected={i === activo} tabIndex={-1}
          className={unir(BASE, 'text-texto', i === activo ? 'bg-superficie-alta' : 'hover:bg-superficie-alta')}
          onMouseDown={(e) => e.preventDefault()} onClick={() => alElegir(i)}>
          {o.nombre + (o.detalle ? ` · ${o.detalle}` : '')}
        </button>
      ))}
      {cargando ? <p role="status" className="px-3 py-3 text-texto-suave">Buscando…</p> : null}
      {falla ? <p role="alert" className="px-3 py-3 font-medium text-peligro">No se pudo buscar. Intenta de nuevo.</p> : null}
      {!cargando && !falla && opciones.length === 0 ? <p role="status" className="px-3 py-3 text-texto-suave">{textoVacio}</p> : null}
      {crear !== null ? (
        <button key="crear" id={`${id}-op-${opciones.length}`} type="button" role="option" aria-selected={opciones.length === activo} tabIndex={-1}
          className={unir(BASE, 'sticky bottom-0 gap-2 border-t border-borde font-medium text-accion', opciones.length === activo ? 'bg-superficie-alta' : 'bg-superficie hover:bg-superficie-alta')}
          onMouseDown={(e) => e.preventDefault()} onClick={() => alElegir(opciones.length)}>
          <Icono nombre="mas" />{crear}
        </button>
      ) : null}
    </div>
  );
}
