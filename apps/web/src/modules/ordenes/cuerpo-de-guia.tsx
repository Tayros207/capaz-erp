import { BloqueDeDatos, LineaDeFirma, TablaImprimible } from '../../shared/impresion/hoja-imprimible.tsx';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { filasDeGuia, paresDeDestinatario, paresDeTraslado, type GuiaParaImprimir } from './guias.ts';

const COLUMNAS_GUIA = [
  { clave: 'n', titulo: 'N.º', ancho: '10mm' },
  { clave: 'pedido', titulo: 'Pedido', ancho: '38mm' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'cantidad', titulo: 'Cantidad', alineacion: 'derecha', ancho: '30mm' },
] as const;

/** Contenido de la hoja de la guía: igual para la vista previa y para la guía guardada. */
export function CuerpoDeGuia({ guia }: { guia: GuiaParaImprimir }) {
  const t = guia.traslado;
  return (
    <>
      <BloqueDeDatos titulo="Destinatario" pares={paresDeDestinatario(guia)} />
      <BloqueDeDatos titulo="Traslado" pares={paresDeTraslado(t)} />
      <TablaImprimible etiqueta="Bienes trasladados" columnas={[...COLUMNAS_GUIA]} filas={filasDeGuia(guia.lineas)} />
      <BloqueDeDatos columnas={1} pares={[{ etiqueta: 'Bultos', valor: t.bultos }, { etiqueta: 'Observaciones', valor: t.observaciones }]} />
      {guia.anulacion ? (
        <BloqueDeDatos titulo="Anulación" columnas={1} pares={[{ etiqueta: 'Anulada el', valor: formatearFechaHora(guia.anulacion.en) }, { etiqueta: 'Motivo', valor: guia.anulacion.motivo }]} />
      ) : null}
      <div className="flex flex-wrap justify-between gap-x-8">
        <LineaDeFirma etiqueta="Entregado por" detalle="Nombre y firma" />
        <LineaDeFirma etiqueta="Recibido conforme" detalle="Nombre, DNI, fecha y hora" />
      </div>
    </>
  );
}
