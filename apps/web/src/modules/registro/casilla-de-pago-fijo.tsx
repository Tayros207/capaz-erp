import { useId } from 'react';

type Props = { marcado: boolean; alCambiar: (marcado: boolean) => void };

/** Casilla «pago fijo» de las deudas por pagar: el alquiler, la luz u otro gasto que se repite cada mes. */
export function CasillaDePagoFijo({ marcado, alCambiar }: Props) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={marcado} onChange={(e) => alCambiar(e.target.checked)} aria-describedby={`${id}-ayuda`} className="mt-1 size-5 shrink-0 cursor-pointer accent-accion" />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer font-medium text-texto">Es un pago fijo de cada mes</label>
        <p id={`${id}-ayuda`} className="text-sm text-texto-suave">Después podrás copiarlo al mes siguiente con un solo botón.</p>
      </div>
    </div>
  );
}
