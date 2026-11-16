import type { ReactNode } from 'react';
import { GraficoDeBarras } from '../../shared/ui/grafico-de-barras.tsx';
import { GraficoDeLinea } from '../../shared/ui/grafico-de-linea.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 border-b border-borde pb-1 font-titulo text-xl font-semibold">
        {titulo} <Insignia tono="info">Ola 3</Insignia>
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const serie = (nombre: string, ys: number[]) => ({ nombre, puntos: ys.map((y, i) => ({ x: MESES[i]!, y })) });
const soles = (n: number) => `S/ ${n.toLocaleString('en-US')}`;

const VENTAS = [serie('Ventas', [12000, 15500, 14200, 18900, 21000, 19500, 23100, 24800, 22000, 26500, 28900, 31200]), serie('Gastos', [9000, 10200, 9800, 12400, 13000, 12800, 14500, 15200, 14800, 16100, 17000, 18400])];
const FLUJO = [serie('Flujo neto', [3000, -1200, 4400, 6500, -800, 6700])];

/** Piezas nuevas de la ola 3 (K2): gráficos en SVG propio con tabla alternativa. */
export function KitOla3() {
  return (
    <div className="flex flex-col gap-10">
      <Seccion titulo="Gráfico de barras">
        <GraficoDeBarras etiqueta="Ventas y gastos por mes (12 meses)" series={VENTAS} formato={soles} />
        <GraficoDeBarras etiqueta="Flujo neto con negativos" series={FLUJO} formato={soles} altura={200} />
        <GraficoDeBarras etiqueta="Barras sin datos" series={[{ nombre: 'Ventas', puntos: [] }]} altura={120} />
      </Seccion>
      <Seccion titulo="Gráfico de línea">
        <GraficoDeLinea etiqueta="Tendencia de ventas y gastos (12 meses)" series={VENTAS} formato={soles} />
        <GraficoDeLinea etiqueta="Flujo neto con negativos" series={FLUJO} formato={soles} altura={200} />
        <GraficoDeLinea etiqueta="Un solo punto" series={[serie('Ventas', [500])]} altura={160} />
        <GraficoDeLinea etiqueta="Línea sin datos" series={[]} altura={120} />
      </Seccion>
    </div>
  );
}
