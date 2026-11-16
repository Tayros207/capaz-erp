import type { BloqueDelPanelDto } from '@capaz/shared';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { GraficoDeLinea } from '../../shared/ui/grafico-de-linea.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { seriesParaGrafico, tonoDeIndicador, valorDeIndicador } from './logica.ts';

/** Un módulo del panel: sus cifras y, solo si entregó una serie en el tiempo, su gráfico. */
export function BloqueDeModulo({ bloque }: { bloque: BloqueDelPanelDto }) {
  const graficos = seriesParaGrafico(bloque);
  return (
    <section aria-label={bloque.nombre} className="flex flex-col gap-3">
      <h2 className="flex flex-wrap items-center gap-2 font-titulo text-lg font-semibold text-texto">
        {bloque.nombre}
        {bloque.soloLectura ? <Insignia tono="aviso">Solo lectura</Insignia> : null}
      </h2>
      {bloque.indicadores.length === 0 ? (
        <p className="text-texto-suave">Este módulo no tiene cifras para el período.</p>
      ) : (
        <GrupoDeCifras etiqueta={`Cifras de ${bloque.nombre}`}>
          {bloque.indicadores.map((i) => (
            <Cifra key={i.id} etiqueta={i.etiqueta} valor={valorDeIndicador(i)} tono={tonoDeIndicador(i)} />
          ))}
        </GrupoDeCifras>
      )}
      {graficos.map((g) => (
        <GraficoDeLinea key={g.id} etiqueta={g.nombre} series={g.series} formato={g.formato} />
      ))}
    </section>
  );
}
