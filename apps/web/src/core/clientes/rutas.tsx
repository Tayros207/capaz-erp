import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-clientes.ts');

// `/clientes` (lista con búsqueda y alta) y `/clientes/:id` (ficha). Herramientas clientes_*.
export const rutas: RouteObject[] = [
  { path: 'clientes', lazy: perezosa(p, (m) => <m.PantallaClientes />) },
  { path: 'clientes/repetidos', lazy: perezosa(p, (m) => <m.PantallaRepetidos />) },
  { path: 'clientes/:id', lazy: perezosa(p, (m) => <m.PantallaFichaCliente />) },
];
