// Tema de la interfaz: preferencia (claro, oscuro o sistema) y tema resuelto (claro u oscuro, que
// es lo que lleva `data-tema` en <html>). Parte pura, sin React: la usan el script en línea de
// `index.html` (copia exacta de SCRIPT_DE_TEMA, vigilada por una prueba) y `use-tema.ts`.

export type PreferenciaDeTema = 'claro' | 'oscuro' | 'sistema';
export type TemaResuelto = 'claro' | 'oscuro';

export const CLAVE_DE_TEMA = 'capaz-tema';
export const PREFERENCIAS_DE_TEMA: readonly PreferenciaDeTema[] = ['claro', 'oscuro', 'sistema'];

/** Lo mínimo que se usa de `Storage`: permite probar sin navegador. */
export type AlmacenDeTema = Pick<Storage, 'getItem' | 'setItem'>;

/** Corre en <head> antes del primer pintado. Debe quedar idéntico al de `index.html`. */
export const SCRIPT_DE_TEMA =
  "try{var p=localStorage.getItem('capaz-tema');var o=p==='oscuro'||(p!=='claro'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.tema=o?'oscuro':'claro'}catch(e){document.documentElement.dataset.tema='claro'}";

export function leerPreferencia(almacen: AlmacenDeTema | null): PreferenciaDeTema {
  try {
    const guardada = almacen?.getItem(CLAVE_DE_TEMA);
    return guardada === 'claro' || guardada === 'oscuro' ? guardada : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function guardarPreferencia(almacen: AlmacenDeTema | null, preferencia: PreferenciaDeTema): void {
  try {
    almacen?.setItem(CLAVE_DE_TEMA, preferencia);
  } catch {
    // Modo privado o datos bloqueados: la app funciona igual, solo que no recuerda la elección.
  }
}

export function resolverTema(preferencia: PreferenciaDeTema, sistemaOscuro: boolean): TemaResuelto {
  if (preferencia === 'sistema') return sistemaOscuro ? 'oscuro' : 'claro';
  return preferencia;
}

export function aplicarTema(raiz: { dataset: Record<string, string | undefined> }, tema: TemaResuelto): void {
  raiz.dataset.tema = tema;
}
