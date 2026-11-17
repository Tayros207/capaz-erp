import { useState } from 'react';
import { esUnidadConocida, GRUPOS_DE_UNIDADES } from '../formato/unidades.ts';
import { Campo } from './campo.tsx';
import { CampoSelect } from './campo-select.tsx';

const OTRA = '__otra__';

type Props = {
  valor: string;
  alCambiar: (unidad: string) => void;
  etiqueta?: string;
  error?: string;
  ayuda?: string;
  /** Texto de la opción vacía (por ejemplo «La del producto»); sin él, siempre hay una unidad elegida. */
  textoVacio?: string;
};

/** Unidad de medida: lista de las comunes (cantidad, cm, m, kg, l…) y «Otra…» para escribir una propia. */
export function CampoUnidad({ valor, alCambiar, etiqueta = 'Unidad', error, ayuda, textoVacio }: Props) {
  const [otra, setOtra] = useState(() => valor.trim() !== '' && !esUnidadConocida(valor));
  const seleccion = otra ? OTRA : valor;
  return (
    <div className="flex flex-col gap-2">
      <CampoSelect
        etiqueta={etiqueta}
        value={seleccion}
        error={otra ? undefined : error}
        ayuda={ayuda}
        onChange={(e) => {
          if (e.target.value === OTRA) { setOtra(true); alCambiar(esUnidadConocida(valor) ? '' : valor); }
          else { setOtra(false); alCambiar(e.target.value); }
        }}
      >
        {textoVacio !== undefined ? <option value="">{textoVacio}</option> : null}
        {GRUPOS_DE_UNIDADES.map((g) => (
          <optgroup key={g.grupo} label={g.grupo}>
            {g.unidades.map((u) => <option key={u.valor} value={u.valor}>{u.nombre} ({u.valor})</option>)}
          </optgroup>
        ))}
        <option value={OTRA}>Otra…</option>
      </CampoSelect>
      {otra ? <Campo etiqueta="Otra unidad" maxLength={20} autoComplete="off" value={valor} error={error} onChange={(e) => alCambiar(e.target.value)} /> : null}
    </div>
  );
}
