// Validación de los formularios de acceso. Pura: no toca la red ni el DOM.
// Los límites reflejan al servidor (contraseña de 10 a 128; empresa de 2 a 80).

export const LARGO_MIN_CLAVE = 10;
export const LARGO_MAX_CLAVE = 128;
export const LARGO_MIN_EMPRESA = 2;
export const LARGO_MAX_EMPRESA = 80;

export type Errores<T extends string> = Partial<Record<T, string>>;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const esCorreoValido = (correo: string): boolean => CORREO.test(correo.trim());

export type DatosInicio = { correo: string; clave: string };

export function validarInicio(d: DatosInicio): Errores<'correo' | 'clave'> {
  const e: Errores<'correo' | 'clave'> = {};
  if (!d.correo.trim()) e.correo = 'Escribe tu correo.';
  else if (!esCorreoValido(d.correo)) e.correo = 'Escribe un correo válido, por ejemplo nombre@empresa.pe.';
  if (!d.clave) e.clave = 'Escribe tu contraseña.';
  return e;
}

export type DatosRegistro = { nombre: string; correo: string; clave: string };

export function validarRegistro(d: DatosRegistro): Errores<'nombre' | 'correo' | 'clave'> {
  const e: Errores<'nombre' | 'correo' | 'clave'> = {};
  if (d.nombre.trim().length < 2) e.nombre = 'Escribe tu nombre.';
  if (!d.correo.trim()) e.correo = 'Escribe tu correo.';
  else if (!esCorreoValido(d.correo)) e.correo = 'Escribe un correo válido, por ejemplo nombre@empresa.pe.';
  if (d.clave.length < LARGO_MIN_CLAVE) e.clave = `La contraseña necesita al menos ${LARGO_MIN_CLAVE} caracteres.`;
  else if (d.clave.length > LARGO_MAX_CLAVE) e.clave = `La contraseña no puede pasar de ${LARGO_MAX_CLAVE} caracteres.`;
  return e;
}

export function validarEmpresa(nombre: string): Errores<'nombre'> {
  const n = nombre.trim();
  if (n.length < LARGO_MIN_EMPRESA) return { nombre: 'Escribe el nombre de la empresa.' };
  if (n.length > LARGO_MAX_EMPRESA) return { nombre: `El nombre no puede pasar de ${LARGO_MAX_EMPRESA} caracteres.` };
  return {};
}

export const hayErrores = (e: object): boolean => Object.keys(e).length > 0;

export type DatosNuevaClave = { clave: string; repetir: string };

/** Mismas reglas que el registro (10 a 128 caracteres) más la repetición. */
export function validarNuevaClave(d: DatosNuevaClave): Errores<'clave' | 'repetir'> {
  const e: Errores<'clave' | 'repetir'> = {};
  if (d.clave.length < LARGO_MIN_CLAVE) e.clave = `La contraseña necesita al menos ${LARGO_MIN_CLAVE} caracteres.`;
  else if (d.clave.length > LARGO_MAX_CLAVE) e.clave = `La contraseña no puede pasar de ${LARGO_MAX_CLAVE} caracteres.`;
  if (!e.clave && d.repetir !== d.clave) e.repetir = 'Las dos contraseñas no coinciden.';
  return e;
}

export type EnlaceDeRestablecer = { estado: 'valido'; token: string } | { estado: 'invalido' };

/** Better Auth vuelve a esta pantalla con `?token=…` (enlace bueno) o `?error=…` (vencido o ya usado). Sin token, no sirve. */
export function leerEnlaceDeRestablecer(busqueda: string): EnlaceDeRestablecer {
  const p = new URLSearchParams(busqueda);
  const token = p.get('token');
  if (p.get('error') || !token) return { estado: 'invalido' };
  return { estado: 'valido', token };
}
