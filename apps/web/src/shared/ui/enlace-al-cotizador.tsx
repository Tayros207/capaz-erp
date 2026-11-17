import { Link } from 'react-router';
import { puede } from '../sesion/sesion.ts';
import { useYo } from '../sesion/use-yo.ts';

/** Enlace de la ficha de un producto a su precio en el Cotizador; solo lo ve quien puede ver el Cotizador. */
export function EnlaceAlCotizador({ productoId }: { productoId: string }) {
  const yo = useYo();
  if (!yo || !puede(yo, 'cotizador:ver')) return null;
  return (
    <Link to={`/m/cotizador/precios?producto=${productoId}`} className="inline-flex min-h-(--alto-control) items-center rounded-control px-3 font-medium text-accion underline-offset-2 hover:underline">
      Ver precio en el Cotizador
    </Link>
  );
}
