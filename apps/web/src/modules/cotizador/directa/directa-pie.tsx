import { useNavigate } from 'react-router';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { resolverAccion } from '../acciones.ts';
import { enviarPorWhatsApp } from '../acciones-cotizacion.ts';
import { marcarEnviada } from '../api-cotizaciones.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { Cifra, GrupoDeCifras } from '../../../shared/ui/cifra.tsx';
import { rutaDeDocumento, rutaDeFicha } from '../logica-cotizaciones.ts';
import { soles } from '../logica.ts';
import { totalesDeHoja, type HojaDirecta } from './logica-directa.ts';

type Props = {
  hoja: HojaDirecta;
  igv: number;
  opcionesDeValidez: number[];
  emitida: CotizacionCompletaDto | null;
  emitiendo: boolean;
  alCambiar: (cambio: Partial<HojaDirecta>) => void;
  alEmitir: () => void;
  alNuevaHoja: () => void;
};

/** Totales, casilla del IGV, condiciones y acciones de la hoja. */
export function DirectaPie({ hoja, igv, opcionesDeValidez, emitida, emitiendo, alCambiar, alEmitir, alNuevaHoja }: Props) {
  const navegar = useNavigate();
  const t = totalesDeHoja(hoja.filas, hoja.incluyeIgv, igv);
  const soloLectura = emitida !== null;
  // Con la cotización emitida, los totales son los que guardó el servidor.
  const cifras = emitida ?? { subtotalCentimos: t.subtotalCentimos, igvCentimos: t.igvCentimos, totalCentimos: t.totalCentimos };
  const validez = opcionesDeValidez.includes(hoja.validezDias) ? opcionesDeValidez : [...opcionesDeValidez, hoja.validezDias].sort((a, b) => a - b);
  const enviarYMarcar = async () => {
    if (emitida && (await enviarPorWhatsApp(emitida))) await resolverAccion(marcarEnviada(emitida.id), 'Marcada como enviada.');
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-11 items-center gap-2 text-sm text-texto">
        <input type="checkbox" className="size-4" checked={hoja.incluyeIgv} disabled={soloLectura} onChange={(e) => alCambiar({ incluyeIgv: e.target.checked })} />
        Los precios ya incluyen IGV
      </label>
      <GrupoDeCifras etiqueta="Totales de la cotización">
        <Cifra etiqueta="Subtotal" valor={soles(cifras.subtotalCentimos)} />
        <Cifra etiqueta={`IGV ${igv} %`} valor={soles(cifras.igvCentimos)} />
        <Cifra etiqueta="Total" valor={soles(cifras.totalCentimos)} />
      </GrupoDeCifras>
      <section aria-label="Condiciones" className="grid gap-4 sm:grid-cols-3">
        <CampoSelect etiqueta="Válida por" value={String(hoja.validezDias)} disabled={soloLectura} onChange={(e) => alCambiar({ validezDias: Number(e.target.value) })}>
          {validez.map((d) => <option key={d} value={d}>{d} días</option>)}
        </CampoSelect>
        <Campo etiqueta="Plazo de entrega" maxLength={300} value={hoja.plazoEntrega} readOnly={soloLectura} onChange={(e) => alCambiar({ plazoEntrega: e.target.value })} />
        <Campo etiqueta="Forma de pago" maxLength={300} value={hoja.formaPago} readOnly={soloLectura} onChange={(e) => alCambiar({ formaPago: e.target.value })} />
      </section>
      <div className="flex flex-wrap items-center gap-2">
        {emitida ? null : <Boton variante="primario" cargando={emitiendo} onClick={alEmitir}>Emitir</Boton>}
        <Boton disabled={!emitida} onClick={() => emitida && void navegar(rutaDeDocumento(emitida.id))}>Imprimir / PDF</Boton>
        <Boton disabled={!emitida || !emitida.clienteId} onClick={() => void enviarYMarcar()}>WhatsApp</Boton>
        {emitida ? (
          <>
            <Boton onClick={() => void navegar(rutaDeFicha(emitida.id))}>Ver en Cotizaciones</Boton>
            <Boton variante="primario" onClick={alNuevaHoja}>Nueva hoja</Boton>
          </>
        ) : null}
      </div>
    </div>
  );
}
