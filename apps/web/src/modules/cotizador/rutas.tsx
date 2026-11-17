import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { PantallaAjustes } from './pantalla-ajustes.tsx';
import { PantallaPrecios } from './pantalla-precios.tsx';
import { PantallaRapida } from './pantalla-rapida.tsx';

// Cotizador: cotización rápida, lista de precios y ajustes (sesión A). Las rutas de cotizaciones (lista, ficha y
// documento) las agrega la sesión B; mientras tanto `m/cotizador/cotizaciones/*` muestra un marcador.
export const rutas: RouteObject[] = [
  { path: 'm/cotizador', element: <PantallaRapida /> },
  { path: 'm/cotizador/precios', element: <PantallaPrecios /> },
  { path: 'm/cotizador/ajustes', element: <PantallaAjustes /> },
  { path: 'm/cotizador/cotizaciones/*', element: <EstadoVacio titulo="En construcción" descripcion="Las cotizaciones guardadas todavía no están disponibles." icono="caja" /> },
];
