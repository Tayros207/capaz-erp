import { unir } from '../../../shared/ui/unir.ts';
import { PESTANAS, type Pestana } from './logica-cuadro.ts';

/** Las tres columnas del cuadro como pestañas, solo en pantallas angostas (desde 1.280 px se ven las tres a la vez). */
export function PestanasDelCuadro({ activa, alCambiar }: { activa: Pestana; alCambiar: (p: Pestana) => void }) {
  return (
    <div role="tablist" aria-label="Partes del cuadro" className="flex border-b border-borde-fuerte xl:hidden">
      {PESTANAS.map((p) => (
        <button
          key={p.id} type="button" role="tab" aria-selected={activa === p.id} aria-controls={`parte-${p.id}`} id={`pestana-${p.id}`} onClick={() => alCambiar(p.id)}
          className={unir('-mb-px min-h-(--alto-control) flex-1 cursor-pointer border-b-2 px-3 font-medium', activa === p.id ? 'border-accion text-texto' : 'border-transparent text-texto-suave hover:text-texto')}
        >
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}
