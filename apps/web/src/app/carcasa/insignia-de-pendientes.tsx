import { unir } from '../../shared/ui/unir.ts';
import { textoDeInsignia } from './menu.ts';

/** Insignia de pendientes: número con texto para lectores de pantalla; en solo iconos va sobre el icono. */
export function InsigniaDePendientes({ cantidad, className }: { cantidad: number; className?: string }) {
  const texto = textoDeInsignia(cantidad);
  if (!texto) return null;
  return (
    <span className={unir('inline-flex min-w-5 items-center justify-center rounded-full bg-acento-esmeralda px-1.5 text-xs font-bold text-texto-inverso tabular-nums', className)}>
      {texto}
      <span className="sr-only"> {cantidad === 1 ? 'pendiente' : 'pendientes'}</span>
    </span>
  );
}
