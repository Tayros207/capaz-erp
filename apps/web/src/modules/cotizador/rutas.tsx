import type { RouteObject } from 'react-router';
import { PantallaAjustes } from './pantalla-ajustes.tsx';
import { PantallaCotizaciones } from './pantalla-cotizaciones.tsx';
import { PantallaDocumentoDeCotizacion } from './pantalla-documento-cotizacion.tsx';
import { PantallaFichaCotizacion } from './pantalla-ficha-cotizacion.tsx';
import { PantallaPrecios } from './pantalla-precios.tsx';
import { PantallaRapida } from './pantalla-rapida.tsx';

// Cotizador: cotización rápida, lista de precios y ajustes (sesión A); cotizaciones, ficha y documento (sesión B).
export const rutas: RouteObject[] = [
  { path: 'm/cotizador', element: <PantallaRapida /> },
  { path: 'm/cotizador/precios', element: <PantallaPrecios /> },
  { path: 'm/cotizador/ajustes', element: <PantallaAjustes /> },
  { path: 'm/cotizador/cotizaciones', element: <PantallaCotizaciones /> },
  { path: 'm/cotizador/cotizaciones/:id', element: <PantallaFichaCotizacion /> },
  { path: 'm/cotizador/cotizaciones/:id/documento', element: <PantallaDocumentoDeCotizacion /> },
];
