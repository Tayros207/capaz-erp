import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { listarCorrecciones, listarMiembros } from './api.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { COLUMNAS_DE_CORRECCIONES } from './columnas-de-correcciones.tsx';
import { SIN_FILTROS, argumentosDeFiltros, errorDeFiltros, hayFiltros, type FiltrosDeCorrecciones } from './filtros-de-correcciones.ts';
import { Cargando, SeccionesDePedidos } from './marco.tsx';

function Filtros({ f, alCambiar, autores }: { f: FiltrosDeCorrecciones; alCambiar: (c: Partial<FiltrosDeCorrecciones>) => void; autores: Array<{ id: string; nombre: string }> | null }) {
  const error = errorDeFiltros(f);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Desde" type="date" value={f.desde} onChange={(e) => alCambiar({ desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={f.hasta} error={error ?? undefined} onChange={(e) => alCambiar({ hasta: e.target.value })} />
        {autores ? (
          <CampoSelect etiqueta="Quién corrigió" value={f.autorId} onChange={(e) => alCambiar({ autorId: e.target.value })}>
            <option value="">Todas las personas</option>
            {autores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </CampoSelect>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {f.pedidoId ? <Insignia tono="info">Solo un pedido</Insignia> : null}
        {f.pedidoId ? <Boton variante="fantasma" icono="cerrar" onClick={() => alCambiar({ pedidoId: '' })}>Quitar el filtro de pedido</Boton> : null}
        {hayFiltros(f) ? <Boton variante="fantasma" onClick={() => alCambiar(SIN_FILTROS)}>Limpiar filtros</Boton> : null}
      </div>
    </div>
  );
}

/** La huella global de las correcciones de pedidos: `/m/ordenes/correcciones`. Dueño y administrador ven todas; el resto, las suyas. */
export function PantallaCorrecciones() {
  const yo = useYo();
  const [busqueda, setBusqueda] = useSearchParams();
  const [f, setF] = useState<FiltrosDeCorrecciones>({ ...SIN_FILTROS, pedidoId: busqueda.get('pedido') ?? '' });
  const esDuenio = yo?.empresa?.rol === 'owner' || yo?.empresa?.rol === 'admin';
  const miembros = useQuery({ queryKey: ['miembros', 'para-correcciones'], queryFn: async () => datosOError(await listarMiembros()).miembros, enabled: esDuenio, retry: false });
  const error = errorDeFiltros(f);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PEDIDOS, 'correcciones', f],
    queryFn: async ({ pageParam }) => datosOError(await listarCorrecciones(argumentosDeFiltros(f), pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
    enabled: !error,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const cambiar = (c: Partial<FiltrosDeCorrecciones>) => {
    setF((a) => ({ ...a, ...c }));
    if ('pedidoId' in c && !c.pedidoId && busqueda.has('pedido')) setBusqueda({}, { replace: true });
  };
  const vacio = hayFiltros(f)
    ? <EstadoVacio titulo="Sin resultados" descripcion="Ninguna corrección coincide con esos filtros." icono="caja" accion={<Boton onClick={() => cambiar(SIN_FILTROS)}>Limpiar filtros</Boton>} />
    : <EstadoVacio titulo="Aún no hay correcciones" descripcion="Cuando alguien corrija un pedido confirmado, quedará aquí quién, cuándo, por qué y qué cambió." icono="caja" />;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Correcciones de pedidos" />
      <SeccionesDePedidos />
      <Filtros f={f} alCambiar={cambiar} autores={esDuenio && miembros.data ? miembros.data.map((m) => ({ id: m.personaId, nombre: m.nombre })) : null} />
      {error ? null : lista.isPending ? (
        <Cargando etiqueta="Cargando correcciones" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las correcciones" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista etiqueta="Correcciones de pedidos" columnas={COLUMNAS_DE_CORRECCIONES} filas={filas} clave={(c) => c.eventoId} vacio={vacio} />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </div>
  );
}
