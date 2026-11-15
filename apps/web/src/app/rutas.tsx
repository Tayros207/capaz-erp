import { createBrowserRouter, redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { Carcasa } from './carcasa/carcasa.tsx';
import { ErrorDeRuta } from './error-de-ruta.tsx';
import { destinoSegunSesion } from '../shared/sesion/guarda.ts';
import { ID_RUTA_RAIZ, cargarYo } from '../shared/sesion/sesion.ts';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { rutas as acceso } from '../core/acceso/rutas.tsx';
import { rutas as inicio } from '../core/inicio/rutas.tsx';
import { rutas as clientes } from '../core/clientes/rutas.tsx';
import { rutas as productos } from '../core/productos/rutas.tsx';
import { rutas as bandeja } from '../core/bandeja/rutas.tsx';
import { rutas as conecta } from '../core/conecta/rutas.tsx';
import { rutas as automatizaciones } from '../core/automatizaciones/rutas.tsx';
import { rutas as invitaciones } from '../core/invitaciones/rutas.tsx';
import { rutas as ajustesEmpresa } from '../core/ajustes/empresa/rutas.tsx';
import { rutas as ajustesHistorial } from '../core/ajustes/historial/rutas.tsx';
import { rutas as ajustesUsuarios } from '../core/ajustes/usuarios/rutas.tsx';
import { rutas as ajustesSucursales } from '../core/ajustes/sucursales/rutas.tsx';
import { rutas as registro } from '../modules/registro/rutas.tsx';
import { rutas as crm } from '../modules/crm/rutas.tsx';
import { rutas as ordenes } from '../modules/ordenes/rutas.tsx';
import { rutas as insumos } from '../modules/insumos/rutas.tsx';
import { rutas as compras } from '../modules/compras/rutas.tsx';
import { rutas as personal } from '../modules/personal/rutas.tsx';
import { rutas as reportes } from '../modules/reportes/rutas.tsx';
import { rutas as cotizador } from '../modules/cotizador/rutas.tsx';
import { rutas as plataforma } from '../plataforma/rutas.tsx';

// Registro único de pantallas: cada área exporta `rutas` desde su propio `rutas.tsx` y aquí solo se
// listan. Nadie más edita este archivo. Las pantallas pesadas de cada área cargan diferido con
// `lazy` dentro de su propio `rutas.tsx`.

const DE_AREAS: RouteObject[] = [
  ...acceso, ...inicio, ...clientes, ...productos, ...bandeja, ...conecta, ...automatizaciones, ...invitaciones,
  ...ajustesEmpresa, ...ajustesHistorial, ...ajustesUsuarios, ...ajustesSucursales,
  ...registro, ...crm, ...ordenes, ...insumos, ...compras, ...personal, ...reportes, ...cotizador,
  ...plataforma,
];

/** Carga `yo` y aplica la guarda: redirige según la sesión. Devuelve `yo` (o nulo sin sesión). */
async function cargadorRaiz({ request }: LoaderFunctionArgs) {
  const respuesta = await cargarYo();
  let yo = null;
  if (respuesta.ok) yo = respuesta.datos;
  else if ('error' in respuesta && respuesta.error.codigo !== 'no_autenticado') {
    throw new Error(respuesta.error.mensaje);
  }
  const destino = destinoSegunSesion(yo, new URL(request.url).pathname);
  if (destino) throw redirect(destino);
  return yo;
}

const noEncontrada = <EstadoVacio titulo="Página no encontrada" descripcion="La dirección no existe o ya no está disponible." icono="buscar" />;

// `/kit` solo existe en desarrollo y se carga aparte, por lo que no entra al paquete de producción.
const DEL_KIT: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'kit', lazy: async () => ({ Component: (await import('./kit/pagina-kit.tsx')).PaginaKit }) }]
  : [];

export const router = createBrowserRouter([
  {
    id: ID_RUTA_RAIZ,
    loader: cargadorRaiz,
    Component: Carcasa,
    ErrorBoundary: ErrorDeRuta,
    children: [...DE_AREAS, ...DEL_KIT, { path: '*', element: noEncontrada }],
  },
]);
