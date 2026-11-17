import { Link } from 'react-router';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { Cifra, GrupoDeCifras } from '../../../shared/ui/cifra.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { ETIQUETA_DE_SEMAFORO, rutaDeCuadro, textoDeImporte, textoDePorcentaje } from './logica-cuadro.ts';

/** En la ficha de una cotización por partes: el acceso al cuadro y el resumen del recibo (costos solo con permiso). */
export function ResumenDelCuadro({ c }: { c: CotizacionCompletaDto }) {
  const cuadro = c.cuadro;
  if (c.modo !== 'cuadro' || !cuadro) return null;
  const costos = cuadro.interno?.costos;
  const sem = costos?.semaforo ? ETIQUETA_DE_SEMAFORO[costos.semaforo] : null;
  return (
    <section aria-label="Cuadro por partes" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-titulo font-semibold text-texto">Cuadro por partes</h2>
        <Link to={rutaDeCuadro(c.id)} className="inline-flex min-h-(--alto-control) items-center rounded-control border border-borde bg-superficie px-3.5 text-sm font-medium text-texto hover:border-borde-fuerte">Abrir el cuadro</Link>
      </div>
      <GrupoDeCifras etiqueta="Recibo del cuadro">
        <Cifra etiqueta="Precio (sin IGV)" valor={textoDeImporte(cuadro.comercial?.precioCentimos ?? null)} />
        {costos ? <Cifra etiqueta="Costo" valor={textoDeImporte(costos.costoCentimos)} /> : null}
        {costos ? <Cifra etiqueta="Margen" valor={textoDePorcentaje(costos.margenPct)} /> : null}
      </GrupoDeCifras>
      {sem ? <div><Insignia tono={sem.tono}>{sem.texto}</Insignia></div> : null}
    </section>
  );
}
