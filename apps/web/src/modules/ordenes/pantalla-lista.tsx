import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { usePermisosDePedidos } from './acciones.ts';
import { listarPedidos, type FiltroDeEstado } from './api.ts';
import { rutaDeGuiaNueva, seleccionParaGuia } from './armado-de-guia.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { COLUMNAS_DE_PEDIDOS } from './columnas.tsx';
import { ETIQUETA_DE_ESTADO } from './logica.ts';
import { Cargando, SeccionesDePedidos } from './marco.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { accesoA } from '../../shared/sesion/acceso.ts';
import { ETIQUETA_DE_FILTRO_DE_COBRO, FILTROS_DE_COBRO, cobrosAbiertosPorPedido, filtrarPorCobro, type FiltroDeCobro } from './cobro-en-lista.ts';
import { columnaDeSaldo } from './columna-de-saldo.tsx';

const FILTROS: FiltroDeEstado[] = ['abiertos', 'borrador', 'confirmado', 'en_proceso', 'listo', 'entregado', 'cancelado', 'todos'];
const etiquetaDeFiltro = (f: FiltroDeEstado) => (f === 'abiertos' ? 'Abiertos' : f === 'todos' ? 'Todos' : ETIQUETA_DE_ESTADO[f]);

export function PantallaPedidos() {
  const navegar = useNavigate();
  const { editar } = usePermisosDePedidos();
  const yo = useYo();
  const esDuenio = yo?.empresa?.rol === 'owner' || yo?.empresa?.rol === 'admin';
  const [estado, setEstado] = useState<FiltroDeEstado>('abiertos');
  const [cobro, setCobro] = useState<FiltroDeCobro>('todos');
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PEDIDOS, 'lista', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarPedidos({ estado }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  // Solo quien entra a Registro ve lo que debe cada pedido; sin permiso o si falla, la lista queda como siempre.
  const verCobros = !!yo && accesoA(yo, 'registro') !== null;
  const deudas = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'cobros-abiertos'], queryFn: cobrosAbiertosPorPedido, enabled: verCobros, retry: false, staleTime: 30_000 });
  const cobros = deudas.data ?? null;
  const todas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const filas = filtrarPorCobro(todas, cobros, cobro);
  const columnas = cobros ? [...COLUMNAS_DE_PEDIDOS, columnaDeSaldo(cobros)] : COLUMNAS_DE_PEDIDOS;
  const crearGuia = () => {
    const r = seleccionParaGuia(filas, seleccion);
    if (r.ok) void navegar(rutaDeGuiaNueva({ pedidoIds: r.pedidoIds }));
    else notificar(r.mensaje, 'error');
  };
  const nuevo = editar ? <Boton variante="primario" icono="mas" onClick={() => void navegar('/m/ordenes/nuevo')}>Nuevo pedido</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Pedidos" accionPrincipal={nuevo} accionesSecundarias={esDuenio ? <Boton variante="secundario" onClick={() => void navegar('/m/ordenes/importar-historial')}>Importar historial</Boton> : undefined} />
      <SeccionesDePedidos />
      <div className="grid gap-3 sm:grid-cols-[14rem_14rem]">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => { setEstado(e.target.value as FiltroDeEstado); setSeleccion(new Set()); }}>
          {FILTROS.map((f) => (
            <option key={f} value={f}>{etiquetaDeFiltro(f)}</option>
          ))}
        </CampoSelect>
        {cobros ? (
          <CampoSelect etiqueta="Cobro" value={cobro} onChange={(e) => { setCobro(e.target.value as FiltroDeCobro); setSeleccion(new Set()); }}>
            {FILTROS_DE_COBRO.map((f) => (
              <option key={f} value={f}>{ETIQUETA_DE_FILTRO_DE_COBRO[f]}</option>
            ))}
          </CampoSelect>
        ) : null}
      </div>
      {seleccion.size > 0 ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-borde bg-superficie p-3">
          <span className="font-medium text-texto">{seleccion.size === 1 ? '1 seleccionado' : `${seleccion.size} seleccionados`}</span>
          <Boton variante="primario" onClick={crearGuia}>Guía de remisión</Boton>
          <Boton variante="fantasma" onClick={() => setSeleccion(new Set())}>Quitar selección</Boton>
        </div>
      ) : null}
      {lista.isPending ? (
        <Cargando etiqueta="Cargando pedidos" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar los pedidos" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Pedidos"
            columnas={columnas}
            filas={filas}
            clave={(p) => p.id}
            {...(editar && { seleccion, onSeleccion: setSeleccion })}
            onAbrir={(p) => void navegar(`/m/ordenes/${p.id}`)}
            vacio={<EstadoVacio titulo={estado === 'abiertos' ? 'No hay pedidos abiertos' : 'Ningún pedido con ese estado'} descripcion="Los pedidos que anotes aparecerán aquí." icono="caja" accion={nuevo} />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={cobro === 'todos' ? `Mostrando ${filas.length}` : `Mostrando ${filas.length} de ${todas.length} cargados`} />
        </>
      )}
    </div>
  );
}
