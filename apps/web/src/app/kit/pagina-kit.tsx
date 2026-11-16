import { KitBase } from './kit-base.tsx';
import { KitDatos } from './kit-datos.tsx';
import { KitOla2 } from './kit-ola-2.tsx';

/** Página `/kit` (solo en desarrollo): cada pieza del kit en todos sus estados. */
export function PaginaKit() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-6">
      <KitBase />
      <KitDatos />
      <KitOla2 />
    </div>
  );
}
