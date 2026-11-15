export type TipoDeAviso = 'exito' | 'info' | 'aviso' | 'error';
export type DatosDeAviso = { id: number; tipo: TipoDeAviso; mensaje: string };

const DURACION_MS = 5000;
let lista: readonly DatosDeAviso[] = [];
let siguiente = 1;
const oyentes = new Set<() => void>();

function emitir(nueva: readonly DatosDeAviso[]) {
  lista = nueva;
  oyentes.forEach((o) => o());
}

export function descartarAviso(id: number): void {
  emitir(lista.filter((a) => a.id !== id));
}

/** Muestra un aviso breve. Lo dibuja `<Avisos />` (ya montado en los proveedores de la app). */
export function notificar(mensaje: string, tipo: TipoDeAviso = 'info'): void {
  const id = siguiente++;
  emitir([...lista, { id, tipo, mensaje }]);
  setTimeout(() => descartarAviso(id), DURACION_MS);
}

/** Para `useSyncExternalStore` de `<Avisos />`. */
export const almacenDeAvisos = {
  suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => void oyentes.delete(oyente);
  },
  leer: () => lista,
};
