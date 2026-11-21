import { Navigate, type RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';

const p = () => import('./pantallas-de-registro.ts');

// Pantallas de «registro» (Finanzas ligeras), bajo `m/registro/…` con marco propio (ficha §4.7).
export const rutas: RouteObject[] = [
  // Documentos imprimibles: fuera del marco (sin navegación de sección) para que la hoja salga limpia.
  { path: 'm/registro/deudas/:id/abonos/:abonoId/recibo', lazy: perezosa(p, (m) => <m.PantallaRecibo />) },
  { path: 'm/registro/estado-de-cuenta/:contactoId', lazy: perezosa(p, (m) => <m.PantallaEstadoDeCuenta />) },
  {
    path: 'm/registro',
    lazy: perezosa(p, (m) => <m.MarcoDeRegistro />),
    children: [
      { index: true, element: <Navigate to="movimientos" replace /> },
      { path: 'movimientos', lazy: perezosa(p, (m) => <m.PantallaMovimientos />) },
      { path: 'movimientos/:id', lazy: perezosa(p, (m) => <m.PantallaMovimiento />) },
      { path: 'papelera', lazy: perezosa(p, (m) => <m.PantallaMovimientos key="papelera" papelera />) },
      { path: 'por-cobrar', lazy: perezosa(p, (m) => <m.PantallaDeudas tipo="por_cobrar" />) },
      { path: 'por-pagar', lazy: perezosa(p, (m) => <m.PantallaDeudas tipo="por_pagar" />) },
      { path: 'deudas/:id', lazy: perezosa(p, (m) => <m.PantallaDeuda />) },
      { path: 'caja', lazy: perezosa(p, (m) => <m.PantallaCaja />) },
      { path: 'cierre', lazy: perezosa(p, (m) => <m.PantallaCierre />) },
      { path: 'antiguedad', lazy: perezosa(p, (m) => <m.PantallaAntiguedad />) },
      { path: 'ajustes', lazy: perezosa(p, (m) => <m.PantallaAjustes />) },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="caja" /> },
    ],
  },
];
