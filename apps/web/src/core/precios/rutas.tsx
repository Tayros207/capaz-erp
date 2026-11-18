import type { RouteObject } from 'react-router';
import { PantallaPrecios } from './pantalla-precios.tsx';

// `/precios`: «¿Cuánto le cobramos?». Herramienta precio_anterior_consultar; el dictado y la paleta abren esta pantalla con
// `?cliente=…&q=…` cuando reconocen la pregunta.
export const rutas: RouteObject[] = [{ path: 'precios', element: <PantallaPrecios /> }];
