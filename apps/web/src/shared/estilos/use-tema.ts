import { useSyncExternalStore } from 'react';
import {
  aplicarTema,
  guardarPreferencia,
  leerPreferencia,
  resolverTema,
  type PreferenciaDeTema,
  type TemaResuelto,
} from './tema.ts';

// Almacén único de la preferencia: todos los componentes ven la misma. El script en línea ya puso
// `data-tema` antes de pintar; aquí solo se mantiene al día cuando cambia la preferencia o el sistema.

const hayNavegador = typeof window !== 'undefined';
const consultaOscura = hayNavegador ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const oyentes = new Set<() => void>();
let preferencia: PreferenciaDeTema = hayNavegador ? leerPreferencia(window.localStorage) : 'sistema';

function resuelto(): TemaResuelto {
  return resolverTema(preferencia, consultaOscura?.matches ?? false);
}

function aplicar() {
  if (hayNavegador) aplicarTema(document.documentElement, resuelto());
  oyentes.forEach((o) => o());
}

consultaOscura?.addEventListener('change', () => {
  if (preferencia === 'sistema') aplicar();
});

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => void oyentes.delete(oyente);
}

export function fijarTema(nueva: PreferenciaDeTema): void {
  preferencia = nueva;
  if (hayNavegador) guardarPreferencia(window.localStorage, nueva);
  aplicar();
}

/** Preferencia elegida (`claro`, `oscuro`, `sistema`) y tema resuelto, con la forma de cambiarla. */
export function useTema() {
  const pref = useSyncExternalStore(suscribir, () => preferencia, () => 'sistema' as const);
  const tema = useSyncExternalStore(suscribir, resuelto, () => 'claro' as const);
  return { preferencia: pref, tema, fijar: fijarTema };
}
