import { useId } from 'react';
import { CamposDePago } from './campos-de-pago.tsx';
import { OpcionesDePago } from './opciones-de-pago.tsx';
import { PISTA_SIN_DATOS, PREGUNTA_DE_PAGO, type CuentaParaCobrar, type ErroresDePago, type PagoDeHoja } from './pago.ts';

type Props = {
  /** Con cliente y total mayor que cero; si no, el bloque se ve apagado con su pista. */
  habilitado: boolean;
  totalCentimos: number;
  hoy: string;
  pago: PagoDeHoja;
  errores: ErroresDePago;
  cuentas: readonly CuentaParaCobrar[] | null;
  cargandoCuentas: boolean;
  alCambiar: (pago: PagoDeHoja) => void;
};

/**
 * «Pago» de la hoja del pedido: ¿cómo paga el cliente? Tres opciones y solo los campos de la elegida.
 * Nada se cobra aquí: al confirmar, el pedido crea la deuda en Finanzas y anota el cobro.
 */
export function BloqueDePago({ habilitado, totalCentimos, hoy, pago, errores, cuentas, cargandoCuentas, alCambiar }: Props) {
  const id = useId();
  const idRotulo = `${id}-rotulo`;
  const idError = errores.modo ? `${id}-error` : undefined;
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3 border-t border-borde pt-6">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-titulo`} className="font-titulo font-semibold text-texto">Pago</h2>
        <p id={idRotulo} className="text-sm text-texto-suave">{PREGUNTA_DE_PAGO}</p>
      </div>
      {habilitado ? null : <p role="status" className="rounded-control border border-borde bg-superficie-alta px-3 py-2 text-sm text-texto">{PISTA_SIN_DATOS}</p>}
      <OpcionesDePago elegido={habilitado ? pago.modo : null} deshabilitado={!habilitado} idDelRotulo={idRotulo} idDelError={idError} alElegir={(modo) => alCambiar({ ...pago, modo })} />
      {errores.modo ? <p id={idError} role="alert" className="text-sm font-medium text-peligro">{errores.modo}</p> : null}
      {habilitado ? <CamposDePago pago={pago} totalCentimos={totalCentimos} hoy={hoy} errores={errores} cuentas={cuentas} cargandoCuentas={cargandoCuentas} alCambiar={alCambiar} /> : null}
    </section>
  );
}
