import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-automatizaciones.ts');

// `/ajustes/automatizaciones` (reglas e historial), `/nueva` (editor) y `/:id` (editar, probar, historial de una regla).
export const rutas: RouteObject[] = [
  { path: 'ajustes/automatizaciones', lazy: perezosa(p, (m) => <m.ConConsultas><m.PantallaReglas /></m.ConConsultas>) },
  { path: 'ajustes/automatizaciones/nueva', lazy: perezosa(p, (m) => <m.ConConsultas><m.PantallaRegla /></m.ConConsultas>) },
  { path: 'ajustes/automatizaciones/:id', lazy: perezosa(p, (m) => <m.ConConsultas><m.PantallaRegla /></m.ConConsultas>) },
];
