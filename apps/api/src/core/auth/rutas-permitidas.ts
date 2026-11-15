// Lista blanca de rutas de Better Auth que quedan abiertas (regla 3 del plan). Todo lo demás
// (crear o borrar empresas, invitar, expulsar, cambiar roles o correo, borrar la cuenta, pedir un
// restablecimiento de contraseña) existe solo como herramienta del servidor o como comando de
// plataforma: así pasa por permisos, límites y auditoría, y una empresa no puede tocar cuentas
// que son globales (regla 19). Los nombres salen de la versión instalada de Better Auth.

type Metodo = 'GET' | 'POST';

const PERMITIDAS: ReadonlyArray<readonly [Metodo, RegExp]> = [
  ['GET', /^\/ok$/],
  ['POST', /^\/sign-up\/email$/],
  ['POST', /^\/sign-in\/email$/],
  ['POST', /^\/sign-out$/],
  ['GET', /^\/get-session$/],
  ['POST', /^\/change-password$/],
  ['POST', /^\/reset-password$/],
  ['GET', /^\/reset-password\/[A-Za-z0-9_-]+$/],
  ['GET', /^\/organization\/list$/],
  ['POST', /^\/organization\/set-active$/],
  ['GET', /^\/organization\/get-invitation$/],
  ['POST', /^\/organization\/accept-invitation$/],
];

/** `ruta` es la ruta relativa a `/api/auth` (por ejemplo `/sign-in/email`). */
export function rutaDeAutenticacionPermitida(metodo: string, ruta: string): boolean {
  const limpia = ruta.split('?')[0]!.replace(/\/+$/, '') || '/';
  return PERMITIDAS.some(([m, patron]) => m === metodo.toUpperCase() && patron.test(limpia));
}
