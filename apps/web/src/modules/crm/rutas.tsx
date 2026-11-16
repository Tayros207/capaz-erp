import type { RouteObject } from 'react-router';
import { PantallaActividades } from './pantalla-actividades.tsx';
import { PantallaEtapas } from './pantalla-etapas.tsx';
import { PantallaFichaOportunidad } from './pantalla-ficha.tsx';
import { PantallaLista } from './pantalla-lista.tsx';
import { PantallaTablero } from './pantalla-tablero.tsx';

// Pantallas de `crm` (FICHAS-OLA-2 §5.4). Usan el proveedor global de consultas (no crean `QueryClient`).
export const rutas: RouteObject[] = [
  { path: 'm/crm', element: <PantallaTablero /> },
  { path: 'm/crm/lista', element: <PantallaLista /> },
  { path: 'm/crm/oportunidades/:id', element: <PantallaFichaOportunidad /> },
  { path: 'm/crm/actividades', element: <PantallaActividades /> },
  { path: 'm/crm/ajustes', element: <PantallaEtapas /> },
];
