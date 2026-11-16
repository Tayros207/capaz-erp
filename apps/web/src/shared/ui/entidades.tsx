import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { inicialesDe, rutaDeEntidad, tonoDeEstado, type TipoDeEntidad } from './entidades-logica.ts';
import { Insignia } from './insignia.tsx';
import { unir } from './unir.ts';

/** Enlace a la ficha de cualquier entidad (cliente, pedido, deuda, movimiento). Úsalo en vez de armar la ruta a mano. */
export function EnlaceDeEntidad({ tipo, id, children, className }: { tipo: TipoDeEntidad; id: string; children: ReactNode; className?: string }) {
  return (
    <Link to={rutaDeEntidad(tipo, id)} className={unir('rounded-chip font-medium text-texto underline-offset-2 hover:text-accion hover:underline', className)}>
      {children}
    </Link>
  );
}

/** Chip de cliente: avatar con iniciales y nombre, enlazado a su ficha. Igual en pedidos, deudas, oportunidades y compras. */
export function ChipDeCliente({ id, nombre, className }: { id: string; nombre: string; className?: string }) {
  return (
    <Link to={rutaDeEntidad('cliente', id)} title={`Abrir la ficha de ${nombre}`}
      className={unir('inline-flex max-w-full items-center gap-2 rounded-full border border-borde bg-superficie py-0.5 pr-3 pl-0.5 text-sm font-medium text-texto shadow-sutil hover:border-borde-fuerte', className)}>
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-superficie-alta text-[0.6875rem] font-semibold text-texto-suave">{inicialesDe(nombre)}</span>
      <span className="truncate">{nombre}</span>
    </Link>
  );
}

/** Insignia de estado: el tono sale del texto, así «Vencida» o «Pagada» se ven igual en todos los módulos. */
export function InsigniaDeEstado({ estado }: { estado: string }) {
  return <Insignia tono={tonoDeEstado(estado)}>{estado}</Insignia>;
}
