// Preferencia de menú plegado (solo iconos) en pantalla ancha. Solo una comodidad: si el navegador no
// deja guardar, el menú se ve completo.
const CLAVE = 'capaz.menu-plegado';

export function leerPlegado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

export function guardarPlegado(valor: boolean): void {
  try {
    window.localStorage.setItem(CLAVE, valor ? '1' : '0');
  } catch {
    // sin almacenamiento: no pasa nada
  }
}
