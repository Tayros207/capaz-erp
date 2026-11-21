import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-crm.ts');

// Pantallas de `crm` (FICHAS-OLA-2 §5.4). Usan el proveedor global de consultas (no crean `QueryClient`).
export const rutas: RouteObject[] = [
  { path: 'm/crm', lazy: perezosa(p, (m) => <m.PantallaTablero />) },
  { path: 'm/crm/lista', lazy: perezosa(p, (m) => <m.PantallaLista />) },
  { path: 'm/crm/oportunidades/:id', lazy: perezosa(p, (m) => <m.PantallaFichaOportunidad />) },
  { path: 'm/crm/actividades', lazy: perezosa(p, (m) => <m.PantallaActividades />) },
  { path: 'm/crm/ajustes', lazy: perezosa(p, (m) => <m.PantallaEtapas />) },
];
