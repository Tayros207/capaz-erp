import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { ETIQUETA_DE_PRESET, PRESETS, type Preset, type RangoDeDias } from './logica.ts';

type Props = {
  preset: Preset;
  rango: RangoDeDias;
  hoy: string;
  error: string | null;
  alElegir: (preset: Preset) => void;
  alCambiarRango: (rango: RangoDeDias) => void;
};

/** Hoy, 7 días, este mes o un rango escrito a mano. */
export function SelectorDePeriodo({ preset, rango, hoy, error, alElegir, alCambiarRango }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Boton key={p} variante={p === preset ? 'primario' : 'secundario'} aria-pressed={p === preset} onClick={() => alElegir(p)}>
            {ETIQUETA_DE_PRESET[p]}
          </Boton>
        ))}
      </div>
      {preset === 'rango' ? (
        <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo etiqueta="Desde" type="date" max={hoy} value={rango.desde} onChange={(e) => alCambiarRango({ ...rango, desde: e.target.value })} />
          <Campo etiqueta="Hasta" type="date" max={hoy} value={rango.hasta} error={error ?? undefined} onChange={(e) => alCambiarRango({ ...rango, hasta: e.target.value })} />
        </div>
      ) : null}
    </div>
  );
}
