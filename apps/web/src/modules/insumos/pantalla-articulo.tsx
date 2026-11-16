import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { ArticuloDto, ExistenciaPorSucursalDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { activarArticulo, archivarArticulo, CLAVE_INSUMOS, listarMovimientos, POR_PAGINA } from './api.ts';
import { HojaDeAjuste } from './hoja-ajuste.tsx';
import { HojaDeArticulo } from './hoja-articulo.tsx';
import { HojaDeMovimiento } from './hoja-movimiento.tsx';
import { ListaPaginada } from './lista-paginada.tsx';
import { argumentosDeMovimientos, FILTROS_DE_MOVIMIENTOS, textoDeCantidad, textoDeCosto, type TipoManual } from './logica.ts';
import { Cargando, InsigniaBajoMinimo } from './marco.tsx';
import { columnasDeHistorial } from './columnas.tsx';
import { resolverAccion, useArticulo, usePermisosDeInventario } from './use-inventario.ts';

const HISTORIAL = columnasDeHistorial(false);

function PorSucursal({ a }: { a: ArticuloDto }) {
  const columnas: Array<Columna<ExistenciaPorSucursalDto>> = [
    { id: 'sucursal', titulo: 'Sucursal', principal: true, celda: (e) => `${e.sucursalNombre} · ${e.sucursalCodigo}` },
    { id: 'hay', titulo: 'Existencia', alinear: 'derecha', celda: (e) => <span className="tabular-nums">{textoDeCantidad(e.cantidadMilesimas, a.unidad)}</span> },
    { id: 'estado', titulo: 'Estado', celda: (e) => <InsigniaBajoMinimo bajo={e.bajoMinimo} /> },
  ];
  return (
    <section aria-label="Existencia por sucursal" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Por sucursal</h2>
      <Lista etiqueta="Existencia por sucursal" columnas={columnas} filas={a.existencias} clave={(e) => e.sucursalId} vacio={<EstadoVacio titulo="Sin existencias todavía" icono="caja" />} />
    </section>
  );
}

function Historial({ articuloId }: { articuloId: string }) {
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_INSUMOS, 'movimientos', { ...FILTROS_DE_MOVIMIENTOS, articuloId }],
    queryFn: async ({ pageParam }) => datosOError(await listarMovimientos(argumentosDeMovimientos({ ...FILTROS_DE_MOVIMIENTOS, articuloId }, POR_PAGINA, pageParam))),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  return (
    <section aria-label="Historial del artículo" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Historial</h2>
      <ListaPaginada consulta={consulta} etiqueta="Historial" columnas={HISTORIAL} clave={(m) => m.id} vacio={<EstadoVacio titulo="Sin movimientos todavía" descripcion="Las entradas, salidas y ajustes de este artículo aparecerán aquí." icono="caja" />} />
    </section>
  );
}

type Hoja = TipoManual | 'ajuste' | 'editar' | null;

function acciones(a: ArticuloDto, abrir: (h: Hoja) => void): AccionDeMenu[] {
  if (a.archivadoEn) return [{ etiqueta: 'Volver a controlar', onSeleccionar: () => void resolverAccion(activarArticulo({ productoId: a.productoId }), `${a.nombre} vuelve al inventario.`) }];
  return [
    { etiqueta: 'Mínimo y unidad', onSeleccionar: () => abrir('editar') },
    { etiqueta: 'Archivar', peligro: true, onSeleccionar: () => void resolverAccion(archivarArticulo(a.id), `${a.nombre} archivado.`) },
  ];
}

function Contenido({ a }: { a: ArticuloDto }) {
  const { editar, ajustar } = usePermisosDeInventario();
  const [hoja, setHoja] = useState<Hoja>(null);
  const activo = a.archivadoEn === null;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={a.nombre}
        migas={[{ texto: 'Existencias', a: '/m/insumos' }, { texto: a.nombre }]}
        accionPrincipal={editar && activo ? <Boton variante="primario" onClick={() => setHoja('salida')}>Entrada / Salida</Boton> : undefined}
        accionesSecundarias={
          <>
            <InsigniaBajoMinimo bajo={a.bajoMinimo} />
            {activo ? null : <Insignia tono="neutro">Archivado</Insignia>}
            {ajustar && activo ? <Boton onClick={() => setHoja('ajuste')}>Ajustar</Boton> : null}
            {editar ? <MenuDeAcciones etiqueta="Más acciones del artículo" acciones={acciones(a, setHoja)} /> : null}
          </>
        }
      />
      <GrupoDeCifras etiqueta="Cifras del artículo">
        <Cifra etiqueta="Existencia total" valor={textoDeCantidad(a.existenciaTotalMilesimas, a.unidad)} tono={a.bajoMinimo ? 'aviso' : 'neutro'} />
        <Cifra etiqueta="Mínimo" valor={a.minimoMilesimas > 0 ? textoDeCantidad(a.minimoMilesimas, a.unidad) : 'Sin mínimo'} />
        <Cifra etiqueta="Último costo" valor={textoDeCosto(a.ultimoCostoMilesimas)} ayuda="Informativo, por unidad" />
        <Cifra etiqueta="Código" valor={a.codigo ?? '—'} />
      </GrupoDeCifras>
      <PorSucursal a={a} />
      <Historial articuloId={a.id} />
      <HojaDeMovimiento tipo={hoja === 'entrada' || hoja === 'salida' ? hoja : null} articulo={{ id: a.id, nombre: a.nombre }} alCerrar={() => setHoja(null)} />
      <HojaDeAjuste abierto={hoja === 'ajuste'} articulo={a} alCerrar={() => setHoja(null)} />
      <HojaDeArticulo abierto={hoja === 'editar'} articulo={a} alCerrar={() => setHoja(null)} />
    </div>
  );
}

/** Ficha de un artículo: cifras, existencia por sucursal, historial y sus acciones. */
export function PantallaArticulo() {
  const { id = '' } = useParams();
  const consulta = useArticulo(id);
  if (consulta.isPending) return <Cargando etiqueta="Cargando artículo" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos este artículo" descripcion={consulta.error.message} icono="caja" />;
  return <Contenido a={consulta.data} />;
}
