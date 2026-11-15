import type { ReactNode } from 'react';
import { Icono } from '../../shared/ui/icono.tsx';

/** Marco común de las pantallas de acceso: tarjeta centrada sobre fondo azul noche. */
export function MarcoAcceso({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-menu px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-menu-texto">
          <span className="grid size-10 place-items-center rounded-control bg-accion text-accion-texto">
            <Icono nombre="caja" className="size-6" />
          </span>
          <span className="font-titulo text-2xl font-semibold">Capaz</span>
        </div>
        <section className="rounded-tarjeta border border-borde bg-superficie p-6 shadow-elevada">
          <h1 className="font-titulo text-xl font-semibold text-texto">{titulo}</h1>
          {subtitulo ? <p className="mt-1 text-texto-suave">{subtitulo}</p> : null}
          <div className="mt-5">{children}</div>
        </section>
        {pie ? <p className="mt-4 text-center text-sm text-menu-texto">{pie}</p> : null}
      </main>
    </div>
  );
}

export function AlertaDeError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="rounded-control border border-peligro bg-superficie-alta px-3 py-2 text-sm font-medium text-peligro">
      {mensaje}
    </p>
  );
}

export const ENLACE = 'font-semibold text-accion underline underline-offset-2 hover:brightness-110';
export const ENLACE_EN_MENU = 'font-semibold text-menu-texto underline underline-offset-2';
