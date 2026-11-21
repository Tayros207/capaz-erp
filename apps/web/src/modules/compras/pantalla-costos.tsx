import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { CostoPorArticuloDto } from '@capaz/shared';
import { formatearPrecio } from '../../core/productos/logica.ts';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { costosPorArticulo } from './api.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { argumentosDeCostos, errorDePeriodo, hayFiltrosDeCostos, ordenarPorVariacion, proveedorMasBarato, SIN_FILTROS_DE_COSTOS, textoDeCompras, variacionDeCosto, type FiltrosDeCostos } from './logica-costos.ts';
import { formatearDia } from './logica.ts';
import { Cargando } from './marco.tsx';

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="font-medium text-texto">{valor}</dd>
    </div>
  );
}

function DetalleDeProveedores({ a, id }: { a: CostoPorArticuloDto; id: string }) {
  return (
    <ul id={id} className="flex flex-col gap-2 border-t border-borde pt-3">
      {a.porProveedor.map((p) => (
        <li key={p.proveedorId} className="flex flex-col gap-1 rounded-control bg-superficie-alta p-3">
          <span className="flex flex-wrap items-center gap-2 font-medium break-words">
            {p.proveedorNombre}
            {p.proveedorId === a.masBaratoProveedorId ? <Insignia tono="exito">Más barato</Insignia> : null}
          </span>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Dato rotulo="Último costo" valor={formatearPrecio(p.ultimoCostoMilesimas)} />
            <Dato rotulo="Mediana" valor={formatearPrecio(p.medianaMilesimas)} />
            <Dato rotulo="Mínimo" valor={formatearPrecio(p.minimoMilesimas)} />
            <Dato rotulo="Última compra" valor={`${formatearDia(p.ultimaFecha)} · ${textoDeCompras(p.compras)}`} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function TarjetaDeArticulo({ a }: { a: CostoPorArticuloDto }) {
  const [abierto, setAbierto] = useState(false);
  const v = variacionDeCosto(a.variacionPorcentaje);
  const barato = proveedorMasBarato(a);
  const id = `prov-${useId()}`; // la clave del artículo puede traer espacios o «|»: no sirve como id
  return (
    <li className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words text-texto">{a.descripcion}</p>
          <p className="text-sm text-texto-suave">por {a.unidad} · {textoDeCompras(a.compras)} · última {formatearDia(a.ultimaFecha)}</p>
        </div>
        <Insignia tono={v.tono}>{v.texto}</Insignia>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <Dato rotulo="Último costo" valor={formatearPrecio(a.ultimoCostoMilesimas)} />
        <Dato rotulo="Mediana" valor={formatearPrecio(a.medianaMilesimas)} />
        <Dato rotulo="Último proveedor" valor={a.ultimoProveedorNombre} />
        <Dato rotulo="Proveedor más barato" valor={barato ?? 'Un solo proveedor'} />
      </dl>
      {a.porProveedor.length > 0 ? (
        <>
          <Boton variante="fantasma" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((x) => !x)}>
            {abierto ? 'Ocultar proveedores' : `Ver ${a.porProveedor.length === 1 ? '1 proveedor' : `${a.porProveedor.length} proveedores`}`}
          </Boton>
          {abierto ? <DetalleDeProveedores a={a} id={id} /> : null}
        </>
      ) : null}
    </li>
  );
}

/** Comparador de costos de compra por artículo: `/m/compras/costos`. Costos con IGV, en soles por unidad. */
export function PantallaCostos() {
  const [f, setF] = useState<FiltrosDeCostos>(SIN_FILTROS_DE_COSTOS);
  const buscar = useRetardo(f.buscar);
  const error = errorDePeriodo(f);
  const consultado = { ...f, buscar };
  const consulta = useQuery({
    queryKey: [...CLAVE_COMPRAS, 'costos', consultado],
    queryFn: async () => datosOError(await costosPorArticulo(argumentosDeCostos(consultado))),
    enabled: !error,
  });
  const cambiar = (c: Partial<FiltrosDeCostos>) => setF((a) => ({ ...a, ...c }));
  const articulos = consulta.data ? ordenarPorVariacion(consulta.data.articulos) : [];
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Costos por artículo" />
      <p className="text-texto-suave">Cuánto te costó cada artículo en tus compras, con IGV. «Subió» o «Bajó» compara el último costo con el costo típico (la mediana) del período. Sin fechas se muestra el último año.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Buscar artículo" type="search" value={f.buscar} placeholder="Papel, tinta…" onChange={(e) => cambiar({ buscar: e.target.value })} />
        <Campo etiqueta="Desde" type="date" value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={f.hasta} error={error} onChange={(e) => cambiar({ hasta: e.target.value })} />
      </div>
      {hayFiltrosDeCostos(f) ? <div><Boton variante="fantasma" icono="cerrar" onClick={() => setF(SIN_FILTROS_DE_COSTOS)}>Limpiar filtros</Boton></div> : null}
      {error ? null : consulta.isPending ? (
        <Cargando etiqueta="Cargando costos" />
      ) : consulta.isError ? (
        <EstadoVacio titulo="No pudimos cargar los costos" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          {consulta.data.truncado ? <p role="status" className="rounded-control border border-aviso/25 bg-aviso/10 p-3 text-sm text-aviso">Hay más compras de las que se pueden mostrar: se dejó lo más reciente. Acota el período o busca un artículo para ver el resto.</p> : null}
          {articulos.length === 0 ? (
            <EstadoVacio titulo="Sin compras en este período" descripcion="Aquí aparecen los artículos de las órdenes de compra enviadas o recibidas." icono="caja" />
          ) : (
            <>
              <p className="text-sm text-texto-suave">{articulos.length === 1 ? '1 artículo' : `${articulos.length} artículos`} del {formatearDia(consulta.data.desde)} al {formatearDia(consulta.data.hasta)}.</p>
              <ul aria-label="Artículos comprados" className="flex flex-col gap-3">{articulos.map((a) => <TarjetaDeArticulo key={a.clave} a={a} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
