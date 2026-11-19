import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { MarcoDeProduccion } from './marco.tsx';
import { PantallaDocumentoDeOrden } from './pantalla-documento.tsx';
import { PantallaOrden } from './pantalla-orden.tsx';
import { PantallaOrdenes } from './pantalla-ordenes.tsx';

// Pantallas de «produccion» (órdenes de trabajo del taller), bajo `m/produccion/…` con marco propio, como Registro.
export const rutas: RouteObject[] = [
  // Documento imprimible: fuera del marco (sin navegación de sección) para que la hoja salga limpia.
  { path: 'm/produccion/:id/documento', element: <PantallaDocumentoDeOrden /> },
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
