import type { RouteObject } from 'react-router';
import { ConConsultas } from './consultas.tsx';
import { PantallaConecta } from './pantalla-conecta.tsx';

// `/ajustes/conecta`: conectores, claves de API, webhooks de salida e importar y exportar. Herramientas conexion*, clave_api*, webhook*, *_csv.
export const rutas: RouteObject[] = [
  { path: 'ajustes/conecta', element: <ConConsultas><PantallaConecta /></ConConsultas> },
];
