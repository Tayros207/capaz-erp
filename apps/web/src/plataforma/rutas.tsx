import type { RouteObject } from 'react-router';
import { perezosa } from '../shared/rutas/perezosa.ts';

const p = () => import('./pantallas-de-plataforma.ts');

// Consola de plataforma (solo operadores). Habla con `/api/v1/plataforma/herramientas/:nombre`, no con la puerta de empresas.
// Las pantallas cargan diferido: la consola no pesa en el arranque de quien no es operador.
export const rutas: RouteObject[] = [
  { path: 'plataforma', lazy: perezosa(p, (m) => <m.Marco><m.PantallaEmpresas /></m.Marco>) },
  { path: 'plataforma/empresas/:id', lazy: perezosa(p, (m) => <m.Marco conIndicadores={false}><m.PantallaEmpresa /></m.Marco>) },
  { path: 'plataforma/planes', lazy: perezosa(p, (m) => <m.Marco conIndicadores={false}><m.PantallaPlanes /></m.Marco>) },
  { path: 'plataforma/solicitudes', lazy: perezosa(p, (m) => <m.Marco conIndicadores={false}><m.PantallaSolicitudes /></m.Marco>) },
];
