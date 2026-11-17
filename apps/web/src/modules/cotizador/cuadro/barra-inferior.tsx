import { Boton } from '../../../shared/ui/boton.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { ETIQUETA_DE_SEMAFORO, semaforoDe, sePuedeEmitir, textoDeImporte, type Vista } from './logica-cuadro.ts';

type Props = { vista: Vista; puedeEmitir: boolean; emitiendo: boolean; alEmitir: () => void };

/** Barra fija del móvil: el precio que rige y la acción principal. Desde 1.280 px el recibo ya está a la vista y la barra no se muestra. */
export function BarraInferior({ vista, puedeEmitir, emitiendo, alEmitir }: Props) {
  const sem = semaforoDe(vista);
  const etiqueta = sem ? ETIQUETA_DE_SEMAFORO[sem] : null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 border-t border-borde bg-superficie/95 px-4 py-2 shadow-elevada backdrop-blur md:bottom-0 xl:hidden">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-texto-suave">Precio sin IGV</span>
        <span className="flex items-center gap-2">
          <span className="truncate text-lg font-semibold tabular-nums text-texto">{vista.comercial ? textoDeImporte(vista.comercial.precioCentimos) : '—'}</span>
          {etiqueta ? <Insignia tono={etiqueta.tono}>{etiqueta.texto}</Insignia> : null}
        </span>
      </div>
      {puedeEmitir && sePuedeEmitir(vista) ? <Boton variante="primario" cargando={emitiendo} onClick={alEmitir}>Emitir</Boton> : null}
    </div>
  );
}
