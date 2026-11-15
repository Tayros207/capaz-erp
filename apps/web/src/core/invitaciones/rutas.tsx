import type { RouteObject } from 'react-router';
import { PantallaInvitacion } from './pantalla-invitacion.tsx';

// `/invitacion/:id`: la persona invitada ve la invitación y la acepta (rutas de Better Auth permitidas).
export const rutas: RouteObject[] = [{ path: 'invitacion/:id', element: <PantallaInvitacion /> }];
