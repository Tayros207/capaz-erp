import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

// Reportes: indicadores por período con exportación a CSV. Herramientas reportes_panel y reportes_exportar_csv.
export const rutas: RouteObject[] = [
  { path: 'm/reportes', lazy: perezosa(() => import('./pantalla-indicadores.tsx'), (m) => <m.PantallaIndicadores />) },
];
