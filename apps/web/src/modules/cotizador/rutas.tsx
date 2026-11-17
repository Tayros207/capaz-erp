import type { RouteObject } from 'react-router';
import { PantallaCuadro } from './cuadro/pantalla-cuadro.tsx';
import { PantallaCuadroNuevo } from './cuadro/pantalla-cuadro-nuevo.tsx';
import { PantallaAjustes } from './pantalla-ajustes.tsx';
import { PantallaCotizaciones } from './pantalla-cotizaciones.tsx';
import { PantallaDocumentoDeCotizacion } from './pantalla-documento-cotizacion.tsx';
import { PantallaFichaCotizacion } from './pantalla-ficha-cotizacion.tsx';
import { PantallaPrecios } from './pantalla-precios.tsx';
import { PantallaRapida } from './pantalla-rapida.tsx';
import { PantallaTaller } from './pantalla-taller.tsx';

// Cotizador: cotización por partes (cuadro), cotización rápida, lista de precios y ajustes (sesión A); cotizaciones, ficha y documento (sesión B).
export const rutas: RouteObject[] = [
  { path: 'm/cotizador', element: <PantallaRapida /> },
  { path: 'm/cotizador/cuadro/nuevo', element: <PantallaCuadroNuevo /> },
  { path: 'm/cotizador/cuadro/:id', element: <PantallaCuadro /> },
  { path: 'm/cotizador/precios', element: <PantallaPrecios /> },
  { path: 'm/cotizador/ajustes', element: <PantallaAjustes /> },
  { path: 'm/cotizador/taller', element: <PantallaTaller /> },
  { path: 'm/cotizador/cotizaciones', element: <PantallaCotizaciones /> },
  { path: 'm/cotizador/cotizaciones/:id', element: <PantallaFichaCotizacion /> },
  { path: 'm/cotizador/cotizaciones/:id/documento', element: <PantallaDocumentoDeCotizacion /> },
];
