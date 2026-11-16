import { useRef } from 'react';
import {
  FORMATO_POR_DEFECTO, GraficoVacio, Leyenda, MARGEN, Marca, MarcoDeGrafico, TablaAlternativa,
  describir, estiloDe, useAncho, useIdSvg, type PropsDeGrafico,
} from './grafico-comun.tsx';
import { calcularEscala, categoriasDe, pasoDeEtiquetas, posicionY, sinDatos } from './logica-grafico.ts';

/** Líneas por serie con trazo y marca distintos por serie; los números están en la tabla «Ver datos». */
export function GraficoDeLinea({ etiqueta, series, formato = FORMATO_POR_DEFECTO, altura = 240 }: PropsDeGrafico) {
  const id = useIdSvg();
  const caja = useRef<HTMLDivElement>(null);
  const ancho = useAncho(caja);
  if (sinDatos(series)) return <GraficoVacio etiqueta={etiqueta} altura={altura} />;

  const escala = calcularEscala(series);
  const cats = categoriasDe(series);
  const areaAncho = ancho - MARGEN.izq - MARGEN.der;
  const areaAlto = altura - MARGEN.arr - MARGEN.abajo;
  const banda = areaAncho / cats.length;
  const paso = pasoDeEtiquetas(cats.length, areaAncho);
  const px = (x: string) => cats.indexOf(x) * banda + banda / 2;

  return (
    <MarcoDeGrafico etiqueta={etiqueta}>
      <Leyenda id={id} series={series} tipo="linea" />
      <div ref={caja} className="w-full">
        <svg width={ancho} height={altura} role="img" aria-label={describir(etiqueta, series, formato)} className="block max-w-full overflow-visible">
          <g transform={`translate(${MARGEN.izq} ${MARGEN.arr})`}>
            {escala.marcas.map((m) => {
              const y = posicionY(m, escala, areaAlto);
              return (
                <g key={m}>
                  <line x1={0} x2={areaAncho} y1={y} y2={y} stroke={m === 0 ? 'var(--color-borde-fuerte)' : 'var(--color-borde)'} strokeWidth={m === 0 ? 1.5 : 1} />
                  <text x={-8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="var(--color-texto-suave)">
                    {formato(m)}
                  </text>
                </g>
              );
            })}
            {series.map((s, si) => {
              const e = estiloDe(si);
              const pts = s.puntos.map((p) => ({ ...p, cx: px(p.x), cy: posicionY(p.y, escala, areaAlto) }));
              return (
                <g key={s.nombre}>
                  {pts.length > 1 ? (
                    <polyline points={pts.map((p) => `${p.cx},${p.cy}`).join(' ')} fill="none" stroke={e.color} strokeWidth={2.5} strokeDasharray={e.trazo || undefined} strokeLinejoin="round" strokeLinecap="round" />
                  ) : null}
                  {pts.map((p) => (
                    <g key={p.x}>
                      <Marca forma={e.marca} cx={p.cx} cy={p.cy} color={e.color} />
                      <title>{`${s.nombre} · ${p.x}: ${formato(p.y)}`}</title>
                    </g>
                  ))}
                </g>
              );
            })}
            {cats.map((x, ci) =>
              ci % paso === 0 ? (
                <text key={x} x={px(x)} y={areaAlto + 18} textAnchor="middle" fontSize="12" fill="var(--color-texto-suave)">
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
