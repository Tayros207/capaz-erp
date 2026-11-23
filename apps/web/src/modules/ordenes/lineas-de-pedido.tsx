import { textoDeFicha } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { importeDeLinea, totalesDe, type LineaDeFormulario } from './logica.ts';

const soles = (centimos: number | null) => (centimos === null ? '—' : formatearSoles(centimos));

type Props = { lineas: LineaDeFormulario[]; igvPorcentaje: number };

/** El detalle del pedido y sus totales, solo lectura (la edición es en línea: `FilasDePedido`). */
export function LineasDePedido({ lineas, igvPorcentaje }: Props) {
  const totales = totalesDe(lineas, igvPorcentaje);
  const columnas: Array<Columna<LineaDeFormulario>> = [
    { id: 'numero', titulo: 'N.º', alinear: 'derecha', celda: (l) => lineas.indexOf(l) + 1 },
    {
      id: 'descripcion',
      titulo: 'Descripción',
      principal: true,
      celda: (l) => {
        const ficha = textoDeFicha(l);
        return (
          <span className="flex flex-col gap-0.5">
            <span className="inline-flex flex-wrap items-center gap-2">
              {l.descripcion || 'Línea sin descripción'}
              {l.afectoIgv || igvPorcentaje === 0 ? null : <Insignia tono="neutro">No afecto</Insignia>}
            </span>
            {ficha ? <span className="break-words text-sm text-texto-suave">Ficha: {ficha}</span> : null}
          </span>
        );
      },
    },
    { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (l) => (l.cantidadMilesimas === null ? '—' : formatearCantidad(l.cantidadMilesimas, l.unidad)) },
    { id: 'precio', titulo: 'Precio unitario', alinear: 'derecha', celda: (l) => (l.precioUnitarioMilesimas === null ? '—' : `S/ ${milesimasATexto(l.precioUnitarioMilesimas)}`) },
    { id: 'importe', titulo: 'Importe', alinear: 'derecha', celda: (l) => soles(importeDeLinea(l)) },
  ];
  return (
    <section aria-label="Detalle del pedido" className="flex flex-col gap-3">
      <h2 className="font-titulo font-semibold text-texto">Detalle</h2>
      <Lista etiqueta="Detalle del pedido" columnas={columnas} filas={lineas} clave={(l) => l.clave} vacio={<EstadoVacio titulo="Sin líneas" descripcion="Este pedido no tiene líneas." icono="caja" />} />
      <GrupoDeCifras etiqueta="Totales del pedido">
        {igvPorcentaje > 0 ? <Cifra etiqueta="Subtotal" valor={soles(totales?.subtotalCentimos ?? null)} /> : null}
        {igvPorcentaje > 0 ? <Cifra etiqueta={`IGV ${igvPorcentaje} %`} valor={soles(totales?.igvCentimos ?? null)} /> : null}
        <Cifra etiqueta="Total" valor={soles(totales?.totalCentimos ?? null)} {...(igvPorcentaje > 0 && { ayuda: 'Los precios ya incluyen IGV.' })} />
      </GrupoDeCifras>
    </section>
  );
}
