import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-ordenes.ts');

// Pedidos: lista, tablero por estado, entregas, guías de remisión, alta y ficha. Las rutas de guías van antes de `:id`. Herramientas pedido_* y pedidos_listar.
export const rutas: RouteObject[] = [
  { path: 'm/ordenes', lazy: perezosa(p, (m) => <m.PantallaPedidos />) },
  { path: 'm/ordenes/tablero', lazy: perezosa(p, (m) => <m.PantallaTableroDePedidos />) },
  { path: 'm/ordenes/entregas', lazy: perezosa(p, (m) => <m.PantallaEntregas />) },
  { path: 'm/ordenes/nuevo', lazy: perezosa(p, (m) => <m.PantallaNuevoPedido />) },
  { path: 'm/ordenes/correcciones', lazy: perezosa(p, (m) => <m.PantallaCorrecciones />) },
  { path: 'm/ordenes/importar-historial', lazy: perezosa(p, (m) => <m.PantallaImportarHistorial />) },
  { path: 'm/ordenes/guias', lazy: perezosa(p, (m) => <m.PantallaGuias />) },
  { path: 'm/ordenes/guias/nueva', lazy: perezosa(p, (m) => <m.PantallaNuevaGuia />) },
  { path: 'm/ordenes/guias/:guiaId', lazy: perezosa(p, (m) => <m.PantallaGuia />) },
  { path: 'm/ordenes/:id/proforma', lazy: perezosa(p, (m) => <m.PantallaDocumentoDePedido tipo="proforma" />) },
  { path: 'm/ordenes/:id/nota', lazy: perezosa(p, (m) => <m.PantallaDocumentoDePedido tipo="nota" />) },
  { path: 'm/ordenes/:id/orden-de-trabajo', lazy: perezosa(p, (m) => <m.PantallaDocumentoDePedido tipo="orden-de-trabajo" />) },
  { path: 'm/ordenes/:id/guia-de-remision', lazy: perezosa(p, (m) => <m.RedirigirAGuiaNueva />) },
  { path: 'm/ordenes/:id', lazy: perezosa(p, (m) => <m.PantallaFichaPedido />) },
];
