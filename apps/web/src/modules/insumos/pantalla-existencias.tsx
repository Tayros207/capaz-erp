import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { ExistenciaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { BarraDeBusqueda } from '../../shared/ui/datos/barra-de-busqueda.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { CLAVE_INSUMOS, listarExistencias, POR_PAGINA } from './api.ts';
import { HojaDeArticulo } from './hoja-articulo.tsx';
import { HojaDeMovimiento } from './hoja-movimiento.tsx';
import { ListaPaginada } from './lista-paginada.tsx';
import { argumentosDeExistencias, FILTROS_DE_EXISTENCIAS, textoDeCantidad, type FiltrosDeExistencias, type TipoManual } from './logica.ts';
import { InsigniaBajoMinimo } from './marco.tsx';
import { usePermisosDeInventario, useSucursales } from './use-inventario.ts';

const COLUMNAS: Array<Columna<ExistenciaDto>> = [
  {
    id: 'articulo',
    titulo: 'Artículo',
    principal: true,
    celda: (e) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        {e.nombre}
        <InsigniaBajoMinimo bajo={e.bajoMinimo} />
      </span>
    ),
  },
  { id: 'codigo', titulo: 'Código', celda: (e) => e.codigo ?? '—' },
  { id: 'sucursal', titulo: 'Sucursal', celda: (e) => e.sucursalCodigo },
  { id: 'hay', titulo: 'Existencia', alinear: 'derecha', celda: (e) => <span className="tabular-nums">{textoDeCantidad(e.cantidadMilesimas, e.unidad)}</span> },
  { id: 'minimo', titulo: 'Mínimo', alinear: 'derecha', celda: (e) => <span className="tabular-nums">{e.minimoMilesimas > 0 ? textoDeCantidad(e.minimoMilesimas, e.unidad) : '—'}</span> },
];

function Filtros({ filtros, cambiar }: { filtros: FiltrosDeExistencias; cambiar: (c: Partial<FiltrosDeExistencias>) => void }) {
  const sucursales = useSucursales();
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
      <BarraDeBusqueda valor={filtros.buscar} onCambio={(b) => cambiar({ buscar: b })} etiqueta="Buscar artículos" placeholder="Nombre o código…" />
      <CampoSelect etiqueta="Sucursal" value={filtros.sucursalId} onChange={(e) => cambiar({ sucursalId: e.target.value })}>
        <option value="">Todas</option>
        {(sucursales.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Mostrar" value={filtros.soloBajoMinimo ? 'bajo' : 'todo'} onChange={(e) => cambiar({ soloBajoMinimo: e.target.value === 'bajo' })}>
        <option value="todo">Todo</option>
        <option value="bajo">Solo bajo mínimo</option>
      </CampoSelect>
    </div>
  );
}

/** Lo que hay de cada artículo en cada sucursal, con la insignia «Bajo mínimo»; desde aquí se registra una entrada o salida. */
export function PantallaExistencias() {
  const navegar = useNavigate();
  const { editar } = usePermisosDeInventario();
  const [filtros, setFiltros] = useState<FiltrosDeExistencias>(FILTROS_DE_EXISTENCIAS);
  const [hoja, setHoja] = useState<TipoManual | null>(null);
  const [controlar, setControlar] = useState(false);
  const efectivos = { ...filtros, buscar: useRetardo(filtros.buscar.trim(), 300) };
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_INSUMOS, 'existencias', efectivos],
    queryFn: async ({ pageParam }) => datosOError(await listarExistencias(argumentosDeExistencias(efectivos, POR_PAGINA, pageParam))),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const conFiltros = JSON.stringify(efectivos) !== JSON.stringify(FILTROS_DE_EXISTENCIAS);
  const abrir = (id: string) => void navegar(`/m/insumos/articulos/${id}`);

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Existencias"
        accionPrincipal={editar ? <Boton variante="primario" onClick={() => setHoja('salida')}>Entrada / Salida</Boton> : undefined}
        accionesSecundarias={editar ? <Boton icono="mas" onClick={() => setControlar(true)}>Controlar producto</Boton> : undefined}
      />
      <Filtros filtros={filtros} cambiar={(c) => setFiltros((f) => ({ ...f, ...c }))} />
      <ListaPaginada
        consulta={consulta}
        etiqueta="Existencias"
        columnas={COLUMNAS}
        clave={(e) => e.id}
        onAbrir={(e) => abrir(e.articuloId)}
        vacio={
          <EstadoVacio
            titulo={conFiltros ? 'Nada con esos filtros' : 'Todavía no controlas ningún artículo'}
            descripcion={conFiltros ? 'Cambia la búsqueda, la sucursal o lo que quieres mostrar.' : 'Elige un producto del catálogo para empezar a llevar su inventario.'}
            icono="caja"
            accion={editar && !conFiltros ? <Boton variante="primario" onClick={() => setControlar(true)}>Controlar producto</Boton> : undefined}
          />
        }
      />
      <HojaDeMovimiento tipo={hoja} alCerrar={() => setHoja(null)} />
      <HojaDeArticulo abierto={controlar} alCerrar={() => setControlar(false)} alActivar={abrir} />
    </div>
  );
}
