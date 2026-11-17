import type { RouteObject } from 'react-router';
import { ConConsultas } from './consultas.tsx';
import { PantallaFichaCliente } from './pantalla-ficha.tsx';
import { PantallaClientes } from './pantalla-lista.tsx';
import { PantallaRepetidos } from './pantalla-repetidos.tsx';

// `/clientes` (lista con búsqueda y alta) y `/clientes/:id` (ficha). Herramientas clientes_*.
export const rutas: RouteObject[] = [
  { path: 'clientes', element: <ConConsultas><PantallaClientes /></ConConsultas> },
  { path: 'clientes/repetidos', element: <ConConsultas><PantallaRepetidos /></ConConsultas> },
  { path: 'clientes/:id', element: <ConConsultas><PantallaFichaCliente /></ConConsultas> },
];
