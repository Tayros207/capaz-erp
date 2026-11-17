import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { MarcoDeProduccion } from './marco.tsx';
import { PantallaOrden } from './pantalla-orden.tsx';
import { PantallaOrdenes } from './pantalla-ordenes.tsx';

// Pantallas de «produccion» (órdenes de trabajo del taller), bajo `m/produccion/…` con marco propio, como Registro.
export const rutas: RouteObject[] = [
  {
    path: 'm/produccion',
    element: <MarcoDeProduccion />,
    children: [
      { index: true, element: <PantallaOrdenes /> },
      { path: ':id', element: <PantallaOrden /> },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="caja" /> },
    ],
  },
];
