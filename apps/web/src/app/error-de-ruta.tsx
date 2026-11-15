import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Boton } from '../shared/ui/boton.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';

/** Pantalla de último recurso: una ruta o su cargador fallaron. */
export function ErrorDeRuta() {
  const error = useRouteError();
  const detalle =
    isRouteErrorResponse(error) ? error.statusText : error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  return (
    <EstadoVacio
      titulo="No pudimos cargar la pantalla"
      descripcion={detalle}
      icono="error"
      accion={<Boton variante="primario" onClick={() => window.location.reload()}>Reintentar</Boton>}
    />
  );
}
