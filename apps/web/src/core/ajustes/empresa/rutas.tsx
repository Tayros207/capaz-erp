import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';

// Pantallas de «Empresa»: las construye su carril. Mientras tanto, un marcador.
export const rutas: RouteObject[] = [
  { path: 'ajustes/empresa/*', element: <EstadoVacio titulo="En construcción" descripcion="Esta pantalla todavía no está disponible." icono="caja" /> },
];
