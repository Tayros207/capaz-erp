import type { RouteObject } from 'react-router';
import { PantallaPreciosSegunDireccion } from './pantalla-precios.tsx';

// `/precios`: «¿Cuánto le cobramos?». Herramienta precio_anterior_consultar; el dictado y la paleta abren esta pantalla con
// `?cliente=…&q=…` cuando reconocen la pregunta, y la ficha del cliente con `?clienteId=…` (sus últimos precios).
export const rutas: RouteObject[] = [{ path: 'precios', element: <PantallaPreciosSegunDireccion /> }];
