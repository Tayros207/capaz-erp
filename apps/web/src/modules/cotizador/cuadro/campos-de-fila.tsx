import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { ESCALAS, FACTORES, type Escala, type Factor } from '../logica-taller.ts';
import type { ErroresDeFila, FormularioDeFila } from './logica-cuadro-filas.ts';

type Props = { f: FormularioDeFila; errores: ErroresDeFila; cambiar: (parcial: Partial<FormularioDeFila>) => void; conCosto: boolean; conDescripcion: boolean; conFactor: boolean };

/** Los campos de una fila del cuadro: se usan al escribirla a mano y al editarla. */
export function CamposDeFila({ f, errores, cambiar, conCosto, conDescripcion, conFactor }: Props) {
  return (
    <>
      {conFactor ? (
        <CampoSelect etiqueta="Factor" value={f.factor} onChange={(e) => cambiar({ factor: e.target.value as Factor })}>
          {FACTORES.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
        </CampoSelect>
      ) : null}
      {conDescripcion ? <Campo etiqueta="Descripción" maxLength={120} value={f.descripcion} error={errores.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Cantidad" inputMode="decimal" value={f.cantidad} error={errores.cantidad} onChange={(e) => cambiar({ cantidad: e.target.value })} />
        {conDescripcion ? <Campo etiqueta="Unidad" maxLength={20} value={f.unidad} error={errores.unidad} onChange={(e) => cambiar({ unidad: e.target.value })} /> : null}
        {conCosto && conDescripcion ? <Campo etiqueta="Costo unitario (S/)" inputMode="decimal" value={f.costoUnitario} error={errores.costoUnitario} onChange={(e) => cambiar({ costoUnitario: e.target.value })} /> : null}
        {conDescripcion ? (
          <CampoSelect etiqueta="Escala" value={f.escala} onChange={(e) => cambiar({ escala: e.target.value as Escala })}>
            {ESCALAS.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
          </CampoSelect>
        ) : null}
      </div>
    </>
  );
}
