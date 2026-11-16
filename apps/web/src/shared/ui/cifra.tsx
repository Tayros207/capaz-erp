import type { ReactNode } from 'react';
import { unir } from './unir.ts';

export type TonoDeCifra = 'neutro' | 'exito' | 'peligro' | 'aviso';

const TONOS: Record<TonoDeCifra, { valor: string; marca: string; texto: string }> = {
  neutro: { valor: 'text-texto', marca: 'bg-borde-fuerte', texto: '' },
  exito: { valor: 'text-exito', marca: 'bg-exito', texto: 'Favorable' },
  peligro: { valor: 'text-peligro', marca: 'bg-peligro', texto: 'Atención' },
  aviso: { valor: 'text-aviso', marca: 'bg-aviso', texto: 'Pendiente' },
};

/** Un dato resumido: etiqueta pequeña, valor grande. El tono se refuerza con una marca y texto oculto, no solo con color. */
export function Cifra({ etiqueta, valor, tono = 'neutro', ayuda }: { etiqueta: string; valor: string; tono?: TonoDeCifra; ayuda?: string }) {
  const t = TONOS[tono];
  return (
    <div className="flex min-h-11 flex-col gap-1 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <span className="flex items-center gap-2 text-sm font-medium text-texto-suave">
        <span aria-hidden="true" className={unir('inline-block size-2 shrink-0 rounded-full', t.marca)} />
        {etiqueta}
      </span>
      <span className={unir('font-titulo text-2xl font-semibold tracking-tight tabular-nums', t.valor)}>
        {valor}
        {t.texto ? <span className="sr-only"> ({t.texto})</span> : null}
      </span>
      {ayuda ? <span className="text-sm text-texto-suave">{ayuda}</span> : null}
    </div>
  );
}

/** Rejilla de cifras: 2 columnas en móvil, 4 desde escritorio. */
export function GrupoDeCifras({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={etiqueta} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {children}
    </div>
  );
}
