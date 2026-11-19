import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FILTROS_DE_ESTADO_DE_GUIA, type EntradaDe } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { usePermisosDePedidos } from './acciones.ts';
import { listarGuias } from './api.ts';
import { rutaDeGuiaNueva } from './armado-de-guia.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { COLUMNAS_DE_GUIAS } from './columnas-de-guias.tsx';
import { HojaElegirCliente } from './hoja-elegir-cliente.tsx';
import { ETIQUETA_DE_ESTADO_DE_GUIA } from './guias.ts';
import { Cargando, SeccionesDePedidos } from './marco.tsx';

type Filtro = NonNullable<EntradaDe<'guias_listar'>['estado']>;
const etiquetaDeFiltro = (f: Filtro) => (f === 'todas' ? 'Todas' : ETIQUETA_DE_ESTADO_DE_GUIA[f]);

/** Lista de guías de remisión, de la más reciente a la más antigua. `/m/ordenes/guias`. */
export function PantallaGuias() {
  const navegar = useNavigate();
  const { editar } = usePermisosDePedidos();
  const [estado, setEstado] = useState<Filtro>('todas');
  const [eligiendo, setEligiendo] = useState(false);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PEDIDOS, 'guias', 'lista', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarGuias({ estado }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const nueva = editar ? <Boton variante="primario" icono="mas" onClick={() => setEligiendo(true)}>Nueva guía</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Guías de remisión" accionPrincipal={nueva} />
      <SeccionesDePedidos />
      <div className="grid gap-3 sm:grid-cols-[14rem]">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as Filtro)}>
          {FILTROS_DE_ESTADO_DE_GUIA.map((f) => <option key={f} value={f}>{etiquetaDeFiltro(f)}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando guías" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las guías" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Guías de remisión"
            columnas={COLUMNAS_DE_GUIAS}
            filas={filas}
            clave={(g) => g.id}
            onAbrir={(g) => void navegar(`/m/ordenes/guias/${g.id}`)}
            vacio={<EstadoVacio titulo="Todavía no hay guías" descripcion="Las guías que emitas aparecerán aquí." icono="caja" accion={nueva} />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaElegirCliente abierto={eligiendo} alCerrar={() => setEligiendo(false)} alElegir={(id) => void navegar(rutaDeGuiaNueva({ clienteId: id }))} />
    </div>
  );
}
