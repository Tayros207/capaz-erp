import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-compras.ts');

// Compras, con marco propio: órdenes (lista, alta, ficha y recepción: compra_*), solicitudes de compra (solicitud_*) y
// facturas del proveedor (factura_*).
export const rutas: RouteObject[] = [
  {
    path: 'm/compras',
    lazy: perezosa(p, (m) => <m.MarcoDeCompras />),
    children: [
      { index: true, lazy: perezosa(p, (m) => <m.PantallaCompras />) },
      { path: 'nueva', lazy: perezosa(p, (m) => <m.PantallaNuevaCompra />) },
      { path: 'solicitudes', lazy: perezosa(p, (m) => <m.PantallaSolicitudes />) },
      { path: 'solicitudes/:id', lazy: perezosa(p, (m) => <m.PantallaSolicitud />) },
      { path: 'facturas', lazy: perezosa(p, (m) => <m.PantallaFacturas />) },
      { path: 'costos', lazy: perezosa(p, (m) => <m.PantallaCostos />) },
      { path: ':id', lazy: perezosa(p, (m) => <m.PantallaFichaCompra />) },
      { path: ':id/recibir', lazy: perezosa(p, (m) => <m.PantallaRecepcion />) },
    ],
  },
];
