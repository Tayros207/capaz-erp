import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

// `/invitacion/:id`: la persona invitada ve la invitación y la acepta (rutas de Better Auth permitidas).
export const rutas: RouteObject[] = [
  { path: 'invitacion/:id', lazy: perezosa(() => import('./pantalla-invitacion.tsx'), (m) => <m.PantallaInvitacion />) },
];
