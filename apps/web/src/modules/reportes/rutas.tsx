import type { RouteObject } from 'react-router';
import { PantallaIndicadores } from './pantalla-indicadores.tsx';

// Reportes: indicadores por período con exportación a CSV. Herramientas reportes_panel y reportes_exportar_csv.
export const rutas: RouteObject[] = [{ path: 'm/reportes', element: <PantallaIndicadores /> }];
