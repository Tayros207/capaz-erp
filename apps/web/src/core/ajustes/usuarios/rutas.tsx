import type { RouteObject } from 'react-router';
import { cargarUsuarios } from './api.ts';
import { PantallaUsuarios } from './pantalla-usuarios.tsx';

// `/ajustes/usuarios`: miembros, rol, acceso por módulo e invitaciones (herramientas miembro_* e invitacion*).
export const rutas: RouteObject[] = [{ path: 'ajustes/usuarios', loader: cargarUsuarios, element: <PantallaUsuarios /> }];
