import { unir } from '../../shared/ui/unir.ts';
import { ListaDeMenu } from './lista-de-menu.tsx';
import type { MenuDeYo } from './menu.ts';

/** Menú lateral (desde tableta). En tableta queda solo con iconos; en pantalla ancha, completo o plegado a mano. */
export function MenuLateral({ menu, plegado, pendientes = 0 }: { menu: MenuDeYo; plegado: boolean; pendientes?: number }) {
  return (
    <nav aria-label="Menú principal"
      className={unir('sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col gap-1 overflow-y-auto bg-menu px-2 py-2 md:flex',
        plegado ? 'w-16' : 'w-64 md:max-lg:w-16')}>
      <ListaDeMenu menu={menu} modo={plegado ? 'iconos' : 'auto'} pendientes={pendientes} />
    </nav>
  );
}
