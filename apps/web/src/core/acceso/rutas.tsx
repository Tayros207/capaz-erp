import type { RouteObject } from 'react-router';
import { PantallaIniciarSesion } from './pantalla-iniciar-sesion.tsx';
import { PantallaNuevaEmpresa } from './pantalla-nueva-empresa.tsx';
import { PantallaRegistro } from './pantalla-registro.tsx';

export const rutas: RouteObject[] = [
  { path: 'iniciar-sesion', element: <PantallaIniciarSesion /> },
  { path: 'registro', element: <PantallaRegistro /> },
  { path: 'nueva-empresa', element: <PantallaNuevaEmpresa /> },
];
