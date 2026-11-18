import { centimosSchema, type Centimos } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Cifra } from '../../shared/ui/cifra.tsx';
import { ETIQUETA_DE_MEDIO, montoDeAdelanto, validarAdelanto, type AdelantoDeHoja, type MedioDePago } from './adelanto.ts';

type Props = {
  totalCentimos: number;
  adelanto: AdelantoDeHoja;
  alCambiar: (a: AdelantoDeHoja) => void;
};

/** El adelanto dentro de la hoja del pedido: casilla, monto (50 % sugerido que sigue al total mientras nadie lo toque), medio y saldo. */
export function BloqueAdelanto({ totalCentimos, adelanto, alCambiar }: Props) {
  const monto = montoDeAdelanto(adelanto, totalCentimos);
  const falla = adelanto.cobrar ? validarAdelanto(monto, totalCentimos) : null;
  const saldo = monto !== null && !validarAdelanto(monto, totalCentimos) ? totalCentimos - monto : null;
  return (
    <section aria-label="Adelanto" className="flex flex-col gap-3">
      <h2 className="font-titulo font-semibold text-texto">Adelanto</h2>
      <label className="flex min-h-(--alto-control) cursor-pointer items-center gap-3">
        <input type="checkbox" checked={adelanto.cobrar} onChange={(e) => alCambiar({ ...adelanto, cobrar: e.target.checked })} className="size-5 cursor-pointer accent-accion" />
        <span className="font-medium text-texto">El cliente deja adelanto</span>
      </label>
      {adelanto.cobrar ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoMonto
            etiqueta="Monto del adelanto"
            valor={monto === null ? null : centimosSchema.parse(monto)}
            alCambiar={(v: Centimos | null) => alCambiar({ ...adelanto, tocado: true, montoCentimos: v })}
            error={falla ?? undefined}
            ayuda={`Sugerido: el 50 % de ${formatearSoles(totalCentimos)}.`}
          />
          <CampoSelect etiqueta="Medio de pago" value={adelanto.medio} onChange={(e) => alCambiar({ ...adelanto, medio: e.target.value as MedioDePago })}>
            {(Object.keys(ETIQUETA_DE_MEDIO) as MedioDePago[]).map((m) => <option key={m} value={m}>{ETIQUETA_DE_MEDIO[m]}</option>)}
          </CampoSelect>
          <Cifra etiqueta="Saldo por cobrar" valor={saldo === null ? '—' : formatearSoles(saldo)} />
        </div>
      ) : null}
    </section>
  );
}
