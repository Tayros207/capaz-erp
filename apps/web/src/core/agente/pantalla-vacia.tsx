import type { ReactNode } from 'react';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { ACCIONES_RAPIDAS, saludoPorHora, type AccionRapida } from './logica-acciones.ts';
import { OrbeDelAsistente } from './orbe-del-asistente.tsx';

/** La entrada suave de todo lo que aparece en el hilo. */
export const ENTRA = 'motion-safe:animate-[asistente-entra_240ms_cubic-bezier(0.2,0.8,0.2,1)_both]';

type Props = { saludo: string; hora: number; conAsistente: boolean; sugerencias: readonly string[]; alElegir: (frase: string) => void };

type PropsDeAtajo = { a: AccionRapida; alElegir: Props['alElegir'] };

/** El primer atajo, destacado: es por donde empieza el día. */
function AtajoPrincipal({ a, alElegir }: PropsDeAtajo): ReactNode {
  return (
    <button type="button" onClick={() => alElegir(a.frase)} className="group relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-3xl bg-linear-120 from-asistente-hondo-1 to-asistente-hondo-2 p-4 text-left text-white shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--color-asistente-hondo-2)_80%,transparent)] transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.99]">
      <span aria-hidden="true" className="absolute -top-10 -right-6 size-32 rounded-full bg-asistente-3/35 blur-2xl" />
      <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-white/18 ring-1 ring-white/25 ring-inset"><Icono nombre={a.icono} className="size-5" /></span>
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className="text-base leading-tight font-semibold">{a.titulo}</span>
        <span className="text-[0.8125rem] leading-snug text-white/85">{a.detalle}</span>
      </span>
      <Icono nombre="flecha-derecha" className="relative size-5 opacity-80 transition-transform duration-200 group-hover:translate-x-0.5" />
    </button>
  );
}

function FilaDeAtajo({ a, alElegir }: PropsDeAtajo): ReactNode {
  return (
    <li className="border-t border-borde/70 first:border-t-0">
      <button type="button" onClick={() => alElegir(a.frase)} className="group flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-asistente-2/8 active:bg-asistente-2/14">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-asistente-2/12 text-asistente-tinta-2"><Icono nombre={a.icono} className="size-[1.125rem]" /></span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm leading-tight font-semibold text-texto">{a.titulo}</span>
          <span className="truncate text-xs leading-snug text-texto-suave">{a.detalle}</span>
        </span>
        <Icono nombre="flecha-derecha" className="size-4 text-texto-suave/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-asistente-tinta-2" />
      </button>
    </li>
  );
}

function Atajos({ alElegir }: { alElegir: Props['alElegir'] }): ReactNode {
  const [principal, ...resto] = ACCIONES_RAPIDAS;
  return (
    <div className="flex w-full flex-col gap-2.5 text-left">
      {principal ? <AtajoPrincipal a={principal} alElegir={alElegir} /> : null}
      <ul className="overflow-hidden rounded-3xl border border-borde/80 bg-superficie/85 shadow-tarjeta">
        {resto.map((a) => <FilaDeAtajo key={a.titulo} a={a} alElegir={alElegir} />)}
      </ul>
    </div>
  );
}

function Ejemplos({ sugerencias, alElegir }: Pick<Props, 'sugerencias' | 'alElegir'>): ReactNode {
  return (
    <ul className="flex w-full flex-col gap-2">
      {sugerencias.map((frase) => (
        <li key={frase}>
          <button type="button" className="min-h-(--alto-control) w-full cursor-pointer rounded-2xl border border-borde/80 bg-superficie/85 px-3.5 py-2.5 text-left text-sm text-texto shadow-sutil transition-colors duration-150 hover:border-asistente-2/50 hover:bg-asistente-2/8" onClick={() => alElegir(frase)}>
            {frase}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** La pantalla vacía: el orbe, un saludo según la hora y los atajos (rellenan la caja, no envían). */
export function PantallaVacia({ saludo, hora, conAsistente, sugerencias, alElegir }: Props): ReactNode {
  return (
    <div className={unir('flex flex-col items-center gap-4 pt-5 text-center', ENTRA)}>
      <OrbeDelAsistente tamano="size-20" aura />
      <div className="relative mt-2 flex flex-col items-center gap-1.5">
        {conAsistente ? <h3 className="bg-linear-90 from-asistente-tinta-1 to-asistente-tinta-2 bg-clip-text pb-0.5 text-[2rem] leading-tight font-bold tracking-[-0.03em] text-transparent">{saludoPorHora(hora)}</h3> : null}
        <p className="max-w-[34ch] text-sm leading-relaxed text-balance text-texto-suave">{saludo}</p>
      </div>
      {conAsistente ? <Atajos alElegir={alElegir} /> : <Ejemplos sugerencias={sugerencias} alElegir={alElegir} />}
    </div>
  );
}
