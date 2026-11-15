import type { RouteObject } from 'react-router';
import { cargarSucursales } from './api.ts';
import { PantallaSucursales } from './pantalla-sucursales.tsx';

// `/ajustes/sucursales`: lista, alta, edición y «marcar principal» (herramientas sucursal_* y sucursales_listar).
export const rutas: RouteObject[] = [{ path: 'ajustes/sucursales', loader: cargarSucursales, element: <PantallaSucursales /> }];
