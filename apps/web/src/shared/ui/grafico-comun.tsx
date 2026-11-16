import { useEffect, useId, useState, type ReactNode, type RefObject } from 'react';
import { categoriasDe, valorEn, type SerieDeGrafico } from './logica-grafico.ts';

export type PropsDeGrafico = {
  /** Nombre del gráfico; se lee como descripción accesible. */
  etiqueta: string;
  series: SerieDeGrafico[];
  /** Cómo se escribe un número (ejes, tabla). Por defecto, separador de miles. */
  formato?: (n: number) => string;
  /** Alto del gráfico en px (por defecto 240). */
  altura?: number;
};

export const FORMATO_POR_DEFECTO = (n: number): string => n.toLocaleString('es-PE');

/** Estilo de cada serie: color semántico + patrón/marca propios, para no depender solo del color. */
export const ESTILOS_DE_SERIE = [
  { color: 'var(--color-accion)', trazo: '', marca: 'circulo', patron: 'solido' },
  { color: 'var(--color-info)', trazo: '6 4', marca: 'cuadrado', patron: 'rayas' },
  { color: 'var(--color-acento-ambar)', trazo: '2 3', marca: 'rombo', patron: 'puntos' },
  { color: 'var(--color-acento-rosa)', trazo: '10 3 2 3', marca: 'triangulo', patron: 'cruz' },
] as const;

export type EstiloDeSerie = (typeof ESTILOS_DE_SERIE)[number];

export function estiloDe(indice: number): EstiloDeSerie {
  return ESTILOS_DE_SERIE[indice % ESTILOS_DE_SERIE.length]!;
}

/** Identificador seguro para `url(#id)`. */
export function useIdSvg(): string {
  return `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** Ancho actual del contenedor (para que el texto del SVG no se encoja en móvil). */
export function useAncho(ref: RefObject<HTMLElement | null>, inicial = 640): number {
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setAncho(Math.max(240, Math.round(el.clientWidth))));
    ro.observe(el);
    setAncho(Math.max(240, Math.round(el.clientWidth)) || inicial);
    return () => ro.disconnect();
  }, [ref, inicial]);
  return ancho;
}

/** Definiciones de patrón para el relleno de barras. */
export function PatronesDeSerie({ id, cantidad }: { id: string; cantidad: number }) {
  return (
    <defs>
      {Array.from({ length: cantidad }, (_, i) => {
        const e = estiloDe(i);
        if (e.patron === 'solido') return null;
        return (
          <pattern key={i} id={`${id}-p${i}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform={e.patron === 'rayas' ? 'rotate(45)' : undefined}>
            <rect width="8" height="8" fill="var(--color-superficie)" />
            {e.patron === 'rayas' ? <rect width="4" height="8" fill={e.color} /> : null}
            {e.patron === 'puntos' ? <circle cx="4" cy="4" r="2" fill={e.color} /> : null}
            {e.patron === 'cruz' ? <path d="M0 4H8M4 0V8" stroke={e.color} strokeWidth="2" /> : null}
          </pattern>
        );
      })}
    </defs>
  );
}

export function relleno(id: string, indice: number): string {
  const e = estiloDe(indice);
  return e.patron === 'solido' ? e.color : `url(#${id}-p${indice})`;
}

/** Forma de la marca de un punto de línea, centrada en (cx, cy). */
export function Marca({ forma, cx, cy, color, r = 4 }: { forma: EstiloDeSerie['marca']; cx: number; cy: number; color: string; r?: number }) {
  const comun = { fill: color, stroke: 'var(--color-superficie)', strokeWidth: 1.5 };
  if (forma === 'cuadrado') return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} {...comun} />;
  if (forma === 'rombo') return <path d={`M${cx} ${cy - r - 1}L${cx + r + 1} ${cy}L${cx} ${cy + r + 1}L${cx - r - 1} ${cy}Z`} {...comun} />;
  if (forma === 'triangulo') return <path d={`M${cx} ${cy - r - 1}L${cx + r + 1} ${cy + r}L${cx - r - 1} ${cy + r}Z`} {...comun} />;
  return <circle cx={cx} cy={cy} r={r} {...comun} />;
}

