import { Cifra, GrupoDeCifras } from '../../../shared/ui/cifra.tsx';
import { mostrarDecimal } from '../logica-taller.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

/** Cuántas piezas caben en el pliego y cuántos pliegos hacen falta, tal como los calculó el servidor. */
export function DesgloseDePliegos({ vista }: ContextoDelCuadro) {
  const c = vista.imposicion.calculada;
  if (!c) return null;
  return (
    <Seccion titulo="Desglose de pliegos">
      <GrupoDeCifras etiqueta="Pliegos del trabajo" angosto>
        <Cifra etiqueta="Piezas por pliego" valor={c.poses} ayuda={`${c.columnas} × ${c.filas}${c.girada ? ', girada' : ''}`} />
        <Cifra etiqueta="Pliegos netos" valor={c.pliegosNetos} />
        <Cifra etiqueta="Pliegos de máquina" valor={c.pliegosDeMaquina} ayuda="Con las mermas" />
        <Cifra etiqueta="Pliegos madre" valor={c.pliegosMadre} ayuda={`${c.pliegosPorMadre} de máquina por cada madre`} />
      </GrupoDeCifras>
      {c.etapas.length ? (
        <ol aria-label="Etapas de merma" className="flex flex-col gap-1 text-sm text-texto-suave">
          {c.etapas.map((e) => <li key={e.nombre}>{e.nombre}: entran {e.entrada}, salen {e.salida} (merma {mostrarDecimal(e.mermaPct)} % + {e.arranque} hojas)</li>)}
        </ol>
      ) : null}
    </Seccion>
  );
}
