import { useRef } from 'react';
import {
  FORMATO_POR_DEFECTO, GraficoVacio, Leyenda, MARGEN, MarcoDeGrafico, PatronesDeSerie, TablaAlternativa,
  describir, estiloDe, relleno, useAncho, useIdSvg, type PropsDeGrafico,
} from './grafico-comun.tsx';
import { calcularEscala, categoriasDe, pasoDeEtiquetas, posicionY, sinDatos, valorEn } from './logica-grafico.ts';

/** Barras agrupadas por categoría. Cada serie lleva color y patrón propios; los números están en la tabla «Ver datos». */
export function GraficoDeBarras({ etiqueta, series, formato = FORMATO_POR_DEFECTO, altura = 240 }: PropsDeGrafico) {
  const id = useIdSvg();
  const caja = useRef<HTMLDivElement>(null);
  const ancho = useAncho(caja);
  if (sinDatos(series)) return <GraficoVacio etiqueta={etiqueta} altura={altura} />;

  const escala = calcularEscala(series);
  const cats = categoriasDe(series);
  const areaAncho = ancho - MARGEN.izq - MARGEN.der;
  const areaAlto = altura - MARGEN.arr - MARGEN.abajo;
  const banda = areaAncho / cats.length;
  const hueco = Math.min(12, banda * 0.2);
  const anchoBarra = Math.max(2, (banda - hueco * 2) / series.length - 2);
  const paso = pasoDeEtiquetas(cats.length, areaAncho);
  const y0 = posicionY(0, escala, areaAlto);

  return (
    <MarcoDeGrafico etiqueta={etiqueta}>
      <Leyenda id={id} series={series} tipo="barras" />
      <div ref={caja} className="w-full">
        <svg width={ancho} height={altura} role="img" aria-label={describir(etiqueta, series, formato)} className="block max-w-full overflow-visible">
          <PatronesDeSerie id={id} cantidad={series.length} />
          <g transform={`translate(${MARGEN.izq} ${MARGEN.arr})`}>
            {escala.marcas.map((m) => {
              const y = posicionY(m, escala, areaAlto);
              return (
                <g key={m}>
                  <line x1={0} x2={areaAncho} y1={y} y2={y} stroke="var(--color-borde)" strokeWidth={m === 0 ? 0 : 1} />
                  <text x={-8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="var(--color-texto-suave)">
                    {formato(m)}
                  </text>
                </g>
              );
            })}
            <line x1={0} x2={areaAncho} y1={y0} y2={y0} stroke="var(--color-borde-fuerte)" strokeWidth={1.5} />
            {cats.map((x, ci) => (
              <g key={x} transform={`translate(${ci * banda + hueco} 0)`}>
                {series.map((s, si) => {
                  const v = valorEn(s, x);
                  if (v === null) return null;
                  const y = posicionY(v, escala, areaAlto);
                  const e = estiloDe(si);
                  return (
                    <rect key={s.nombre} x={si * (anchoBarra + 2)} y={Math.min(y, y0)} width={anchoBarra} height={Math.max(v === 0 ? 0 : 1, Math.abs(y0 - y))} fill={relleno(id, si)} stroke={e.color} strokeWidth={1.5}>
                      <title>{`${s.nombre} · ${x}: ${formato(v)}`}</title>
                    </rect>
                  );
                })}
              </g>
            ))}
            {cats.map((x, ci) =>
              ci % paso === 0 ? (
                <text key={x} x={ci * banda + banda / 2} y={areaAlto + 18} textAnchor="middle" fontSize="12" fill="var(--color-texto-suave)">
                  {x}
                </text>
              ) : null,
            )}
          </g>
        </svg>
      </div>
      <TablaAlternativa etiqueta={etiqueta} series={series} formato={formato} />
    </MarcoDeGrafico>
  );
}
