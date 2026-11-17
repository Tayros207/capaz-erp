import type { Yo } from '@capaz/shared';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Mic, Moon, Search, Sun } from 'lucide-react';
import { Link } from 'react-router';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useTema } from '../../shared/estilos/use-tema.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { IconoMenu } from './iconos-menu.tsx';
import { SelectorDeEmpresa } from './selector-empresa.tsx';
import { IndicadorDeGuardado } from '../../shared/api/llamador/indicador-de-guardado.tsx';

type Props = { yo: Yo; migas: string[]; plegado: boolean; alPlegar: () => void; alSalir: () => void; alBuscar: () => void };

const ITEM = 'flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-2.5 text-sm text-texto outline-none data-[highlighted]:bg-superficie-alta';

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function BarraSuperior({ yo, migas, plegado, alPlegar, alSalir, alBuscar }: Props) {
  const { tema, fijar } = useTema();
  const oscuro = tema === 'oscuro';
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-borde bg-superficie/85 px-3 backdrop-blur md:px-4">
      <Boton variante="fantasma" aria-label={plegado ? 'Expandir el menú' : 'Plegar el menú'} aria-pressed={plegado}
        className="hidden lg:inline-flex" onClick={alPlegar}>
        <IconoMenu nombre="panel-izquierda" />
      </Boton>
      <Link to="/inicio" className="flex min-h-(--alto-control) items-center gap-2 rounded-control px-1 font-titulo text-base font-semibold tracking-tight text-texto">
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-control bg-accion text-sm text-accion-texto shadow-sutil">C</span>
        <span className="hidden sm:inline">Capaz</span>
      </Link>
      <nav aria-label="Ubicación" className="hidden min-w-0 items-center gap-1 text-sm text-texto-suave lg:flex">
        {migas.filter((m) => m !== 'Inicio').map((m, i, todas) => (
          <span key={`${i}-${m}`} className="flex items-center gap-1">
            <Icono nombre="flecha-derecha" className="size-3.5 text-texto-suave/60" />
            <span aria-current={i === todas.length - 1 ? 'page' : undefined} className={i === todas.length - 1 ? 'font-medium text-texto' : undefined}>{m}</span>
          </span>
        ))}
      </nav>
      <button type="button" onClick={alBuscar} aria-label="Buscar (Ctrl K)"
        className="mx-auto hidden h-9 w-full max-w-sm cursor-pointer items-center gap-2 rounded-control border border-borde bg-superficie-alta/60 px-3 text-sm text-texto-suave transition-colors hover:border-borde-fuerte hover:bg-superficie-alta md:flex">
        <Search aria-hidden className="size-4" strokeWidth={1.75} />
        <span className="flex-1 text-left">Buscar o ir a…</span>
        <kbd className="rounded-chip border border-borde bg-superficie px-1.5 py-0.5 text-[0.6875rem]">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex min-w-0 items-center gap-1 md:ml-0">
        <Boton variante="fantasma" icono="buscar" aria-label="Buscar" className="md:hidden" onClick={alBuscar} />
        {puedeEscribirEn(yo, 'registro') ? (
          <Link to="/dictar" aria-label="Dictar un registro"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-borde px-2.5 text-sm text-texto hover:border-borde-fuerte hover:bg-superficie-alta">
            <Mic aria-hidden className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Dictar</span>
          </Link>
        ) : null}
        <IndicadorDeGuardado />
        {yo.empresa ? <SelectorDeEmpresa activa={yo.empresa} empresas={yo.empresas} /> : null}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger aria-label={`Menú de ${yo.usuario.nombre}`}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-borde bg-superficie-alta text-xs font-semibold text-texto hover:border-borde-fuerte">
            {iniciales(yo.usuario.nombre)}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-64 rounded-tarjeta border border-borde bg-superficie p-1.5 shadow-elevada">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-medium text-texto">{yo.usuario.nombre}</p>
                <p className="truncate text-xs text-texto-suave">{yo.usuario.correo}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-borde" />
              <DropdownMenu.Item className={ITEM} onSelect={() => fijar(oscuro ? 'claro' : 'oscuro')}>
                {oscuro ? <Sun className="size-4 text-texto-suave" /> : <Moon className="size-4 text-texto-suave" />}
                {oscuro ? 'Tema claro' : 'Tema oscuro'}
              </DropdownMenu.Item>
              <DropdownMenu.Item className={ITEM} onSelect={alSalir}>
                <LogOut className="size-4 text-texto-suave" />
                Cerrar sesión
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
