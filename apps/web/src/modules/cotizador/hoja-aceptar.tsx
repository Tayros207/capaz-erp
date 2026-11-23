import { useState } from 'react';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CasillaDeSeleccion } from '../../shared/ui/datos/casilla-de-seleccion.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { soles } from './logica.ts';
import { validarAceptacion } from './logica-cotizaciones.ts';

type Props = { abierto: boolean; cotizacion: CotizacionCompletaDto; alAceptar: (elegidas: ReadonlySet<number>) => Promise<boolean>; alCerrar: () => void };

function Contenido({ cotizacion: c, alAceptar, alCerrar }: Omit<Props, 'abierto'>) {
  const [elegidas, setElegidas] = useState<ReadonlySet<number>>(new Set(c.conOpciones ? [] : c.lineas.map((l) => l.posicion)));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const alternar = (p: number) => setElegidas((a) => { const n = new Set(a); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  async function aceptar() {
    const e = validarAceptacion(c.conOpciones, elegidas);
    setError(e);
    if (e) return;
    setEnviando(true);
    const hecho = await alAceptar(elegidas);
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-texto">{c.conOpciones ? 'Marca las opciones que el cliente aceptó.' : 'Se aceptan todas las líneas de la cotización.'}</p>
      {c.conOpciones ? (
        <ul className="flex flex-col gap-1">
          {c.lineas.map((l) => (
            <li key={l.posicion} className="flex items-center gap-2">
              <CasillaDeSeleccion etiqueta={`Aceptar: ${l.descripcion}`} marcada={elegidas.has(l.posicion)} onCambio={() => alternar(l.posicion)} />
              <span className="min-w-0 flex-1 break-words text-texto">{l.descripcion}<span className="block text-sm text-texto-suave">{formatearCantidad(l.cantidadMilesimas, l.unidad)} · {soles(l.totalCentimos)}{c.igvPorcentaje > 0 ? ' con IGV' : ''}</span></span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="text-sm font-medium text-peligro">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton variante="primario" cargando={enviando} onClick={() => void aceptar()}>Aceptar cotización</Boton>
      </div>
    </div>
  );
}

/** Aceptar: con opciones se eligen las líneas; sin opciones se aceptan todas. */
export function HojaAceptar({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Aceptar cotización">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
