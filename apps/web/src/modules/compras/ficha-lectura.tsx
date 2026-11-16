import type { CompraCompletaDto, RecepcionDeCompraDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { COLUMNAS_DE_LINEAS_ENVIADAS } from './columnas.tsx';
import { formatearDia, recibidoCentimos } from './logica.ts';
import { Dato } from './marco.tsx';

/** Datos, líneas (con lo recibido y lo que falta) y totales de una orden que ya no se edita aquí. */
export function FichaLectura({ c }: { c: CompraCompletaDto }) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Proveedor" valor={c.proveedorNombre} />
        <Dato etiqueta="Fecha de la orden" valor={formatearDia(c.fecha)} />
        <Dato etiqueta="Entrega esperada" valor={formatearDia(c.entregaEl)} />
        <Dato etiqueta="Notas para el proveedor" valor={c.notas ?? ''} />
        {c.canceladoEn ? <Dato etiqueta="Cancelada" valor={`${formatearFechaHora(c.canceladoEn)} · ${c.motivoCancelacion ?? ''}`} /> : null}
      </dl>
      <section aria-label="Líneas de la orden" className="flex flex-col gap-3">
        <h2 className="font-titulo font-semibold text-texto">Líneas</h2>
        <Lista etiqueta="Líneas de la orden" columnas={COLUMNAS_DE_LINEAS_ENVIADAS} filas={c.detalle} clave={(l) => l.id} vacio={<EstadoVacio titulo="Sin líneas" descripcion="Esta orden no tiene líneas." icono="caja" />} />
        <GrupoDeCifras etiqueta="Totales de la orden">
          <Cifra etiqueta="Subtotal" valor={formatearSoles(c.subtotalCentimos)} />
          <Cifra etiqueta={`IGV ${c.igvPorcentaje} %`} valor={formatearSoles(c.igvCentimos)} />
          <Cifra etiqueta="Total" valor={formatearSoles(c.totalCentimos)} ayuda="Los costos ya incluyen IGV." />
          {c.recepciones.length > 0 ? <Cifra etiqueta="Recibido" valor={formatearSoles(recibidoCentimos(c))} tono={c.lineasPorRecibir === 0 ? 'exito' : 'aviso'} /> : null}
        </GrupoDeCifras>
      </section>
    </div>
  );
}

const COLUMNAS_DE_RECEPCIONES: Array<Columna<RecepcionDeCompraDto>> = [
  { id: 'numero', titulo: 'Recepción', principal: true, celda: (r) => `N.º ${r.numero}` },
  { id: 'fecha', titulo: 'Llegó el', celda: (r) => formatearDia(r.fecha) },
  { id: 'lineas', titulo: 'Líneas', alinear: 'derecha', celda: (r) => String(r.lineas.length) },
  { id: 'importe', titulo: 'Valor', alinear: 'derecha', celda: (r) => formatearSoles(r.importeCentimos) },
  { id: 'nota', titulo: 'Nota', celda: (r) => r.nota ?? '—' },
];

/** Las recepciones de la orden, de la primera a la última. No se editan ni se borran. */
export function Recepciones({ c }: { c: CompraCompletaDto }) {
  return (
    <section aria-label="Recepciones de la orden" className="flex flex-col gap-3">
      <h2 className="font-titulo font-semibold text-texto">Recepciones</h2>
      <Lista
        etiqueta="Recepciones de la orden"
        columnas={COLUMNAS_DE_RECEPCIONES}
        filas={c.recepciones}
        clave={(r) => r.id}
        vacio={<EstadoVacio titulo="Todavía no llega nada" descripcion="Cuando el proveedor entregue, registra aquí lo que llegó." icono="caja" />}
      />
    </section>
  );
}
