import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

// `/ajustes/conecta`: conectores, claves de API, webhooks de salida e importar y exportar. Herramientas conexion*, clave_api*, webhook*, *_csv.
export const rutas: RouteObject[] = [
  {
    path: 'ajustes/conecta',
    lazy: perezosa(() => import('./pantallas-de-conecta.ts'), (m) => <m.ConConsultas><m.PantallaConecta /></m.ConConsultas>),
  },
];
