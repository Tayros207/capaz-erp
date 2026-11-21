import { useId, useState } from 'react';
import { Boton } from './boton.tsx';
import { ContenedorDeCampo } from './campo.tsx';
import { CLASES_DE_CONTROL, descritoPor } from './campo-comun.ts';
import { Icono } from './icono.tsx';
import { ListaDelSelector } from './lista-del-selector.tsx';
import { teclaDelSelector, textoDeCrear, type Opcion } from './logica-selector.ts';
import { unir } from './unir.ts';
import { useBusqueda } from './use-busqueda.ts';

export type { Opcion } from './logica-selector.ts';

/** Botón fijo junto a la etiqueta; el margen negativo mantiene la fila de la etiqueta baja. */
function BotonCrear({ texto, alPulsar }: { texto: string; alPulsar: () => void }) {
  return (
    <button type="button" onClick={alPulsar} className="-my-1.5 inline-flex min-h-8 items-center gap-1 rounded-control px-2 text-sm font-medium text-accion hover:bg-superficie-alta">
      <Icono nombre="mas" />{texto}
    </button>
  );
}

type Props = {
  etiqueta: string;
  valor: Opcion | null;
  alCambiar: (o: Opcion | null) => void;
  buscar: (texto: string) => Promise<Opcion[]>;
  /** Qué mostrar al abrir el campo sin haber escrito nada (por ejemplo los primeros de la lista). Sin él, pide escribir. */
  buscarSinTexto?: () => Promise<Opcion[]>;
  error?: string;
  ayuda?: string;
  textoSinResultados?: string;
  alCrear?: (texto: string) => void;
  textoCrear?: string;
  /** Botón siempre visible junto a la etiqueta (p. ej. «Nuevo cliente»): llama a `alCrear` con lo escrito, aunque esté vacío. Solo con `alCrear`. */
  botonCrear?: string;
  /** Ejemplo dentro del campo; sin él, «Escribe para buscar». */
  placeholder?: string;
};

/** Elige un registro buscándolo por texto. Quien lo usa aporta `buscar`; no conoce ninguna API. */
export function SelectorDeRegistro({ etiqueta, valor, alCambiar, buscar, buscarSinTexto, error, ayuda, textoSinResultados = 'Sin resultados', alCrear, textoCrear = 'Crear', botonCrear, placeholder = 'Escribe para buscar' }: Props) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const { cargando, falla, opciones } = useBusqueda(texto, abierto && valor === null, buscar, 300, buscarSinTexto);
  const crear = textoDeCrear(alCrear !== undefined, textoCrear, texto);
  const total = opciones.length + (crear !== null ? 1 : 0);

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
    if (o) { alCambiar(o); setTexto(''); } else if (crear !== null) alCrear?.(texto.trim());
    setAbierto(false); setActivo(-1);
  };
  const alTeclear = (e: React.KeyboardEvent) => {
    const r = teclaDelSelector({ abierto, activo, total }, e.key);
    if (r.accion !== 'ninguna' || r.activo !== activo || r.abierto !== abierto) e.preventDefault();
    setAbierto(r.abierto); setActivo(r.activo);
    if (r.accion === 'elegir') elegir(activo);
  };

  const accion = alCrear && botonCrear ? <BotonCrear texto={botonCrear} alPulsar={() => alCrear(texto.trim())} /> : undefined;
  return (
    <ContenedorDeCampo id={`${id}-entrada`} etiqueta={etiqueta} error={error} ayuda={ayuda} accion={accion}>
      <div className="relative">
        <input
          id={`${id}-entrada`} type="text" role="combobox" autoComplete="off" aria-expanded={abierto} aria-controls={`${id}-lista`} aria-autocomplete="list"
          aria-activedescendant={abierto && activo >= 0 ? `${id}-op-${activo}` : undefined}
          aria-invalid={error ? true : undefined} aria-describedby={descritoPor(`${id}-entrada`, error, ayuda)}
          value={texto} placeholder={placeholder}
          className={unir(CLASES_DE_CONTROL, error ? 'border-peligro' : 'border-borde-fuerte')}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(-1); }}
          onFocus={() => setAbierto(true)} onBlur={() => setAbierto(false)} onKeyDown={alTeclear}
        />
        <ListaDelSelector id={id} etiqueta={etiqueta} abierto={abierto} activo={activo} opciones={opciones} cargando={cargando} falla={falla} crear={crear} alElegir={elegir}
          textoVacio={texto.trim() === '' && !buscarSinTexto ? 'Escribe para buscar.' : textoSinResultados} />
      </div>
    </ContenedorDeCampo>
  );
}
