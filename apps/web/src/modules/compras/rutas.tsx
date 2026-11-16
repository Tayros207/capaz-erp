import type { RouteObject } from 'react-router';
import { PantallaFichaCompra } from './pantalla-ficha.tsx';
import { PantallaCompras } from './pantalla-lista.tsx';
import { PantallaNuevaCompra } from './pantalla-nueva.tsx';
import { PantallaRecepcion } from './pantalla-recepcion.tsx';

// Compras: lista, alta, ficha y recepción. Herramientas compra_*, compras_listar.
export const rutas: RouteObject[] = [
  { path: 'm/compras', element: <PantallaCompras /> },
  { path: 'm/compras/nueva', element: <PantallaNuevaCompra /> },
  { path: 'm/compras/:id', element: <PantallaFichaCompra /> },
  { path: 'm/compras/:id/recibir', element: <PantallaRecepcion /> },
];
