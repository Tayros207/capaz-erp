import type { RouteObject } from 'react-router';
import { PantallaDictado } from './pantalla-dictado.tsx';

// `/dictar`: captura por voz y texto. Herramienta captura_proponer; los borradores se aprueban desde la propia pantalla.
export const rutas: RouteObject[] = [{ path: 'dictar', element: <PantallaDictado /> }];
