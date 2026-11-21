import type { RouteObject } from 'react-router';
import { MarcoDeCompras } from './marco-de-compras.tsx';
import { PantallaFichaCompra } from './pantalla-ficha.tsx';
import { PantallaFacturas } from './pantalla-facturas.tsx';
import { PantallaCostos } from './pantalla-costos.tsx';
import { PantallaCompras } from './pantalla-lista.tsx';
import { PantallaNuevaCompra } from './pantalla-nueva.tsx';
import { PantallaRecepcion } from './pantalla-recepcion.tsx';
import { PantallaSolicitud } from './pantalla-solicitud.tsx';
import { PantallaSolicitudes } from './pantalla-solicitudes.tsx';

// Compras, con marco propio: órdenes (lista, alta, ficha y recepción: compra_*), solicitudes de compra (solicitud_*) y
// facturas del proveedor (factura_*).
export const rutas: RouteObject[] = [
  {
    path: 'm/compras',
    element: <MarcoDeCompras />,
    children: [
      { index: true, element: <PantallaCompras /> },
      { path: 'nueva', element: <PantallaNuevaCompra /> },
      { path: 'solicitudes', element: <PantallaSolicitudes /> },
      { path: 'solicitudes/:id', element: <PantallaSolicitud /> },
      { path: 'facturas', element: <PantallaFacturas /> },
      { path: 'costos', element: <PantallaCostos /> },
      { path: ':id', element: <PantallaFichaCompra /> },
      { path: ':id/recibir', element: <PantallaRecepcion /> },
    ],
  },
];
