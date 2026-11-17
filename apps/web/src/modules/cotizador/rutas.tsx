import type { RouteObject } from 'react-router';
import { registrarExtension } from '../../shared/ui/extensiones.tsx';
import { PantallaAjustes } from './pantalla-ajustes.tsx';
import { PantallaCotizaciones } from './pantalla-cotizaciones.tsx';
import { PantallaDocumentoDeCotizacion } from './pantalla-documento-cotizacion.tsx';
import { PantallaFichaCotizacion } from './pantalla-ficha-cotizacion.tsx';
import { PantallaPrecios } from './pantalla-precios.tsx';
import { PantallaRapida } from './pantalla-rapida.tsx';
import { PantallaTaller } from './pantalla-taller.tsx';
import { SeccionCotizacionesDeCliente } from './seccion-cotizaciones-de-cliente.tsx';

// La ficha del cliente del núcleo muestra sus cotizaciones (punto de extensión: `core` no importa de `modules`).
registrarExtension('ficha-cliente', ({ clienteId }) => <SeccionCotizacionesDeCliente clienteId={String(clienteId)} />);

// Cotizador: cotización rápida, lista de precios y ajustes (sesión A); cotizaciones, ficha y documento (sesión B).
export const rutas: RouteObject[] = [
  { path: 'm/cotizador', element: <PantallaRapida /> },
  { path: 'm/cotizador/precios', element: <PantallaPrecios /> },
  { path: 'm/cotizador/ajustes', element: <PantallaAjustes /> },
  { path: 'm/cotizador/taller', element: <PantallaTaller /> },
  { path: 'm/cotizador/cotizaciones', element: <PantallaCotizaciones /> },
  { path: 'm/cotizador/cotizaciones/:id', element: <PantallaFichaCotizacion /> },
  { path: 'm/cotizador/cotizaciones/:id/documento', element: <PantallaDocumentoDeCotizacion /> },
];
