import type { RouteObject } from 'react-router';
import { PantallaFichaCliente } from './pantalla-ficha.tsx';
import { PantallaClientes } from './pantalla-lista.tsx';
import { PantallaRepetidos } from './pantalla-repetidos.tsx';

// `/clientes` (lista con búsqueda y alta) y `/clientes/:id` (ficha). Herramientas clientes_*.
export const rutas: RouteObject[] = [
  { path: 'clientes', element: <PantallaClientes /> },
  { path: 'clientes/repetidos', element: <PantallaRepetidos /> },
  { path: 'clientes/:id', element: <PantallaFichaCliente /> },
];
