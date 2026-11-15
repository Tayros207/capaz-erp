import type { RouteObject } from 'react-router';
import { ConConsultas } from './consultas.tsx';
import { PantallaRegla } from './pantalla-regla.tsx';
import { PantallaReglas } from './pantalla-reglas.tsx';

// `/ajustes/automatizaciones` (reglas e historial), `/nueva` (editor) y `/:id` (editar, probar, historial de una regla).
export const rutas: RouteObject[] = [
  { path: 'ajustes/automatizaciones', element: <ConConsultas><PantallaReglas /></ConConsultas> },
  { path: 'ajustes/automatizaciones/nueva', element: <ConConsultas><PantallaRegla /></ConConsultas> },
  { path: 'ajustes/automatizaciones/:id', element: <ConConsultas><PantallaRegla /></ConConsultas> },
];
