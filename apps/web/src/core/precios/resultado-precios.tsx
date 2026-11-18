import { Link } from 'react-router';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { diaATexto, ETIQUETA_DE_FUENTE, rutaDelDocumento, type PrecioAnterior } from '../../shared/api/logica-precio-anterior.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';

const ENLACE = 'rounded-control font-medium text-accion underline-offset-2 hover:underline';

function Etiqueta({ f }: { f: PrecioAnterior }) {
  if (f.fuente === 'cotizacion') return <Insignia tono="aviso">Cotizado</Insignia>;
  return <Insignia tono={f.fuente === 'pedido' ? 'info' : 'neutro'}>{ETIQUETA_DE_FUENTE[f.fuente]}</Insignia>;
}

/** El precio con su base de IGV a la vista; una orden de trabajo se muestra tal cual, con su nota. */
function PrecioConBase({ f, grande }: { f: PrecioAnterior; grande?: boolean }) {
  const precio = `S/ ${milesimasATexto(f.precioUnitarioMilesimas)}`;
  const resto =
    f.baseDePrecio === 'con_igv' ? { texto: 'con IGV', otro: f.precioSinIgvMilesimas, otroTexto: 'sin IGV' }
    : f.baseDePrecio === 'sin_igv' ? { texto: 'sin IGV', otro: f.precioConIgvMilesimas, otroTexto: 'con IGV' }
    : null;
  return (
    <span className="flex flex-col">
      <span className={grande ? 'font-titulo text-3xl font-semibold tracking-tight tabular-nums text-texto' : 'font-medium tabular-nums text-texto'}>
        {precio}<span className="text-sm font-normal text-texto-suave"> por {f.unidad} · {resto ? resto.texto : 'precio final acordado'}</span>
      </span>
      {resto?.otro != null ? <span className="text-sm tabular-nums text-texto-suave">S/ {milesimasATexto(resto.otro)} {resto.otroTexto}</span> : null}
    </span>
  );
}

/** El último precio: lo que se le cobró (o se le cotizó) la vez anterior, con el documento del que salió. */
export function TarjetaDelUltimo({ f }: { f: PrecioAnterior }) {
  const cotizado = f.fuente === 'cotizacion';
  return (
    <section aria-label={cotizado ? 'Último precio cotizado' : 'Último precio cobrado'} className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-base font-semibold text-texto">{cotizado ? 'Último precio cotizado' : 'Último precio cobrado'}</h2>
        <Etiqueta f={f} />
      </div>
      <PrecioConBase f={f} grande />
      <p className="text-texto">{f.descripcion}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Dato etiqueta="Total de la línea" valor={formatearSoles(f.importeCentimos)} />
        <Dato etiqueta="Cantidad" valor={formatearCantidad(f.cantidadMilesimas, f.unidad)} />
        <Dato etiqueta="Fecha" valor={diaATexto(f.documento.fecha)} />
        <div className="flex flex-col gap-0.5">
          <dt className="text-texto-suave">Documento</dt>
          <dd><Link to={rutaDelDocumento(f)} className={ENLACE}>{f.documento.codigo}</Link></dd>
        </div>
      </dl>
      {f.fuente === 'orden_trabajo' ? <p className="text-sm text-texto-suave">Es el precio final acordado en la orden de trabajo: no trae desglose de IGV.</p> : null}
      {cotizado ? <p className="text-sm text-texto-suave">Solo hay una cotización de este producto: aún no hay un pedido ni una orden de trabajo.</p> : null}
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-texto-suave">{etiqueta}</dt>
      <dd className="font-medium tabular-nums text-texto">{valor}</dd>
    </div>
  );
}

/** Las veces anteriores, de la más nueva a la más antigua; las «parecidas» se marcan para no confundirlas. */
export function HistorialDePrecios({ filas, conCliente }: { filas: PrecioAnterior[]; conCliente: boolean }) {
  if (filas.length === 0) return null;
  return (
    <section aria-label="Veces anteriores" className="flex flex-col gap-2">
      <h2 className="font-titulo text-base font-semibold text-texto">Veces anteriores</h2>
      <ul className="flex flex-col gap-2">
        {filas.map((f, i) => (
          <li key={`${f.documento.id}-${i}`} className="grid gap-x-4 gap-y-2 rounded-tarjeta border border-borde bg-superficie p-3 md:grid-cols-[6rem_9rem_minmax(0,1fr)_7rem_minmax(0,14rem)] md:items-center">
            <span className="tabular-nums text-texto">{diaATexto(f.documento.fecha)}</span>
            <span className="flex flex-wrap items-center gap-1">
              <Link to={rutaDelDocumento(f)} className={ENLACE}>{f.documento.codigo}</Link>
              <Etiqueta f={f} />
            </span>
            <span className="min-w-0 text-texto">
              {f.descripcion}
              {conCliente ? null : <span className="block text-sm text-texto-suave">{f.cliente.nombre}</span>}
              {f.coincidencia === 'parecida' ? <span className="ml-2 align-middle"><Insignia tono="neutro">Parecido</Insignia></span> : null}
            </span>
            <span className="tabular-nums text-sm text-texto-suave md:text-right">{formatearCantidad(f.cantidadMilesimas, f.unidad)}</span>
            <span className="md:text-right"><PrecioConBase f={f} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
