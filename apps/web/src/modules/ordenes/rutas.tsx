import type { RouteObject } from 'react-router';
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
  { path: 'm/ordenes/:id', element: <PantallaFichaPedido /> },
];
