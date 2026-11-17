import { useState } from 'react';
import { Boton } from '../../../shared/ui/boton.tsx';
import { CasillaDeSeleccion } from '../../../shared/ui/datos/casilla-de-seleccion.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { unir } from '../../../shared/ui/unir.ts';
import { fijarCostoDirecto } from './api-cuadro.ts';
import { CabeceraDeColumnas } from './cabecera-de-columnas.tsx';
import { HojaDeCelda, type CeldaEnHoja } from './hoja-celda.tsx';
import { HojaDeItem, type ItemEnHoja } from './hoja-item.tsx';
import { COLUMNAS, ETIQUETA_DE_COLUMNA, LEYENDA_DE_ORIGEN, textoDeImporte, type FilaDirecta } from './logica-cuadro.ts';
import { argumentosDeFija } from './logica-cuadro-precio.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

type Props = { ctx: ContextoDelCuadro; fila: FilaDirecta; alCelda: (c: CeldaEnHoja) => void; alItem: (f: FilaDirecta) => void };

function FilaDelDirecto({ ctx, fila, alCelda, alItem }: Props) {
  return (
    <li className="flex flex-col gap-1 border-t border-borde py-2 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words font-medium text-texto">{fila.nombre}{fila.esItem ? <> <Insignia>Ítem</Insignia></> : null}</span>
        <div className="flex shrink-0 items-center gap-1 text-sm text-texto-suave">
          {fila.esItem && ctx.editable ? <Boton variante="fantasma" aria-label={`Editar el ítem ${fila.nombre}`} onClick={() => alItem(fila)}>Editar</Boton> : null}
          {ctx.editable ? <CasillaDeSeleccion etiqueta={`Fila fija: ${fila.nombre}`} marcada={fila.fija} onCambio={() => void ctx.aplicar(fijarCostoDirecto(argumentosDeFija(ctx.id, fila, !fila.fija)))} /> : null}
          <span aria-hidden="true">Fija</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {COLUMNAS.map((c) => {
          const celda = fila.celdas[c];
          const origen = LEYENDA_DE_ORIGEN[celda.origen];
          return (
            <button
              key={c} type="button" disabled={!ctx.editable} onClick={() => alCelda({ fila, columna: c })}
              aria-label={`${fila.nombre}, cantidad ${ETIQUETA_DE_COLUMNA[c]}: ${textoDeImporte(celda.valorCentimos)}. ${origen.frase}`}
              className={unir('flex min-h-11 min-w-0 cursor-pointer flex-col items-end gap-0.5 rounded-control border px-2 py-1 text-right enabled:hover:border-borde-fuerte disabled:cursor-default', celda.origen === 'mano' ? 'border-info/40 bg-info/5' : 'border-borde')}
            >
              <span className="text-[0.6875rem] text-texto-suave">{ETIQUETA_DE_COLUMNA[c]}</span>
              <span className="max-w-full truncate text-sm font-medium tabular-nums text-texto">{textoDeImporte(celda.valorCentimos)}</span>
              <span className="text-[0.6875rem] text-texto-suave">{origen.marca}</span>
            </button>
          );
        })}
      </div>
    </li>
  );
}

/** El cuadro directo de tres columnas (100 / 1.000 / 5.000): el origen de cada celda y la leyenda. Solo con permiso de costos. */
export function CuadroDirecto(ctx: ContextoDelCuadro) {
  const [celda, setCelda] = useState<CeldaEnHoja | null>(null);
  const [item, setItem] = useState<ItemEnHoja | null>(null);
  const filas = ctx.vista.directo.interno?.filas ?? [];
  const { bloqueos, avisos } = ctx.vista.directo.coherencia ?? { bloqueos: [], avisos: [] };
  return (
    <Seccion titulo="Cuadro directo" accion={ctx.editable ? <Boton variante="secundario" icono="mas" onClick={() => setItem({ nuevo: true })}>Ítem</Boton> : undefined}>
      <CabeceraDeColumnas {...ctx} />
      {bloqueos.map((h) => <p key={h.codigo} role="alert" className="text-sm font-medium text-peligro">{h.mensaje}</p>)}
      {avisos.map((h) => <p key={h.codigo} role="status" className="text-sm font-medium text-aviso">{h.mensaje}</p>)}
      <ul aria-label="Filas del cuadro directo">{filas.map((f) => <FilaDelDirecto key={f.clave} ctx={ctx} fila={f} alCelda={setCelda} alItem={(x) => setItem({ fila: x })} />)}</ul>
      <dl aria-label="Leyenda de los orígenes" className="grid gap-1 text-xs text-texto-suave">
        {Object.values(LEYENDA_DE_ORIGEN).map((o) => <div key={o.marca} className="flex gap-2"><dt className="w-20 shrink-0 font-medium text-texto">{o.marca}</dt><dd>{o.frase}</dd></div>)}
      </dl>
      <HojaDeCelda ctx={ctx} celda={celda} alCerrar={() => setCelda(null)} />
      <HojaDeItem ctx={ctx} item={item} alCerrar={() => setItem(null)} />
    </Seccion>
  );
}
