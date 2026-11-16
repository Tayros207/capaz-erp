import { Navigate, type RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { MarcoDeRegistro } from './marco.tsx';
import { PantallaAjustes } from './pantalla-ajustes.tsx';
import { PantallaCaja } from './pantalla-caja.tsx';
import { PantallaDeuda } from './pantalla-deuda.tsx';
import { PantallaDeudas } from './pantalla-deudas.tsx';
import { PantallaMovimiento } from './pantalla-movimiento.tsx';
import { PantallaMovimientos } from './pantalla-movimientos.tsx';

// Pantallas de «registro» (Finanzas ligeras), bajo `m/registro/…` con marco propio (ficha §4.7).
export const rutas: RouteObject[] = [
  {
    path: 'm/registro',
    element: <MarcoDeRegistro />,
    children: [
      { index: true, element: <Navigate to="movimientos" replace /> },
      { path: 'movimientos', element: <PantallaMovimientos /> },
      { path: 'movimientos/:id', element: <PantallaMovimiento /> },
      { path: 'por-cobrar', element: <PantallaDeudas tipo="por_cobrar" /> },
      { path: 'por-pagar', element: <PantallaDeudas tipo="por_pagar" /> },
      { path: 'deudas/:id', element: <PantallaDeuda /> },
      { path: 'caja', element: <PantallaCaja /> },
      { path: 'ajustes', element: <PantallaAjustes /> },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="caja" /> },
    ],
  },
];
