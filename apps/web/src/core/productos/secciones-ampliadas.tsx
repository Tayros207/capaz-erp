import type { ReactNode } from 'react';
import { SeccionFicha } from './seccion-ficha.tsx';
import { SeccionUnidades } from './seccion-unidades.tsx';

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <h2 className="text-base font-semibold text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

/** Datos de catálogo y unidades de un producto, debajo de sus datos básicos. */
export function SeccionesAmpliadasDeProducto({ productoId, unidadBase, puedeEditar }: { productoId: string; unidadBase: string; puedeEditar: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Bloque titulo="Ficha de catálogo"><SeccionFicha productoId={productoId} puedeEditar={puedeEditar} /></Bloque>
      <Bloque titulo="Unidades de compra y venta"><SeccionUnidades productoId={productoId} unidadBase={unidadBase} puedeEditar={puedeEditar} /></Bloque>
    </div>
  );
}
