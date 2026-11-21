import { formatearSoles, type Centimos } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';

type Props = {
  total: Centimos | null;
  /** Solo con deuda: lo que se deja hoy y lo que falta cancelar. */
  adelanto?: number | null;
  falta?: number | undefined;
  textoBoton: string;
  /** Qué falta para guardar, en palabras sencillas; `null` si está todo. */
  pista: string | null;
  alTocarPista: () => void;
  guardando: boolean;
  alCerrar: () => void;
  textoCerrar?: string;
  /** El `id` del formulario que envía el botón (la barra va fuera de él, fija al pie). */
  formularioId: string;
};

/** El pie fijo de la hoja: el total siempre a la vista, lo que falta y los botones. El botón se apaga con la pista de qué falta. */
export function BarraDeTotal({ total, adelanto, falta, textoBoton, pista, alTocarPista, guardando, alCerrar, textoCerrar = 'Cerrar', formularioId }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3" aria-live="polite">
        <div className="flex flex-col">
          <span className="text-sm text-texto-suave">Total</span>
          <span className="text-2xl font-semibold tabular-nums text-texto">{total === null ? '—' : formatearSoles(total)}</span>
        </div>
        {falta !== undefined ? (
          <div className="flex flex-col items-end text-sm">
            {adelanto ? <span className="text-texto-suave">Dejó {formatearSoles(adelanto as Centimos)}</span> : null}
            <span className={`font-semibold tabular-nums ${falta > 0 ? 'text-aviso' : 'text-exito'}`}>Falta cancelar {formatearSoles(falta as Centimos)}</span>
          </div>
        ) : null}
      </div>
      {pista ? (
        <button type="button" onClick={alTocarPista} className="text-left text-sm font-medium text-aviso underline underline-offset-2">{pista}</button>
      ) : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>{textoCerrar}</Boton>
        <Boton type="submit" form={formularioId} variante="primario" tamano="grande" cargando={guardando} disabled={pista !== null} className="min-w-44 flex-1 sm:flex-none">{textoBoton}</Boton>
      </div>
    </div>
  );
}
