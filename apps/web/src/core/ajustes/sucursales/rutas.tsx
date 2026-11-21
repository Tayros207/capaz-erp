import type { RouteObject } from 'react-router';
import { perezosa } from '../../../shared/rutas/perezosa.ts';
import { cargarSucursales } from './api.ts';

// `/ajustes/sucursales`: lista, alta, edición y «marcar principal» (herramientas sucursal_* y sucursales_listar).
// El `loader` sigue estático (corre en paralelo con la descarga de la pantalla); `lazy` solo trae el elemento.
export const rutas: RouteObject[] = [
  {
    path: 'ajustes/sucursales',
    loader: cargarSucursales,
    lazy: perezosa(() => import('./pantalla-sucursales.tsx'), (m) => <m.PantallaSucursales />),
  },
];
