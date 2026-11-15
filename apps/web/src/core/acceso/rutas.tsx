import type { RouteObject } from 'react-router';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';

// Pantallas de acceso: las construye su carril. Mientras tanto, un marcador.
const marcador = <EstadoVacio titulo="En construcción" descripcion="Esta pantalla todavía no está disponible." icono="caja" />;

export const rutas: RouteObject[] = [
  { path: 'iniciar-sesion', element: marcador },
  { path: 'registro', element: marcador },
  { path: 'nueva-empresa', element: marcador },
];
