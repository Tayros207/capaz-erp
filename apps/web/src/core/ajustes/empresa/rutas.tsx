import type { RouteObject } from 'react-router';
import { cargarConfiguracion } from './cargador.ts';
import { PantallaEmpresa } from './pantalla-empresa.tsx';

// `/ajustes/empresa`: zona horaria de la empresa (herramientas empresa_ver_configuracion y empresa_actualizar_configuracion).
export const rutas: RouteObject[] = [{ path: 'ajustes/empresa', loader: cargarConfiguracion, element: <PantallaEmpresa /> }];
