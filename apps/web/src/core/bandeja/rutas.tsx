import type { RouteObject } from 'react-router';
import { PantallaBorrador } from './pantalla-borrador.tsx';
import { PantallaBandeja } from './pantalla-bandeja.tsx';

// `/bandeja` (lista de borradores) y `/bandeja/:id` (revisar uno). Herramientas borrador_*.
export const rutas: RouteObject[] = [
  { path: 'bandeja', element: <PantallaBandeja /> },
  { path: 'bandeja/:id', element: <PantallaBorrador /> },
];
