import { centimosSchema, type Centimos } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Cifra, type TonoDeCifra } from '../../shared/ui/cifra.tsx';
import { ETIQUETA_DE_MEDIO, type MedioDePago } from './adelanto.ts';
import { cuentaDeCobro, montoDePago, saldoDePago, type CuentaParaCobrar, type ErroresDePago, type PagoDeHoja } from './pago.ts';

type Props = {
  pago: PagoDeHoja;
  totalCentimos: number;
  /** Hoy en la empresa: el vencimiento no puede ser anterior. */
  hoy: string;
  errores: ErroresDePago;
  /** `null` mientras no se sabe (cargando o no se pudo leer). */
  cuentas: readonly CuentaParaCobrar[] | null;
  cargandoCuentas: boolean;
  alCambiar: (pago: PagoDeHoja) => void;
};

function CampoDeCuenta({ pago, errores, cuentas, cargandoCuentas, alCambiar }: Pick<Props, 'pago' | 'errores' | 'cuentas' | 'cargandoCuentas' | 'alCambiar'>) {
  const elegida = cuentaDeCobro(pago.cuentaId, cuentas);
  const ayuda = cuentas === null && !cargandoCuentas ? 'No pudimos leer tus cuentas: el dinero entrará en la cuenta principal.' : undefined;
  return (
    <CampoSelect
      etiqueta="Cuenta donde entra"
      value={elegida ?? ''}
      disabled={cuentas === null || cuentas.length === 0}
      error={errores.cuenta}
      ayuda={ayuda}
      onChange={(e) => alCambiar({ ...pago, cuentaId: e.target.value || null })}
    >
      {cuentas === null ? <option value="">{cargandoCuentas ? 'Cargando cuentas…' : 'Cuenta principal'}</option> : null}
      {cuentas !== null && elegida === null ? <option value="" disabled>{cuentas.length === 0 ? 'Sin cuentas' : 'Elige una cuenta'}</option> : null}
      {(cuentas ?? []).map((c) => <option key={c.id} value={c.id}>{c.esPrincipal ? `${c.nombre} (principal)` : c.nombre}</option>)}
    </CampoSelect>
  );
}

function CampoDeMonto({ pago, totalCentimos, errores, alCambiar }: Pick<Props, 'pago' | 'totalCentimos' | 'errores' | 'alCambiar'>) {
  if (pago.modo === 'todo') {
    // Es el total del pedido: se ve, no se edita.
    return <CampoMonto etiqueta="Monto cobrado" valor={centimosSchema.parse(totalCentimos)} alCambiar={() => undefined} readOnly aria-readonly="true" className="bg-superficie-alta" ayuda="Es el total del pedido." />;
  }
  const monto = montoDePago(pago, totalCentimos);
  return (
    <CampoMonto
      etiqueta="Monto del adelanto"
      valor={monto === null ? null : centimosSchema.parse(monto)}
      alCambiar={(v: Centimos | null) => alCambiar({ ...pago, tocado: true, montoCentimos: v })}
      error={errores.monto}
      ayuda={`Sugerido: el 50 % de ${formatearSoles(totalCentimos)}.`}
    />
  );
}

const tonoDelSaldo = (modo: PagoDeHoja['modo'], saldo: number | null): TonoDeCifra => (saldo === null ? 'neutro' : modo === 'todo' ? 'exito' : 'aviso');

/** Los campos que pide cada opción, y el saldo por cobrar siempre a la vista. */
export function CamposDePago({ pago, totalCentimos, hoy, errores, cuentas, cargandoCuentas, alCambiar }: Props) {
  if (!pago.modo) return null;
  const saldo = saldoDePago(pago, totalCentimos);
  const cobraHoy = pago.modo !== 'ninguno';
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cobraHoy ? (
        <>
          <CampoDeMonto pago={pago} totalCentimos={totalCentimos} errores={errores} alCambiar={alCambiar} />
          <CampoSelect etiqueta="Método de pago" value={pago.medio} onChange={(e) => alCambiar({ ...pago, medio: e.target.value as MedioDePago })}>
            {(Object.keys(ETIQUETA_DE_MEDIO) as MedioDePago[]).map((m) => <option key={m} value={m}>{ETIQUETA_DE_MEDIO[m]}</option>)}
          </CampoSelect>
          <CampoDeCuenta pago={pago} errores={errores} cuentas={cuentas} cargandoCuentas={cargandoCuentas} alCambiar={alCambiar} />
        </>
      ) : null}
      {pago.modo === 'todo' ? null : (
        <Campo etiqueta={pago.modo === 'adelanto' ? 'Vence el saldo' : 'Vence el cobro'} type="date" min={hoy} value={pago.venceEn} error={errores.venceEn} ayuda="Opcional." onChange={(e) => alCambiar({ ...pago, venceEn: e.target.value })} />
      )}
      <Cifra etiqueta="Saldo por cobrar" valor={saldo === null ? '—' : formatearSoles(saldo)} tono={tonoDelSaldo(pago.modo, saldo)} />
    </div>
  );
}
