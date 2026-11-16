import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { MarcoDeInventario } from './marco.tsx';
import { PantallaAlertas } from './pantalla-alertas.tsx';
import { PantallaArticulo } from './pantalla-articulo.tsx';
import { PantallaExistencias } from './pantalla-existencias.tsx';
import { PantallaMovimientos } from './pantalla-movimientos.tsx';

// Pantallas de «insumos» (Inventario), bajo `m/insumos/…` con marco propio (FICHAS-OLA-3 §2).
export const rutas: RouteObject[] = [
  {
    path: 'm/insumos',
    element: <MarcoDeInventario />,
    children: [
      { index: true, element: <PantallaExistencias /> },
      { path: 'alertas', element: <PantallaAlertas /> },
      { path: 'movimientos', element: <PantallaMovimientos /> },
      { path: 'articulos/:id', element: <PantallaArticulo /> },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="caja" /> },
    ],
  },
];
