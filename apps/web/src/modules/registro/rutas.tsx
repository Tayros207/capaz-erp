import { Navigate, type RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { MarcoDeRegistro } from './marco.tsx';
import { PantallaMovimiento } from './pantalla-movimiento.tsx';
import { PantallaMovimientos } from './pantalla-movimientos.tsx';

// Pantallas de «registro» (Finanzas ligeras), bajo `m/registro/…` con marco propio (ficha §4.7).
// Hechas: movimientos, alta en hoja y ficha de movimiento. Pendientes (marcador): las demás secciones.
const pendiente = <EstadoVacio titulo="En construcción" descripcion="Esta pantalla todavía no está disponible." icono="caja" />;

export const rutas: RouteObject[] = [
  {
    path: 'm/registro',
    element: <MarcoDeRegistro />,
    children: [
      { index: true, element: <Navigate to="movimientos" replace /> },
      { path: 'movimientos', element: <PantallaMovimientos /> },
      { path: 'movimientos/:id', element: <PantallaMovimiento /> },
      { path: 'por-cobrar', element: pendiente },
      { path: 'por-pagar', element: pendiente },
      { path: 'deudas/:id', element: pendiente },
      { path: 'caja', element: pendiente },
      { path: 'ajustes', element: pendiente },
      { path: '*', element: pendiente },
    ],
  },
];
