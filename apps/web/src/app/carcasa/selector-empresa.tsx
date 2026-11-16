import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useNavigate, useRevalidator } from 'react-router';
import type { EmpresaDeUsuario } from '@capaz/shared';
import { notificar } from '../../shared/ui/notificar.ts';

/** Cambia la empresa activa en el servidor y recarga `yo`. */
export async function fijarEmpresaActiva(organizationId: string): Promise<boolean> {
  try {
    const r = await fetch('/api/auth/organization/set-active', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

type Props = { activa: EmpresaDeUsuario; empresas: EmpresaDeUsuario[] };

const ITEM = 'flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-2.5 text-sm text-texto outline-none data-[highlighted]:bg-superficie-alta';

export function SelectorDeEmpresa({ activa, empresas }: Props) {
  const [cambiando, setCambiando] = useState(false);
  const navegar = useNavigate();
  const revalidar = useRevalidator();

  if (empresas.length < 2) {
    return <span className="min-w-0 truncate text-sm font-medium text-texto" title={activa.nombre}>{activa.nombre}</span>;
  }

  async function cambiar(nuevaId: string) {
    if (nuevaId === activa.id) return;
    setCambiando(true);
    const ok = await fijarEmpresaActiva(nuevaId);
    setCambiando(false);
    if (!ok) return notificar('No se pudo cambiar de empresa. Inténtalo de nuevo.', 'error');
    await navegar('/inicio');
    await revalidar.revalidate();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={cambiando} aria-label={`Empresa activa: ${activa.nombre}. Cambiar de empresa`}
        className="flex min-h-9 max-w-52 min-w-0 cursor-pointer items-center gap-2 rounded-control border border-borde bg-superficie px-2.5 text-sm font-medium text-texto shadow-sutil hover:border-borde-fuerte disabled:opacity-50">
        <span className="grid size-5 shrink-0 place-items-center rounded-chip bg-accion text-[0.6875rem] font-semibold text-accion-texto">{activa.nombre.slice(0, 1).toUpperCase()}</span>
        <span className="truncate">{activa.nombre}</span>
        <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-texto-suave" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6}
          className="z-50 w-64 rounded-tarjeta border border-borde bg-superficie p-1.5 shadow-elevada">
          <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-medium text-texto-suave">Tus empresas</DropdownMenu.Label>
          {empresas.map((e) => (
            <DropdownMenu.Item key={e.id} className={ITEM} onSelect={() => void cambiar(e.id)}>
              <span className="grid size-5 shrink-0 place-items-center rounded-chip bg-superficie-alta text-[0.6875rem] font-semibold">{e.nombre.slice(0, 1).toUpperCase()}</span>
              <span className="flex-1 truncate">{e.nombre}</span>
              {e.id === activa.id ? <Check aria-label="Activa" className="size-4 text-accion" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
