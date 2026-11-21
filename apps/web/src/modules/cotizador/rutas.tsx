import type { RouteObject } from 'react-router';
import { perezosa } from '../../shared/rutas/perezosa.ts';
import { registrarExtension } from '../../shared/ui/extensiones.tsx';
import { SeccionCotizacionesDiferida } from './seccion-diferida.tsx';

const p = () => import('./pantallas-de-cotizador.ts');

// La ficha del cliente del núcleo muestra sus cotizaciones (punto de extensión: `core` no importa de `modules`).
// El registro corre al arrancar; la sección se descarga diferida.
registrarExtension('ficha-cliente', ({ clienteId }) => <SeccionCotizacionesDiferida clienteId={String(clienteId)} />);

// Cotizador: cotización por partes (cuadro), cotización rápida, lista de precios y ajustes (sesión A); cotizaciones, ficha y documento (sesión B).
export const rutas: RouteObject[] = [
  { path: 'm/cotizador', lazy: perezosa(p, (m) => <m.PantallaRapida />) },
  { path: 'm/cotizador/directa', lazy: perezosa(p, (m) => <m.PantallaDirecta />) },
  { path: 'm/cotizador/cuadro/nuevo', lazy: perezosa(p, (m) => <m.PantallaCuadroNuevo />) },
  { path: 'm/cotizador/cuadro/:id', lazy: perezosa(p, (m) => <m.PantallaCuadro />) },
  { path: 'm/cotizador/precios', lazy: perezosa(p, (m) => <m.PantallaPrecios />) },
  { path: 'm/cotizador/ajustes', lazy: perezosa(p, (m) => <m.PantallaAjustes />) },
  { path: 'm/cotizador/taller', lazy: perezosa(p, (m) => <m.PantallaTaller />) },
  { path: 'm/cotizador/cotizaciones', lazy: perezosa(p, (m) => <m.PantallaCotizaciones />) },
  { path: 'm/cotizador/cotizaciones/:id', lazy: perezosa(p, (m) => <m.PantallaFichaCotizacion />) },
  { path: 'm/cotizador/cotizaciones/:id/documento', lazy: perezosa(p, (m) => <m.PantallaDocumentoDeCotizacion />) },
];
