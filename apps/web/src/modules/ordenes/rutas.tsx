import type { RouteObject } from 'react-router';
import { PantallaDocumentoDePedido } from './pantalla-documento.tsx';
import { PantallaGuia } from './pantalla-guia.tsx';
import { PantallaGuias } from './pantalla-guias.tsx';
import { PantallaNuevaGuia, RedirigirAGuiaNueva } from './pantalla-guia-nueva.tsx';
import { PantallaCorrecciones } from './pantalla-correcciones.tsx';
import { PantallaEntregas } from './pantalla-entregas.tsx';
import { PantallaImportarHistorial } from './pantalla-importar-historial.tsx';
import { PantallaFichaPedido } from './pantalla-ficha.tsx';
import { PantallaPedidos } from './pantalla-lista.tsx';
import { PantallaNuevoPedido } from './pantalla-nuevo.tsx';
import { PantallaTableroDePedidos } from './pantalla-tablero.tsx';

// Pedidos: lista, tablero por estado, entregas, guías de remisión, alta y ficha. Las rutas de guías van antes de `:id`. Herramientas pedido_* y pedidos_listar.
export const rutas: RouteObject[] = [
  { path: 'm/ordenes', element: <PantallaPedidos /> },
  { path: 'm/ordenes/tablero', element: <PantallaTableroDePedidos /> },
  { path: 'm/ordenes/entregas', element: <PantallaEntregas /> },
  { path: 'm/ordenes/nuevo', element: <PantallaNuevoPedido /> },
  { path: 'm/ordenes/correcciones', element: <PantallaCorrecciones /> },
  { path: 'm/ordenes/importar-historial', element: <PantallaImportarHistorial /> },
  { path: 'm/ordenes/guias', element: <PantallaGuias /> },
  { path: 'm/ordenes/guias/nueva', element: <PantallaNuevaGuia /> },
  { path: 'm/ordenes/guias/:guiaId', element: <PantallaGuia /> },
  { path: 'm/ordenes/:id/proforma', element: <PantallaDocumentoDePedido tipo="proforma" /> },
  { path: 'm/ordenes/:id/nota', element: <PantallaDocumentoDePedido tipo="nota" /> },
  { path: 'm/ordenes/:id/orden-de-trabajo', element: <PantallaDocumentoDePedido tipo="orden-de-trabajo" /> },
  { path: 'm/ordenes/:id/guia-de-remision', element: <RedirigirAGuiaNueva /> },
  { path: 'm/ordenes/:id', element: <PantallaFichaPedido /> },
];
