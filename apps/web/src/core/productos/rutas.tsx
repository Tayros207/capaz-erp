import type { RouteObject } from 'react-router';
import { ConConsultas } from './consultas.tsx';
import { PantallaFichaProducto } from './pantalla-ficha.tsx';
import { PantallaProductos } from './pantalla-lista.tsx';

// `/productos` (lista con búsqueda y alta) y `/productos/:id` (ficha). Herramientas productos_*.
export const rutas: RouteObject[] = [
  { path: 'productos', element: <ConConsultas><PantallaProductos /></ConConsultas> },
  { path: 'productos/:id', element: <ConConsultas><PantallaFichaProducto /></ConConsultas> },
];
