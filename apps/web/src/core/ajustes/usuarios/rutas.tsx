import type { RouteObject } from 'react-router';
import { perezosa } from '../../../shared/rutas/perezosa.ts';
import { cargarUsuarios } from './api.ts';

// `/ajustes/usuarios`: miembros, rol, acceso por módulo e invitaciones (herramientas miembro_* e invitacion*).
// El `loader` sigue estático (corre en paralelo con la descarga de la pantalla); `lazy` solo trae el elemento.
export const rutas: RouteObject[] = [
  {
    path: 'ajustes/usuarios',
    loader: cargarUsuarios,
    lazy: perezosa(() => import('./pantalla-usuarios.tsx'), (m) => <m.PantallaUsuarios />),
  },
];
