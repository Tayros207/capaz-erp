import { useId, useState } from 'react';
import { Boton } from './boton.tsx';
import { ContenedorDeCampo } from './campo.tsx';
import { CLASES_DE_CONTROL, descritoPor } from './campo-comun.ts';
import { teclaDelSelector } from './logica-selector.ts';
import { unir } from './unir.ts';
import { useBusqueda } from './use-busqueda.ts';

export type Opcion = { id: string; nombre: string; detalle?: string };

type Props = {
  etiqueta: string;
  valor: Opcion | null;
  alCambiar: (o: Opcion | null) => void;
  buscar: (texto: string) => Promise<Opcion[]>;
  error?: string;
  ayuda?: string;
  textoSinResultados?: string;
  alCrear?: (texto: string) => void;
  textoCrear?: string;
};

/** Elige un registro buscándolo por texto. Quien lo usa aporta `buscar`; no conoce ninguna API. */
export function SelectorDeRegistro({ etiqueta, valor, alCambiar, buscar, error, ayuda, textoSinResultados = 'Sin resultados', alCrear, textoCrear = 'Crear' }: Props) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const { cargando, falla, opciones } = useBusqueda(texto, abierto && valor === null, buscar);
  const puedeCrear = alCrear !== undefined && texto.trim() !== '';
  const total = opciones.length + (puedeCrear ? 1 : 0);

  if (valor) {
    return (
      <ContenedorDeCampo id={id} etiqueta={etiqueta} error={error} ayuda={ayuda}>
        <div className="flex min-h-(--alto-control) items-center justify-between gap-2 rounded-control border border-borde-fuerte bg-superficie pl-3">
          <span className="min-w-0 truncate text-texto">{valor.nombre}{valor.detalle ? <span className="text-texto-suave"> · {valor.detalle}</span> : null}</span>
          <Boton id={id} variante="fantasma" aria-label={`Cambiar ${etiqueta}`} onClick={() => { alCambiar(null); setTexto(''); setAbierto(true); }}>Cambiar</Boton>
        </div>
      </ContenedorDeCampo>
    );
  }

  const elegir = (i: number) => {
    const o = opciones[i];
    if (o) { alCambiar(o); setTexto(''); } else if (puedeCrear) alCrear(texto.trim());
    setAbierto(false); setActivo(-1);
  };
  const alTeclear = (e: React.KeyboardEvent) => {
    const r = teclaDelSelector({ abierto, activo, total }, e.key);
    if (r.accion !== 'ninguna' || r.activo !== activo || r.abierto !== abierto) e.preventDefault();
    setAbierto(r.abierto); setActivo(r.activo);
    if (r.accion === 'elegir') elegir(activo);
  };

  return (
    <ContenedorDeCampo id={`${id}-entrada`} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <div className="relative">
        <input
          id={`${id}-entrada`} type="text" role="combobox" autoComplete="off" aria-expanded={abierto} aria-controls={`${id}-lista`} aria-autocomplete="list"
          aria-activedescendant={abierto && activo >= 0 ? `${id}-op-${activo}` : undefined}
          aria-invalid={error ? true : undefined} aria-describedby={descritoPor(`${id}-entrada`, error, ayuda)}
          value={texto} placeholder="Escribe para buscar"
          className={unir(CLASES_DE_CONTROL, error ? 'border-peligro' : 'border-borde-fuerte')}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(-1); }}
          onFocus={() => setAbierto(true)} onBlur={() => setAbierto(false)} onKeyDown={alTeclear}
        />
        <div id={`${id}-lista`} role="listbox" aria-label={`Resultados de ${etiqueta}`} hidden={!abierto}
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-control border border-borde-fuerte bg-superficie shadow-lg">
          {[...opciones.map((o) => o.nombre + (o.detalle ? ` · ${o.detalle}` : '')), ...(puedeCrear ? [`${textoCrear} «${texto.trim()}»`] : [])].map((t, i) => (
            <button key={i < opciones.length ? opciones[i]!.id : 'crear'} id={`${id}-op-${i}`} type="button" role="option" aria-selected={i === activo} tabIndex={-1}
              className={unir('flex min-h-(--alto-control) w-full cursor-pointer items-center px-3 text-left text-texto', i === activo ? 'bg-superficie-alta' : 'hover:bg-superficie-alta')}
              onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(i)}>{t}</button>
          ))}
          {cargando ? <p role="status" className="px-3 py-3 text-texto-suave">Buscando…</p> : null}
          {falla ? <p role="alert" className="px-3 py-3 font-medium text-peligro">No se pudo buscar. Intenta de nuevo.</p> : null}
          {!cargando && !falla && opciones.length === 0 ? <p role="status" className="px-3 py-3 text-texto-suave">{textoSinResultados}</p> : null}
        </div>
      </div>
    </ContenedorDeCampo>
  );
}
