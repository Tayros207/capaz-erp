import { useState } from 'react';
import { avisoDePrecioAntiguo, baseMostrada, diaATexto, ETIQUETA_DE_FUENTE, precioParaUsar, type PrecioAnterior } from '../api/logica-precio-anterior.ts';
import { usePrecioAnterior } from '../api/use-precio-anterior.ts';
import { formatearCantidad, milesimasATexto } from '../formato/milesimas.ts';
import { Boton } from './boton.tsx';
import { Insignia } from './insignia.tsx';

type Props = {
  clienteId: string | null | undefined;
  productoId?: string | null;
  descripcion: string;
  /** Con qué base de IGV se está escribiendo el precio de esta fila. */
  conIgv: boolean;
  /** El precio que la fila tiene ahora (milésimas, en esa misma base): si ya es el sugerido, no se ofrece «Usar». */
  precioActualMilesimas?: number | null;
  /** La persona toca «Usar»: nunca se aplica sola. Sin él, la sugerencia es solo informativa (no hay botón). */
  alUsar?: (precio: PrecioAnterior) => void;
};

/** «Última vez: S/ 118.00 por caja · 50 caja · 10/05/2026 · PED-… [Usar]» bajo la descripción de una fila. */
export function SugerenciaDePrecio({ clienteId, productoId, descripcion, conIgv, precioActualMilesimas, alUsar }: Props) {
  const [hoy] = useState(() => new Date().toLocaleDateString('en-CA'));
  const { precio } = usePrecioAnterior({ clienteId, productoId, descripcion });
  if (!precio) return null;
  const sugerido = precioParaUsar(precio, conIgv);
  const aplicado = precioActualMilesimas === sugerido;
  const cotizado = precio.fuente === 'cotizacion';
  const antiguo = avisoDePrecioAntiguo(precio.documento.fecha, hoy);
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-borde bg-superficie-alta px-3 py-2 text-sm text-texto-suave">
      <span>
        {cotizado ? 'Cotizado: ' : 'Última vez: '}
        <strong className="font-semibold tabular-nums text-texto">S/ {milesimasATexto(sugerido)} por {precio.unidad || 'unidad'}</strong> ({baseMostrada(precio, conIgv)})
        {' · '}{formatearCantidad(precio.cantidadMilesimas, precio.unidad)}
        {' · '}{diaATexto(precio.documento.fecha)}
        {' · '}{precio.documento.codigo}
      </span>
      {cotizado ? <Insignia tono="aviso">Cotizado</Insignia> : <Insignia>{ETIQUETA_DE_FUENTE[precio.fuente]}</Insignia>}
      {antiguo ? <span className="font-medium text-aviso">{antiguo}</span> : null}
      {!alUsar ? null : aplicado ? <span className="font-medium text-exito">Ya aplicado</span> : <Boton variante="secundario" aria-label={`Usar el precio de ${precio.documento.codigo}`} onClick={() => alUsar(precio)}>Usar</Boton>}
    </p>
  );
}
