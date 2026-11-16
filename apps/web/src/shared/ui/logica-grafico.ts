/** Lógica pura de los gráficos: escala, ejes redondos y reducción de etiquetas. Sin React. */

export type PuntoDeGrafico = { x: string; y: number };
export type SerieDeGrafico = { nombre: string; puntos: PuntoDeGrafico[] };

export type Escala = {
  min: number;
  max: number;
  /** Valores del eje Y, de menor a mayor, con paso redondo. */
  marcas: number[];
};

/** Paso «redondo» (1, 2, 2.5, 5 × 10^n) que cubre `rango` en como mucho `objetivo` tramos. */
export function pasoRedondo(rango: number, objetivo: number): number {
  if (!(rango > 0) || objetivo < 1) return 1;
  const crudo = rango / objetivo;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const fraccion = crudo / potencia;
  const base = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 2.5 ? 2.5 : fraccion <= 5 ? 5 : 10;
  return base * potencia;
}

/** Escala del eje Y: incluye siempre el cero; límites múltiplos del paso. Sin datos: 0 a 1. */
export function calcularEscala(series: SerieDeGrafico[], tramos = 4): Escala {
  const valores = series.flatMap((s) => s.puntos.map((p) => p.y)).filter((n) => Number.isFinite(n));
  const minDato = Math.min(0, ...valores);
  const maxDato = Math.max(0, ...valores);
  if (valores.length === 0 || (minDato === 0 && maxDato === 0)) return { min: 0, max: 1, marcas: [0, 1] };
  const paso = pasoRedondo(maxDato - minDato, tramos);
  const min = Math.floor(minDato / paso) * paso;
  const max = Math.ceil(maxDato / paso) * paso;
  const marcas: number[] = [];
  const n = Math.round((max - min) / paso);
  for (let i = 0; i <= n; i++) marcas.push(redondear(min + i * paso, paso));
  return { min, max, marcas };
}

function redondear(n: number, paso: number): number {
  const decimales = paso >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(paso)) + 1);
  return Number(n.toFixed(decimales));
}

/** Posición vertical (0 = arriba) de un valor en una altura dada. */
export function posicionY(valor: number, escala: Escala, alto: number): number {
  const rango = escala.max - escala.min || 1;
  return alto - ((valor - escala.min) / rango) * alto;
}

/** Cada cuántas categorías se muestra una etiqueta para que no se solapen. */
export function pasoDeEtiquetas(categorias: number, anchoDisponible: number, anchoPorEtiqueta = 56): number {
  if (categorias <= 1) return 1;
  const caben = Math.max(1, Math.floor(anchoDisponible / anchoPorEtiqueta));
  return Math.max(1, Math.ceil(categorias / caben));
}

/** Categorías del eje X: unión ordenada por primera aparición entre todas las series. */
export function categoriasDe(series: SerieDeGrafico[]): string[] {
  const vistas = new Set<string>();
  for (const s of series) for (const p of s.puntos) vistas.add(p.x);
  return [...vistas];
}

/** Valor de una serie en una categoría (0 si no tiene punto; se anota en la tabla como «—» aparte). */
export function valorEn(serie: SerieDeGrafico, x: string): number | null {
  const p = serie.puntos.find((q) => q.x === x);
  return p ? p.y : null;
}

export function sinDatos(series: SerieDeGrafico[]): boolean {
  return series.every((s) => s.puntos.length === 0);
}
