import { KitBase } from './kit-base.tsx';
import { KitDatos } from './kit-datos.tsx';
import { KitOla2 } from './kit-ola-2.tsx';
import { KitOla3 } from './kit-ola-3.tsx';
import { KitImpresion } from './kit-impresion.tsx';
import { KitDiseno } from './kit-diseno.tsx';

/** Página `/kit` (solo en desarrollo): cada pieza del kit en todos sus estados. */
export function PaginaKit() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-6">
      <KitBase />
      <KitDatos />
      <KitOla2 />
      <KitOla3 />
      <KitImpresion />
      <KitDiseno />
    </div>
  );
}
