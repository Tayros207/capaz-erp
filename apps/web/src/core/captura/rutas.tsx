import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

// `/dictar`: captura por voz y texto. Herramienta captura_proponer; los borradores se aprueban desde la propia pantalla.
export const rutas: RouteObject[] = [
  { path: 'dictar', lazy: perezosa(() => import('./pantalla-dictado.tsx'), (m) => <m.PantallaDictado />) },
];
