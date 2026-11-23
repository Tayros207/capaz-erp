import type { PrecioConsultadoDto } from '@capaz/shared';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { soles } from './logica.ts';
import { avisosDeRapida, TEXTO_DE_ESTIMACION, TEXTO_DE_TRAMOS, TEXTO_DE_UNITARIO } from './logica-precio.ts';
import { PreciosIntermedios } from './precios-intermedios.tsx';

/** El precio de la cantidad pedida: importe, IGV y total; insignias y avisos de lo que lo explica; y la tabla por cantidad. */
export function ResultadoRapido({ precio }: { precio: PrecioConsultadoDto }) {
  const avisos = avisosDeRapida(precio);
  const conIgv = precio.igvPorcentaje > 0;
  const ajustado = precio.importeCentimos !== precio.precioListaCentimos;
  return (
    <section aria-label="Resultado" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Insignia tono="neutro">Unitario informativo</Insignia>
        {precio.minimoAplicado ? <Insignia tono="aviso">Precio mínimo aplicado</Insignia> : null}
        {ajustado ? <Insignia tono="info">Ajustado solo para esta cotización</Insignia> : null}
        {avisos.estimacion ? <Insignia tono="aviso">Precio estimado</Insignia> : null}
      </div>
      <GrupoDeCifras etiqueta="Precio de esta cantidad">
        <Cifra etiqueta={conIgv ? 'Precio (sin IGV)' : 'Precio'} valor={soles(precio.importeCentimos)} ayuda={ajustado ? `Precio de lista: ${soles(precio.precioListaCentimos)}` : undefined} />
        {conIgv ? <Cifra etiqueta={`IGV (${precio.igvPorcentaje} %)`} valor={soles(precio.igvCentimos)} /> : null}
        {conIgv ? <Cifra etiqueta="Total" valor={soles(precio.totalCentimos)} tono="exito" /> : null}
        <Cifra etiqueta={`Cada ${precio.unidad}`} valor={`S/ ${milesimasATexto(precio.precioUnitarioMilesimas)}`} ayuda={conIgv ? 'Sin IGV · informativo' : 'Informativo'} />
      </GrupoDeCifras>
      <ul className="flex flex-col gap-1 text-sm text-texto-suave">
        {precio.ajusteClientePct ? <li>Incluye el ajuste del cliente ({precio.ajusteClientePct} %).</li> : null}
        {precio.minimoAplicado ? <li>Se aplicó el precio mínimo de la lista.</li> : null}
        {avisos.estimacion ? <li role="note">{TEXTO_DE_ESTIMACION}</li> : null}
        {avisos.cambiaPorTramos ? <li role="note">{TEXTO_DE_TRAMOS}</li> : null}
        <li>{TEXTO_DE_UNITARIO}</li>
      </ul>
      <PreciosIntermedios tabla={precio.tabla} cantidadActual={precio.cantidadMilesimas} conIgv={conIgv} />
    </section>
  );
}
