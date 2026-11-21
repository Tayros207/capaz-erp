import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';

const p = () => import('./pantallas-de-produccion.ts');

// Pantallas de «produccion» (órdenes de trabajo del taller), bajo `m/produccion/…` con marco propio, como Registro.
export const rutas: RouteObject[] = [
  // Documento imprimible: fuera del marco (sin navegación de sección) para que la hoja salga limpia.
  { path: 'm/produccion/:id/documento', lazy: perezosa(p, (m) => <m.PantallaDocumentoDeOrden />) },
  {
    path: 'm/produccion',
    lazy: perezosa(p, (m) => <m.MarcoDeProduccion />),
    children: [
      { index: true, lazy: perezosa(p, (m) => <m.PantallaOrdenes />) },
      { path: ':id', lazy: perezosa(p, (m) => <m.PantallaOrden />) },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="caja" /> },
    ],
  },
];
