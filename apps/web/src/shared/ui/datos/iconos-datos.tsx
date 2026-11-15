import type { ReactNode } from 'react';
import { unir } from '../unir.ts';

// Iconos propios de las piezas de datos (el kit base no trae flechas ni puntos).
const TRAZOS = {
  arriba: <path d="m6 14 6-6 6 6" />,
  abajo: <path d="m6 10 6 6 6-6" />,
  izquierda: <path d="m14 6-6 6 6 6" />,
  derecha: <path d="m10 6 6 6-6 6" />,
  ordenable: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  puntos: (
    <>
      <circle cx="12" cy="5.5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="18.5" r="1.4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NombreDeIconoDeDatos = keyof typeof TRAZOS;

export function IconoDeDatos({ nombre, className }: { nombre: NombreDeIconoDeDatos; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={unir('size-4 shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
