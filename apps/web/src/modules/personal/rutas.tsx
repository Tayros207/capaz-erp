import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { MarcoDePersonal } from './marco.tsx';
import { PantallaAdelantos } from './pantalla-adelantos.tsx';
import { PantallaAsistencia } from './pantalla-asistencia.tsx';
import { PantallaColaboradores } from './pantalla-colaboradores.tsx';
import { PantallaContratos } from './pantalla-contratos.tsx';
import { PantallaFichaColaborador } from './pantalla-ficha-colaborador.tsx';
import { PantallaNuevoAdelanto } from './pantalla-nuevo-adelanto.tsx';
import { PantallaVacaciones } from './pantalla-vacaciones.tsx';

// Personal: colaboradores (lista y ficha), asistencia del día y adelantos, bajo `m/personal/…` con marco propio.
export const rutas: RouteObject[] = [
  {
    path: 'm/personal',
    element: <MarcoDePersonal />,
    children: [
      { index: true, element: <PantallaColaboradores /> },
      { path: 'colaboradores/:id', element: <PantallaFichaColaborador /> },
      { path: 'asistencia', element: <PantallaAsistencia /> },
      { path: 'adelantos', element: <PantallaAdelantos /> },
      { path: 'vacaciones', element: <PantallaVacaciones /> },
      { path: 'contratos', element: <PantallaContratos /> },
      { path: 'adelantos/nuevo', element: <PantallaNuevoAdelanto /> },
      { path: '*', element: <EstadoVacio titulo="No encontramos esta pantalla" icono="usuario" /> },
    ],
  },
];
