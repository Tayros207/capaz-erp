import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';

const p = () => import('./pantallas-de-personal.ts');

// Personal: colaboradores (lista y ficha), asistencia del día y adelantos, bajo `m/personal/…` con marco propio.
export const rutas: RouteObject[] = [
  {
    path: 'm/personal',
    lazy: perezosa(p, (m) => <m.MarcoDePersonal />),
    children: [
      { index: true, lazy: perezosa(p, (m) => <m.PantallaColaboradores />) },
      { path: 'colaboradores/:id', lazy: perezosa(p, (m) => <m.PantallaFichaColaborador />) },
      { path: 'asistencia', lazy: perezosa(p, (m) => <m.PantallaAsistencia />) },
      { path: 'adelantos', lazy: perezosa(p, (m) => <m.PantallaAdelantos />) },
      { path: 'vacaciones', lazy: perezosa(p, (m) => <m.PantallaVacaciones />) },
      { path: 'contratos', lazy: perezosa(p, (m) => <m.PantallaContratos />) },
      { path: 'adelantos/nuevo', lazy: perezosa(p, (m) => <m.PantallaNuevoAdelanto />) },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="usuario" /> },
    ],
  },
];
