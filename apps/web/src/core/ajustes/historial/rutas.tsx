import type { RouteObject } from 'react-router';
import { cargarHistorial } from './cargador.ts';
import { PantallaHistorial } from './pantalla-historial.tsx';

// `/ajustes/historial`: lo que se hizo en la empresa (herramienta auditoria_listar).
export const rutas: RouteObject[] = [{ path: 'ajustes/historial', loader: cargarHistorial, element: <PantallaHistorial /> }];
