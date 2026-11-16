import type { ReactNode } from 'react';
import { Icono } from '../../shared/ui/icono.tsx';

/** Marco común de las pantallas de acceso: tarjeta centrada sobre fondo azul noche. */
export function MarcoAcceso({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-menu px-4 py-10 text-menu-texto">
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 size-[34rem] rounded-full bg-accion/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-40 -bottom-48 size-[38rem] rounded-full bg-info/20 blur-3xl" />
      <div className="relative grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_24rem]">
        <aside className="hidden flex-col gap-8 lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-tarjeta bg-accion text-accion-texto shadow-elevada">
              <Icono nombre="caja" className="size-6" />
            </span>
            <span className="font-titulo text-3xl font-semibold tracking-tight">Capaz</span>
          </div>
          <h2 className="font-titulo max-w-md text-4xl leading-tight font-semibold tracking-tight">
            Tu negocio en orden, sin pasar el día tecleando.
          </h2>
          <ul className="flex max-w-md list-none flex-col gap-3 p-0 text-menu-texto/80">
            {['Ventas, cobros y compras en un solo lugar', 'El sistema propone, tú apruebas con un clic', 'Cada empresa con sus datos separados y seguros'].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accion" />
                {t}
              </li>
            ))}
          </ul>
        </aside>
        <main className="w-full">
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <span className="grid size-10 place-items-center rounded-control bg-accion text-accion-texto">
              <Icono nombre="caja" className="size-6" />
            </span>
            <span className="font-titulo text-2xl font-semibold">Capaz</span>
          </div>
          <section className="rounded-tarjeta border border-white/10 bg-superficie p-7 text-texto shadow-elevada">
            <h1 className="font-titulo text-xl font-semibold tracking-tight">{titulo}</h1>
            {subtitulo ? <p className="mt-1 text-texto-suave">{subtitulo}</p> : null}
            <div className="mt-6">{children}</div>
          </section>
          {pie ? <p className="mt-5 text-center text-sm text-menu-texto">{pie}</p> : null}
        </main>
      </div>
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
