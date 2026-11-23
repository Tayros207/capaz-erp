import { useId } from 'react';
import { unir } from '../../shared/ui/unir.ts';
import { OPCIONES_DE_PAGO, type ModoDePago } from './pago.ts';

type Props = {
  elegido: ModoDePago | null;
  deshabilitado: boolean;
  /** Id del texto que rotula el grupo (la pregunta «¿Cómo paga el cliente?»). */
  idDelRotulo: string;
  /** Id del error del grupo, si lo hay. */
  idDelError?: string;
  alElegir: (modo: ModoDePago) => void;
};

/** Las tres formas de pago como botones grandes (radios): la elegida muestra, debajo de su nombre, qué pasará al confirmar. */
export function OpcionesDePago({ elegido, deshabilitado, idDelRotulo, idDelError, alElegir }: Props) {
  const nombre = useId();
  return (
    <div role="radiogroup" aria-labelledby={idDelRotulo} aria-describedby={idDelError} aria-invalid={idDelError ? true : undefined} className="grid gap-2 sm:grid-cols-3">
      {OPCIONES_DE_PAGO.map((o) => {
        const activa = elegido === o.modo;
        return (
          <label
            key={o.modo}
            className={unir(
              'relative flex min-h-16 cursor-pointer flex-col justify-center gap-1 rounded-control border px-4 py-3 transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foco',
              activa ? 'border-accion bg-accion/[0.07]' : 'border-borde bg-superficie hover:border-borde-fuerte',
              deshabilitado && 'cursor-not-allowed opacity-60 hover:border-borde',
            )}
          >
            <input type="radio" name={nombre} value={o.modo} checked={activa} disabled={deshabilitado} onChange={() => alElegir(o.modo)} className="sr-only" />
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={unir('grid size-5 shrink-0 place-items-center rounded-full border-2', activa ? 'border-accion' : 'border-borde-fuerte')}>
                {activa ? <span className="size-2.5 rounded-full bg-accion" /> : null}
              </span>
              <span className="font-semibold text-texto">{o.titulo}</span>
            </span>
            {activa ? <span className="pl-7 text-sm text-texto-suave">{o.consecuencia}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
