import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';

// Pantallas de «insumos»: las construye su carril. Mientras tanto, un marcador.
export const rutas: RouteObject[] = [
  { path: 'm/insumos/*', element: <EstadoVacio titulo="En construcción" descripcion="Esta pantalla todavía no está disponible." icono="caja" /> },
];
