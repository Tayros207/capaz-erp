import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import type { FilaDeRecepcion, VistaPrevia } from './logica-recepcion.ts';

type Props = {
  filas: FilaDeRecepcion[];
  errores: Record<string, string>;
  alCambiar: (ordenLineaId: string, cantidadMilesimas: number | null) => void;
};

/** Una fila por línea con algo pendiente: lo pedido, lo ya recibido, lo que falta y cuánto llegó ahora. */
export function FilasDeRecepcion({ filas, errores, alCambiar }: Props) {
  return (
    <ul aria-label="Líneas por recibir" className="flex flex-col divide-y divide-borde">
      {filas.map((f) => (
        <li key={f.ordenLineaId} className="grid gap-3 py-3 sm:grid-cols-[1fr_14rem] sm:items-start">
          <div className="flex flex-col gap-1">
            <span className="break-words font-medium text-texto">{f.descripcion}</span>
            <span className="text-sm text-texto-suave">
              Pedido {formatearCantidad(f.pedidoMilesimas, f.unidad)} · Recibido {formatearCantidad(f.recibidoMilesimas, f.unidad)}
            </span>
            <span className="inline-flex">
              <Insignia tono="aviso">Falta {formatearCantidad(f.pendienteMilesimas, f.unidad)}</Insignia>
            </span>
          </div>
          <CampoCantidad
            etiqueta={`Llegó de ${f.descripcion}`}
            valor={f.cantidadMilesimas}
            unidad={f.unidad}
            error={errores[f.ordenLineaId]}
            ayuda="Vacío si no llegó nada."
            alCambiar={(v) => alCambiar(f.ordenLineaId, v)}
          />
        </li>
      ))}
    </ul>
  );
}

/** Lo que se va a registrar y cómo quedará la orden. */
export function ResumenDeRecepcion({ vista }: { vista: VistaPrevia }) {
  return (
    <GrupoDeCifras etiqueta="Lo que se registra">
      <Cifra etiqueta="Líneas que llegan" valor={String(vista.lineas)} />
      <Cifra etiqueta="Valor de lo recibido" valor={vista.importeCentimos === null ? '—' : formatearSoles(vista.importeCentimos)} ayuda="Con IGV incluido." />
      <Cifra etiqueta="La orden quedará" valor={vista.completa ? 'Recibida' : 'Recibida en parte'} tono={vista.completa ? 'exito' : 'aviso'} />
    </GrupoDeCifras>
  );
}
