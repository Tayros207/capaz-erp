import type { RouteObject } from 'react-router';
import { perezosa } from '../../../shared/rutas/perezosa.ts';
import { cargarHistorial } from './cargador.ts';

// `/ajustes/historial`: lo que se hizo en la empresa (herramienta auditoria_listar).
// El `loader` sigue estático (corre en paralelo con la descarga de la pantalla); `lazy` solo trae el elemento.
export const rutas: RouteObject[] = [
  {
    path: 'ajustes/historial',
    loader: cargarHistorial,
    lazy: perezosa(() => import('./pantalla-historial.tsx'), (m) => <m.PantallaHistorial />),
  },
];
