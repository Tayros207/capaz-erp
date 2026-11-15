import { ENTIDADES_DE_INTERCAMBIO, type EntidadDeIntercambio } from '@capaz/shared';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { ETIQUETA_DE_ENTIDAD } from './logica.ts';

export type Separador = ',' | ';';

export function SelectorDeEntidad({ valor, alCambiar }: { valor: EntidadDeIntercambio; alCambiar: (e: EntidadDeIntercambio) => void }) {
  return (
    <CampoSelect etiqueta="Qué datos" value={valor} onChange={(e) => alCambiar(e.target.value as EntidadDeIntercambio)}>
      {ENTIDADES_DE_INTERCAMBIO.map((e) => <option key={e} value={e}>{ETIQUETA_DE_ENTIDAD[e]}</option>)}
    </CampoSelect>
  );
}
