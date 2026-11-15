import type { Yo } from '@capaz/shared';

// Guarda de rutas: función pura que dice adónde redirigir según la sesión, o nulo si se puede entrar.
// Flujo (fase 3b): sin sesión → /iniciar-sesion; con sesión pero sin empresa → /nueva-empresa;
// con todo → /inicio. `/kit` (solo existe en desarrollo) es siempre accesible.

export const RUTA_INICIAR_SESION = '/iniciar-sesion';
export const RUTA_NUEVA_EMPRESA = '/nueva-empresa';
export const RUTA_INICIO = '/inicio';

const RUTAS_PUBLICAS = ['/registro', RUTA_INICIAR_SESION];

const normalizar = (ruta: string) => (ruta.length > 1 ? ruta.replace(/\/+$/, '') : ruta);
const esRuta = (ruta: string, base: string) => ruta === base || ruta.startsWith(`${base}/`);

export function destinoSegunSesion(yo: Yo | null, ruta: string): string | null {
  const r = normalizar(ruta);
  if (esRuta(r, '/kit')) return null;
  const publica = RUTAS_PUBLICAS.some((p) => esRuta(r, p));

  // Una invitación se puede abrir con sesión aunque aún no se tenga empresa; sin sesión, se vuelve a ella tras entrar.
  const invitacion = esRuta(r, '/invitacion');
  if (!yo) {
    if (publica) return null;
    return invitacion ? `${RUTA_INICIAR_SESION}?siguiente=${encodeURIComponent(r)}` : RUTA_INICIAR_SESION;
  }
  if (!yo.empresa) return esRuta(r, RUTA_NUEVA_EMPRESA) || invitacion ? null : RUTA_NUEVA_EMPRESA;
  if (r === '/' || publica || esRuta(r, RUTA_NUEVA_EMPRESA)) return RUTA_INICIO;
  return null;
}

/** Ruta a la que volver tras iniciar sesión: solo rutas internas (nunca otro sitio). */
export function rutaSiguiente(busqueda: string): string {
  const valor = new URLSearchParams(busqueda).get('siguiente');
  return valor && valor.startsWith('/') && !valor.startsWith('//') && !valor.includes('\\') ? valor : '/';
}
