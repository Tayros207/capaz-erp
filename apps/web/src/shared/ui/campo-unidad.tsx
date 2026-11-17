import { useState } from 'react';
import { esUnidadConocida, GRUPOS_DE_UNIDADES, unidadConocida } from '../formato/unidades.ts';
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
  /** Las unidades de la empresa: salen en un grupo «De tu empresa» antes de las comunes. Sin ellas, el campo es como siempre. */
  unidadesDeLaEmpresa?: readonly string[];
};

/** Unidad de medida: lista de las comunes (cantidad, cm, m, kg, l…) y «Otra…» para escribir una propia. */
export function CampoUnidad({ valor, alCambiar, etiqueta = 'Unidad', error, ayuda, textoVacio, unidadesDeLaEmpresa = [] }: Props) {
  const propias = unidadesDeLaEmpresa.filter((u, i, a) => u.trim() !== '' && a.indexOf(u) === i);
  const propiaDe = (v: string) => propias.find((u) => u.toLowerCase() === v.trim().toLowerCase());
  const conocida = (v: string) => propiaDe(v) !== undefined || esUnidadConocida(v);
  const [otra, setOtra] = useState(() => valor.trim() !== '' && !conocida(valor));
  const seleccion = otra ? OTRA : (propiaDe(valor) ?? unidadConocida(valor) ?? valor);
  // Una unidad que la empresa ya ofrece no se repite en las comunes (dos opciones con el mismo valor).
  const grupos = GRUPOS_DE_UNIDADES.map((g) => ({ ...g, unidades: g.unidades.filter((u) => propiaDe(u.valor) === undefined) })).filter((g) => g.unidades.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <CampoSelect
        etiqueta={etiqueta}
        value={seleccion}
        error={otra ? undefined : error}
        ayuda={ayuda}
        onChange={(e) => {
          if (e.target.value === OTRA) { setOtra(true); alCambiar(conocida(valor) ? '' : valor); }
          else { setOtra(false); alCambiar(e.target.value); }
        }}
      >
        {textoVacio !== undefined ? <option value="">{textoVacio}</option> : null}
        {propias.length > 0 ? <optgroup label="De tu empresa">{propias.map((u) => <option key={u} value={u}>{u}</option>)}</optgroup> : null}
        {grupos.map((g) => (
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
