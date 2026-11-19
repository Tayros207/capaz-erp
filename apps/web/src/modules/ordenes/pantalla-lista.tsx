import { useInfiniteQuery } from '@tanstack/react-query';
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

const FILTROS: FiltroDeEstado[] = ['abiertos', 'borrador', 'confirmado', 'en_proceso', 'listo', 'entregado', 'cancelado', 'todos'];
const etiquetaDeFiltro = (f: FiltroDeEstado) => (f === 'abiertos' ? 'Abiertos' : f === 'todos' ? 'Todos' : ETIQUETA_DE_ESTADO[f]);

export function PantallaPedidos() {
  const navegar = useNavigate();
  const { editar } = usePermisosDePedidos();
  const [estado, setEstado] = useState<FiltroDeEstado>('abiertos');
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PEDIDOS, 'lista', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarPedidos({ estado }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const crearGuia = () => {
    const r = seleccionParaGuia(filas, seleccion);
    if (r.ok) void navegar(rutaDeGuiaNueva({ pedidoIds: r.pedidoIds }));
    else notificar(r.mensaje, 'error');
  };
  const nuevo = editar ? <Boton variante="primario" icono="mas" onClick={() => void navegar('/m/ordenes/nuevo')}>Nuevo pedido</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Pedidos" accionPrincipal={nuevo} />
      <SeccionesDePedidos />
      <div className="grid gap-3 sm:grid-cols-[14rem]">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => { setEstado(e.target.value as FiltroDeEstado); setSeleccion(new Set()); }}>
          {FILTROS.map((f) => (
            <option key={f} value={f}>{etiquetaDeFiltro(f)}</option>
          ))}
        </CampoSelect>
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
            columnas={COLUMNAS_DE_PEDIDOS}
            filas={filas}
            clave={(p) => p.id}
            {...(editar && { seleccion, onSeleccion: setSeleccion })}
            onAbrir={(p) => void navegar(`/m/ordenes/${p.id}`)}
            vacio={<EstadoVacio titulo={estado === 'abiertos' ? 'No hay pedidos abiertos' : 'Ningún pedido con ese estado'} descripcion="Los pedidos que anotes aparecerán aquí." icono="caja" accion={nuevo} />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </div>
  );
}
