import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';

const p = () => import('./pantallas-de-insumos.ts');

// Pantallas de «insumos» (Inventario), bajo `m/insumos/…` con marco propio (FICHAS-OLA-3 §2).
export const rutas: RouteObject[] = [
  {
    path: 'm/insumos',
    lazy: perezosa(p, (m) => <m.MarcoDeInventario />),
    children: [
      { index: true, lazy: perezosa(p, (m) => <m.PantallaExistencias />) },
      { path: 'alertas', lazy: perezosa(p, (m) => <m.PantallaAlertas />) },
      { path: 'movimientos', lazy: perezosa(p, (m) => <m.PantallaMovimientos />) },
      { path: 'transferencias', lazy: perezosa(p, (m) => <m.PantallaTransferencias />) },
      { path: 'conteos', lazy: perezosa(p, (m) => <m.PantallaConteos />) },
      { path: 'conteos/:id', lazy: perezosa(p, (m) => <m.PantallaConteo />) },
      { path: 'articulos/:id', lazy: perezosa(p, (m) => <m.PantallaArticulo />) },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="caja" /> },
    ],
  },
];
