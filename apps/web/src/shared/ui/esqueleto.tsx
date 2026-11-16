import { unir } from './unir.ts';

/** Marcador de carga: un bloque gris que late. Oculto a lectores; quien carga avisa con `aria-busy`. */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden="true" className={unir('h-4 animate-pulse rounded-chip bg-borde/70', className)} />;
}
