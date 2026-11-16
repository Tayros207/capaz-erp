import type { RouteObject } from 'react-router';
import { PantallaDocumentoDePedido } from './pantalla-documento.tsx';
import { PantallaEntregas } from './pantalla-entregas.tsx';
import { PantallaFichaPedido } from './pantalla-ficha.tsx';
import { PantallaPedidos } from './pantalla-lista.tsx';
import { PantallaNuevoPedido } from './pantalla-nuevo.tsx';
import { PantallaTableroDePedidos } from './pantalla-tablero.tsx';

// Pedidos: lista, tablero por estado, entregas, alta y ficha. Herramientas pedido_* y pedidos_listar.
export const rutas: RouteObject[] = [
  { path: 'm/ordenes', element: <PantallaPedidos /> },
  { path: 'm/ordenes/tablero', element: <PantallaTableroDePedidos /> },
  { path: 'm/ordenes/entregas', element: <PantallaEntregas /> },
  { path: 'm/ordenes/nuevo', element: <PantallaNuevoPedido /> },
  { path: 'm/ordenes/:id/proforma', element: <PantallaDocumentoDePedido tipo="proforma" /> },
  { path: 'm/ordenes/:id/nota', element: <PantallaDocumentoDePedido tipo="nota" /> },
  { path: 'm/ordenes/:id/orden-de-trabajo', element: <PantallaDocumentoDePedido tipo="orden-de-trabajo" /> },
  { path: 'm/ordenes/:id', element: <PantallaFichaPedido /> },
];
