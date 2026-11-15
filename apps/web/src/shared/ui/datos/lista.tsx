import { CampoSelect } from '../campo-select.tsx';
import { EstadoVacio } from '../estado-vacio.tsx';
import { ListaTabla } from './lista-tabla.tsx';
import { ListaTarjetas } from './lista-tarjetas.tsx';
import type { PropsDeLista } from './lista-tipos.ts';
import type { Orden } from './logica-lista.ts';

const SIN_ORDEN = '';

/** Lista de filas tipadas: tabla desde 640 px, tarjetas por debajo. El orden y la selección los controla quien la usa. */
export function Lista<T>(props: PropsDeLista<T>) {
  const { columnas, filas, orden = null, onOrden, vacio } = props;
  if (filas.length === 0) return <>{vacio ?? <EstadoVacio titulo="Sin resultados" descripcion="No hay nada que mostrar todavía." />}</>;

  const ordenables = columnas.filter((c) => c.valorDeOrden);
  const valor = orden ? `${orden.columna}|${orden.direccion}` : SIN_ORDEN;
  const alElegir = (v: string) => {
    const [columna, direccion] = v.split('|');
    onOrden?.(columna ? ({ columna, direccion } as Orden) : null);
  };

  return (
    <div className="flex flex-col gap-2">
      {onOrden && ordenables.length ? (
        <div className="sm:hidden">
          <CampoSelect etiqueta="Ordenar por" value={valor} onChange={(e) => alElegir(e.target.value)}>
            <option value={SIN_ORDEN}>Sin orden</option>
            {ordenables.flatMap((c) => [
              <option key={`${c.id}a`} value={`${c.id}|asc`}>{`${c.titulo} (ascendente)`}</option>,
              <option key={`${c.id}d`} value={`${c.id}|desc`}>{`${c.titulo} (descendente)`}</option>,
            ])}
          </CampoSelect>
        </div>
      ) : null}
      <ListaTabla {...props} />
      <ListaTarjetas {...props} />
    </div>
  );
}
