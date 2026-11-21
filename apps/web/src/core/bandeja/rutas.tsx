import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-bandeja.ts');

// `/bandeja` (lista de borradores) y `/bandeja/:id` (revisar uno). Herramientas borrador_*.
export const rutas: RouteObject[] = [
  { path: 'bandeja', lazy: perezosa(p, (m) => <m.PantallaBandeja />) },
  { path: 'bandeja/:id', lazy: perezosa(p, (m) => <m.PantallaBorrador />) },
];
