import { AlertTriangle, Building2, CheckCircle2, Clock, FlaskConical, Inbox, Radar, Search, type LucideIcon } from 'lucide-react';

import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Esqueleto } from '../shared/ui/esqueleto.tsx';
import { unir } from '../shared/ui/unir.ts';
import { CifraAnimada } from './cifra-animada.tsx';
import { useEmpresas, useSolicitudesPendientes } from './consultas.ts';
import { kpisDeEmpresas, type Kpis } from './logica.ts';

const SECCIONES = [
  { a: '/plataforma', texto: 'Empresas', fin: false },
  { a: '/plataforma/planes', texto: 'Planes', fin: true },
  { a: '/plataforma/solicitudes', texto: 'Solicitudes', fin: true },
] as const;

type Tarjeta = { id: string; etiqueta: string; valor: number; nota: string; icono: LucideIcon; punto: string; a: string };

function tarjetasDe(k: Kpis): Tarjeta[] {
  return [
    { id: 'total', etiqueta: 'Empresas', valor: k.total, nota: `${k.miembros} usuarios en total`, icono: Building2, punto: 'bg-menu-texto', a: '/plataforma' },
    { id: 'activas', etiqueta: 'Activas', valor: k.activas, nota: 'Con módulos en uso', icono: CheckCircle2, punto: 'bg-exito', a: '/plataforma?estado=activa' },
    { id: 'prueba', etiqueta: 'En prueba', valor: k.enPrueba, nota: 'Solo módulos de prueba', icono: FlaskConical, punto: 'bg-info', a: '/plataforma?estado=prueba' },
    { id: 'problema', etiqueta: 'Con alertas', valor: k.conProblema, nota: 'Suspendidas o de baja', icono: AlertTriangle, punto: 'bg-aviso', a: '/plataforma?estado=suspendida' },
    { id: 'vencen', etiqueta: 'Vencen en 7 días', valor: k.vencenPronto, nota: 'Pruebas y vigencias', icono: Clock, punto: 'bg-peligro', a: '/plataforma?vence=7' },
    { id: 'solicitudes', etiqueta: 'Solicitudes', valor: k.solicitudes, nota: 'Pendientes de atender', icono: Inbox, punto: 'bg-accion', a: '/plataforma/solicitudes' },
  ];
}

function TarjetaDeKpi({ t }: { t: Tarjeta }) {
  return (
    <Link
      to={t.a}
      className="group flex flex-col gap-1 rounded-control border border-white/10 bg-white/[0.04] p-3 transition-[background-color,border-color,transform] duration-150 hover:border-white/25 hover:bg-white/[0.09] active:scale-[0.99]"
    >
      <span className="flex items-center gap-2 text-xs font-medium text-menu-texto/75">
        <t.icono aria-hidden className="size-3.5" strokeWidth={1.75} />
        <span className="truncate">{t.etiqueta}</span>
        <span aria-hidden className={unir('ml-auto size-1.5 shrink-0 rounded-full', t.punto)} />
      </span>
      <CifraAnimada valor={t.valor} className="font-titulo text-3xl leading-none font-semibold tracking-tight text-white tabular-nums" />
      <span className="truncate text-[0.6875rem] text-menu-texto/60">{t.nota}</span>
    </Link>
  );
}

function BarraDeDistribucion({ k }: { k: Kpis }) {
  const sin = Math.max(0, k.total - k.activas - k.enPrueba - k.conProblema);
  const partes = [
    { id: 'a', n: k.activas, c: 'bg-exito', t: 'Activas' },
    { id: 'p', n: k.enPrueba, c: 'bg-info', t: 'En prueba' },
    { id: 'x', n: k.conProblema, c: 'bg-aviso', t: 'Suspendidas o de baja' },
    { id: 's', n: sin, c: 'bg-white/25', t: 'Sin módulos' },
  ].filter((p) => p.n > 0);
  if (k.total === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={partes.map((p) => `${p.t}: ${p.n}`).join('. ')} className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {partes.map((p) => (
          <span key={p.id} className={unir('h-full rounded-full transition-[flex-grow] duration-500', p.c)} style={{ flexGrow: p.n, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 p-0 text-[0.6875rem] text-menu-texto/70" style={{ listStyle: 'none' }}>
        {partes.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span aria-hidden className={unir('size-1.5 rounded-full', p.c)} />
            {p.t} <span className="tabular-nums text-menu-texto">{p.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Indicadores() {
  const [ahora] = useState(() => new Date());
  const empresas = useEmpresas();
  const solicitudes = useSolicitudesPendientes();
  if (empresas.isError) return null;
  if (!empresas.data) {
    return (
      <div aria-busy="true" aria-label="Cargando indicadores" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <Esqueleto key={i} className="h-[5.25rem] rounded-control bg-white/10" />)}
      </div>
    );
  }
  const k = kpisDeEmpresas(empresas.data, ahora, solicitudes.data?.length ?? 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {tarjetasDe(k).map((t) => <TarjetaDeKpi key={t.id} t={t} />)}
      </div>
      <BarraDeDistribucion k={k} />
    </>
  );
}

/** Banda superior de la consola: identidad de «centro de control», búsqueda global, secciones e indicadores. */
export function CabeceraDeConsola({ conIndicadores, alBuscar }: { conIndicadores: boolean; alBuscar: () => void }) {
  const pendientes = useSolicitudesPendientes().data?.length ?? 0;
  return (
    <section aria-label="Centro de control" className="relative isolate overflow-hidden rounded-tarjeta bg-menu p-4 text-menu-texto shadow-elevada md:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-28 -left-20 -z-10 size-72 rounded-full bg-accion/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-32 -z-10 size-80 rounded-full bg-info/25 blur-3xl" />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-tarjeta bg-accion text-accion-texto shadow-sutil">
              <Radar aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <div className="flex flex-col">
              <span className="text-[0.6875rem] font-medium tracking-[0.12em] text-menu-texto/60 uppercase">Consola de plataforma</span>
              <span className="font-titulo text-xl font-semibold tracking-tight text-white">Centro de control</span>
            </div>
          </div>
          <button
            type="button"
            onClick={alBuscar}
            className="flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-control border border-white/15 bg-white/[0.06] px-3 text-sm text-menu-texto/80 transition-colors hover:border-white/30 hover:bg-white/10 sm:min-w-64"
          >
            <Search aria-hidden className="size-4" strokeWidth={1.75} />
            <span className="flex-1 text-left">Buscar empresa o módulo…</span>
            <kbd className="hidden rounded-chip border border-white/20 px-1.5 py-0.5 font-mono text-[0.625rem] text-menu-texto/70 sm:block">Ctrl K</kbd>
          </button>
        </div>
        <nav aria-label="Secciones de la consola" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.a}
              to={s.a}
              end={s.fin}
              className={({ isActive }) =>
                unir(
                  'inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-white text-menu shadow-sutil' : 'text-menu-texto/80 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {s.texto}
              {s.texto === 'Solicitudes' && pendientes > 0 ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-accion px-1.5 text-[0.6875rem] font-semibold text-accion-texto tabular-nums">
                  {pendientes}
                  <span className="sr-only"> pendientes</span>
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        {conIndicadores ? <Indicadores /> : null}
      </div>
    </section>
  );
}

