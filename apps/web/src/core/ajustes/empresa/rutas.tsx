import type { RouteObject } from 'react-router';
import { perezosa } from '../../../shared/rutas/perezosa.ts';
import { cargarConfiguracion } from './cargador.ts';

// `/ajustes/empresa`: datos de la empresa para los documentos, logo y zona horaria (herramientas empresa_ver_configuracion y empresa_actualizar_configuracion).
// El `loader` sigue estático (corre en paralelo con la descarga de la pantalla); `lazy` solo trae el elemento.
export const rutas: RouteObject[] = [
  {
    path: 'ajustes/empresa',
    loader: cargarConfiguracion,
    lazy: perezosa(() => import('./pantalla-empresa.tsx'), (m) => <m.PantallaEmpresa />),
  },
];
