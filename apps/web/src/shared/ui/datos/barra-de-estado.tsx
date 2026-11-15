import { Icono } from '../icono.tsx';
import { unir } from '../unir.ts';
import { estadoDePaso } from './logica-navegacion.ts';

type Props = {
  /** Pasos en orden, p. ej. «Borrador», «Confirmado», «Entregado». */
  pasos: string[];
  /** Índice del paso en que está el documento. */
  actual: number;
  etiqueta?: string;
};

export function BarraDeEstado({ pasos, actual, etiqueta = 'Estado del documento' }: Props) {
  return (
    <nav aria-label={etiqueta}>
      <ol className="flex flex-wrap gap-x-1 gap-y-2">
        {pasos.map((paso, i) => {
          const estado = estadoDePaso(i, actual);
          return (
            <li
              key={paso}
              aria-current={estado === 'actual' ? 'step' : undefined}
              className={unir(
                'flex min-h-9 items-center gap-1.5 rounded-control border px-3 text-sm',
                estado === 'actual' && 'border-accion bg-accion font-semibold text-accion-texto',
                estado === 'hecho' && 'border-borde-fuerte bg-superficie-alta text-texto',
                estado === 'pendiente' && 'border-borde bg-superficie text-texto-suave',
              )}
            >
              {estado === 'hecho' ? <Icono nombre="check" className="size-4 text-exito" /> : null}
              {paso}
              <span className="sr-only">{estado === 'hecho' ? ' (hecho)' : estado === 'actual' ? ' (paso actual)' : ' (pendiente)'}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
