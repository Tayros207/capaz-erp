import type { RouteObject } from 'react-router';
import { Marco } from './marco.tsx';
import { PantallaEmpresa } from './pantalla-empresa.tsx';
import { PantallaEmpresas } from './pantalla-empresas.tsx';
import { PantallaPlanes } from './pantalla-planes.tsx';
import { PantallaSolicitudes } from './pantalla-solicitudes.tsx';

// Consola de plataforma (solo operadores). Habla con `/api/v1/plataforma/herramientas/:nombre`, no con la puerta de empresas.
export const rutas: RouteObject[] = [
  { path: 'plataforma', element: <Marco><PantallaEmpresas /></Marco> },
  { path: 'plataforma/empresas/:id', element: <Marco><PantallaEmpresa /></Marco> },
  { path: 'plataforma/planes', element: <Marco><PantallaPlanes /></Marco> },
  { path: 'plataforma/solicitudes', element: <Marco><PantallaSolicitudes /></Marco> },
];
