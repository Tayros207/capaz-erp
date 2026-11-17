import { useState } from 'react';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { mostrarDecimal } from '../logica-taller.ts';
import { HojaDeFila, type FilaEnHoja } from './hoja-fila.tsx';
import { agruparPorFactor, textoDeImporte, type Fila } from './logica-cuadro.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

function FilaDelCuadro({ fila, costos, editable, alEditar }: { fila: Fila; costos: boolean; editable: boolean; alEditar: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-borde py-2 first:border-t-0">
      <div className="flex min-w-0 flex-col">
        <span className="break-words text-texto">{fila.numero}. {fila.descripcion}</span>
        <span className="text-sm text-texto-suave">
          {mostrarDecimal(fila.cantidad)} {fila.unidad}{fila.interno ? ` × S/ ${mostrarDecimal(fila.interno.costoUnitario)}` : ''}
        </span>
        {fila.automatica ? <span className="mt-0.5"><Insignia tono="info">{fila.automatica === 'papel' ? 'Papel automático' : 'Planchas automáticas'}</Insignia></span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {costos && fila.interno ? <span className="font-medium tabular-nums text-texto">{textoDeImporte(fila.interno.subtotalCentimos)}</span> : null}
        {editable ? <Boton variante="fantasma" aria-label={`Editar la fila ${fila.numero}`} onClick={alEditar}>Editar</Boton> : null}
      </div>
    </li>
  );
}

/** El cuadro de costos por factor: filas con su subtotal (que calcula el servidor) y agregar, editar o quitar. */
export function PanelFactores(ctx: ContextoDelCuadro) {
  const [en, setEn] = useState<FilaEnHoja | null>(null);
  return (
    <Seccion titulo="Costos por factor">
      {agruparPorFactor(ctx.vista).map((g) => (
        <div key={g.factor} className="flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-texto">{g.etiqueta}</h3>
            <div className="flex items-center gap-2">
              {ctx.costos && g.subtotalCentimos !== null ? <span className="font-semibold tabular-nums text-texto">{textoDeImporte(g.subtotalCentimos)}</span> : null}
              {ctx.editable ? <Boton variante="fantasma" icono="mas" aria-label={`Agregar una fila de ${g.etiqueta}`} onClick={() => setEn({ factor: g.factor })} /> : null}
            </div>
          </div>
          {g.filas.length ? (
            <ul aria-label={`Filas de ${g.etiqueta}`}>{g.filas.map((f) => <FilaDelCuadro key={f.id} fila={f} costos={ctx.costos} editable={ctx.editable} alEditar={() => setEn({ fila: f })} />)}</ul>
          ) : <p className="text-sm text-texto-suave">Sin filas.</p>}
        </div>
      ))}
      <HojaDeFila ctx={ctx} en={en} alCerrar={() => setEn(null)} />
    </Seccion>
  );
}
