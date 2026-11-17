import { CasillaDeSeleccion } from '../../../shared/ui/datos/casilla-de-seleccion.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { fijarColumnas } from './api-cuadro.ts';
import { COLUMNAS, ETIQUETA_DE_COLUMNA, ETIQUETA_DE_SEMAFORO, textoDeImporte, textoDePorcentaje } from './logica-cuadro.ts';
import { argumentosDeColumnas, columnasAlAlternar } from './logica-cuadro-precio.ts';
import type { ContextoDelCuadro } from './use-cuadro.ts';

/** Una tarjeta por cantidad: precio, margen, si está completa y si se envía al cliente («columnas a enviar»). */
export function CabeceraDeColumnas({ id, vista, aplicar, editable }: ContextoDelCuadro) {
  return (
    <ul aria-label="Resumen por cantidad" className="grid grid-cols-3 gap-2">
      {COLUMNAS.map((c) => {
        const col = vista.directo.columnas[c];
        const sem = col.interno?.semaforo ? ETIQUETA_DE_SEMAFORO[col.interno.semaforo] : null;
        return (
          <li key={c} className="flex min-w-0 flex-col gap-1 rounded-control border border-borde bg-superficie-alta p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="font-semibold text-texto">{ETIQUETA_DE_COLUMNA[c]}</span>
              {editable ? (
                <CasillaDeSeleccion
                  etiqueta={`Enviar la cantidad ${ETIQUETA_DE_COLUMNA[c]} al cliente`} marcada={col.seEnvia}
                  onCambio={() => { const nuevas = columnasAlAlternar(vista, c, !col.seEnvia); if (nuevas) void aplicar(fijarColumnas(argumentosDeColumnas(id, nuevas))); }}
                />
              ) : null}
            </div>
            <span className="truncate text-sm tabular-nums text-texto">{col.comercial ? textoDeImporte(col.comercial.precioCentimos) : '—'}</span>
            {col.interno ? <span className="text-xs text-texto-suave">Margen {textoDePorcentaje(col.interno.margenPct)}</span> : null}
            <div className="flex flex-wrap gap-1">
              {col.esBase ? <Insignia tono="info">Base</Insignia> : null}
              {col.completa ? null : <Insignia tono="aviso">Incompleta</Insignia>}
              {sem ? <Insignia tono={sem.tono}>{sem.texto}</Insignia> : null}
            </div>
            {col.motivo ? <p className="text-xs text-texto-suave">{col.motivo}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
