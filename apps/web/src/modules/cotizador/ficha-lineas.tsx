import type { CotizacionCompletaDto } from '@capaz/shared';
import { EnlaceDeEntidad } from '../../shared/ui/entidades.tsx';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { soles } from './logica.ts';
import { TEXTO_DE_LINEA_AJUSTADA, textoDeAjusteDeLinea, textoDePrecioDeLista } from './logica-precio.ts';

type Linea = CotizacionCompletaDto['lineas'][number];

/** La descripción de la línea y, si el precio se ajustó solo para esta cotización, cuánto era el de lista. */
function Descripcion({ l }: { l: Linea }) {
  const texto = l.productoId ? <span>{l.posicion + 1}. <EnlaceDeEntidad tipo="producto" id={l.productoId}>{l.descripcion}</EnlaceDeEntidad></span> : <span>{l.posicion + 1}. {l.descripcion}</span>;
  if (!l.ajuste || l.precioListaCentimos === null) return texto;
  return (
    <span className="flex flex-col items-start gap-1">
      {texto}
      <span className="flex flex-wrap items-center gap-2">
        <Insignia tono="info">{TEXTO_DE_LINEA_AJUSTADA}</Insignia>
        <span className="text-sm text-texto-suave">{textoDePrecioDeLista(l.precioListaCentimos)} · {textoDeAjusteDeLinea(l.ajuste)}</span>
      </span>
    </span>
  );
}

/** Las columnas de las líneas: sin IGV no hay «Total con IGV» y el precio no aclara «sin IGV». */
export const columnasDeLineas = (conIgv: boolean): Array<Columna<Linea>> => [
  { id: 'descripcion', titulo: 'Descripción', principal: true, celda: (l) => <Descripcion l={l} /> },
  { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (l) => formatearCantidad(l.cantidadMilesimas, l.unidad) },
  { id: 'precio', titulo: conIgv ? 'Cada una (sin IGV)' : 'Cada una', alinear: 'derecha', celda: (l) => `S/ ${milesimasATexto(l.precioUnitarioMilesimas)}` },
  { id: 'importe', titulo: 'Importe', alinear: 'derecha', celda: (l) => soles(l.importeCentimos) },
  ...(conIgv ? [{ id: 'total', titulo: 'Total con IGV', alinear: 'derecha' as const, celda: (l: Linea) => soles(l.totalCentimos) }] : []),
];