/** Leyenda con el mismo patrón o marca que el gráfico. */
export function Leyenda({ id, series, tipo }: { id: string; series: SerieDeGrafico[]; tipo: 'barras' | 'linea' }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-texto-suave">
      {series.map((s, i) => {
        const e = estiloDe(i);
        return (
          <li key={s.nombre} className="flex items-center gap-2">
            <svg width="24" height="14" aria-hidden="true">
              {tipo === 'barras' ? (
                <rect x="1" y="1" width="22" height="12" fill={relleno(id, i)} stroke={e.color} strokeWidth="1.5" />
              ) : (
                <>
                  <line x1="0" x2="24" y1="7" y2="7" stroke={e.color} strokeWidth="2.5" strokeDasharray={e.trazo || undefined} />
                  <Marca forma={e.marca} cx={12} cy={7} color={e.color} r={3.5} />
                </>
              )}
            </svg>
            {s.nombre}
          </li>
        );
      })}
    </ul>
  );
}

/** Descripción corta para lectores de pantalla. */
export function describir(etiqueta: string, series: SerieDeGrafico[], formato: (n: number) => string): string {
  const cats = categoriasDe(series);
  let mejor: { y: number; x: string; serie: string } | null = null;
  for (const s of series) for (const p of s.puntos) if (!mejor || p.y > mejor.y) mejor = { y: p.y, x: p.x, serie: s.nombre };
  const partes = [`${etiqueta}.`, `${series.length} ${series.length === 1 ? 'serie' : 'series'}, ${cats.length} ${cats.length === 1 ? 'categoría' : 'categorías'}.`];
  if (mejor) partes.push(`Valor más alto: ${formato(mejor.y)} (${mejor.serie}, ${mejor.x}).`);
  partes.push('Los datos completos están en la tabla «Ver datos».');
  return partes.join(' ');
}

/** Tabla con los mismos números del gráfico, desplegable. */
export function TablaAlternativa({ etiqueta, series, formato }: { etiqueta: string; series: SerieDeGrafico[]; formato: (n: number) => string }) {
  const cats = categoriasDe(series);
  return (
    <details className="group text-sm">
      <summary className="flex min-h-11 w-fit cursor-pointer items-center rounded-control px-1 font-medium text-info underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-foco">
        Ver datos
        <span className="sr-only"> de {etiqueta}</span>
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left tabular-nums">
          <caption className="sr-only">{etiqueta}</caption>
          <thead>
            <tr className="border-b border-borde-fuerte">
              <th scope="col" className="px-2 py-1 font-semibold text-texto"> </th>
              {series.map((s) => (
                <th key={s.nombre} scope="col" className="px-2 py-1 text-right font-semibold text-texto">
                  {s.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((x) => (
              <tr key={x} className="border-b border-borde">
                <th scope="row" className="px-2 py-1 font-normal text-texto">
                  {x}
                </th>
                {series.map((s) => {
                  const v = valorEn(s, x);
                  return (
                    <td key={s.nombre} className="px-2 py-1 text-right text-texto">
                      {v === null ? '—' : formato(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Estado vacío compacto del gráfico. */
export function GraficoVacio({ etiqueta, altura }: { etiqueta: string; altura: number }) {
  return (
    <figure aria-label={etiqueta} className="m-0 flex flex-col gap-2">
      <div style={{ minHeight: altura }} className="grid place-items-center rounded-control border border-dashed border-borde-fuerte bg-superficie p-4 text-center">
        <p className="text-texto-suave">Sin datos para mostrar en «{etiqueta}».</p>
      </div>
    </figure>
  );
}

export function MarcoDeGrafico({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <figure aria-label={etiqueta} className="m-0 flex flex-col gap-2 rounded-control border border-borde bg-superficie p-3">
      <figcaption className="font-titulo font-semibold text-texto">{etiqueta}</figcaption>
      {children}
    </figure>
  );
}

export const MARGEN = { izq: 48, der: 12, arr: 10, abajo: 30 } as const;
