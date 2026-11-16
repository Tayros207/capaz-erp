import type { RouteObject } from 'react-router';
import { PantallaIniciarSesion } from './pantalla-iniciar-sesion.tsx';
import { PantallaNuevaEmpresa } from './pantalla-nueva-empresa.tsx';
import { PantallaRestablecerContrasena } from './pantalla-restablecer-contrasena.tsx';
import { PantallaRegistro } from './pantalla-registro.tsx';

export const rutas: RouteObject[] = [
  { path: 'iniciar-sesion', element: <PantallaIniciarSesion /> },
  { path: 'registro', element: <PantallaRegistro /> },
  { path: 'restablecer-contrasena', element: <PantallaRestablecerContrasena /> },
  { path: 'nueva-empresa', element: <PantallaNuevaEmpresa /> },
];
