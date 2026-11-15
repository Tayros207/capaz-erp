import { useId, useState } from 'react';
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

export function SelectorDeEmpresa({ activa, empresas }: Props) {
  const id = useId();
  const [cambiando, setCambiando] = useState(false);
  const navegar = useNavigate();
  const revalidar = useRevalidator();

  if (empresas.length < 2) {
    return <span className="min-w-0 truncate font-semibold text-texto" title={activa.nombre}>{activa.nombre}</span>;
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
    <div className="flex min-w-0 items-center">
      <label htmlFor={id} className="sr-only">Empresa activa</label>
      <select id={id} value={activa.id} disabled={cambiando} onChange={(e) => void cambiar(e.target.value)}
        className="min-h-(--alto-control) max-w-full min-w-0 cursor-pointer truncate rounded-control border border-borde-fuerte bg-superficie px-2 font-semibold text-texto disabled:opacity-50">
        {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
    </div>
  );
}
