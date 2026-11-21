import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-productos.ts');

// `/productos` (lista con búsqueda y alta) y `/productos/:id` (ficha). Herramientas productos_*.
export const rutas: RouteObject[] = [
  { path: 'productos', lazy: perezosa(p, (m) => <m.ConConsultas><m.PantallaProductos /></m.ConConsultas>) },
  { path: 'productos/:id', lazy: perezosa(p, (m) => <m.ConConsultas><m.PantallaFichaProducto /></m.ConConsultas>) },
];
