import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ListaDePrecioDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EnlaceDeEntidad } from '../../shared/ui/entidades.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { resolverAccion } from './acciones.ts';
import { archivarLista, listarListas, restaurarLista, type EstadoDeListas } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { HojaDeBloque } from './hoja-bloque.tsx';
import { HojaDeLista } from './hoja-lista.tsx';
import { HojaHistorialDeLista } from './hoja-historial-lista.tsx';
import { resumenDeLista } from './logica.ts';
import { Cargando, SeccionesDelCotizador } from './marco.tsx';
import { usePermisosDelCotizador } from './use-cotizador.ts';

type Filtro = 'activas' | 'revisar' | 'sin_producto' | 'archivadas';
const ETIQUETA: Record<Filtro, string> = { activas: 'Activas', revisar: 'Por revisar', sin_producto: 'Sin producto', archivadas: 'Archivadas' };

const vacioTitulo = (f: Filtro): string => (f === 'revisar' ? 'Ningún precio por revisar' : f === 'sin_producto' ? 'Todas las listas tienen producto' : 'Todavía no hay precios');
const vacioDescripcion = (f: Filtro): string =>
  f === 'revisar' ? 'Todos tus precios se fijaron hace poco.' : f === 'sin_producto' ? 'No quedan listas heredadas por enlazar al catálogo.' : 'Los productos del catálogo se cotizan con su precio. Aquí anotas precios por escala (100, 1.000 y 5.000).';

/** Lista de precios: precios de referencia por producto, con la marca «Revisar» si hace mucho que no se fijan. */
export function PantallaPrecios() {
  const { configurar } = usePermisosDelCotizador();
  const [parametros, setParametros] = useSearchParams();
  /** Desde la ficha de un producto se llega con `?producto=<id>`: solo se ve la lista de ese producto. */
  const productoId = parametros.get('producto') ?? undefined;
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const [texto, setTexto] = useState('');
  const buscar = useRetardo(texto.trim());
  const [hoja, setHoja] = useState<{ lista: ListaDePrecioDto | null } | null>(null);
  const [bloque, setBloque] = useState(false);
  const [historial, setHistorial] = useState<ListaDePrecioDto | null>(null);
  const estado: EstadoDeListas = filtro === 'archivadas' ? 'archivadas' : 'activas';
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_COTIZADOR, 'listas', filtro, buscar, productoId ?? null],
    queryFn: async ({ pageParam }) => datosOError(await listarListas({ estado, soloPorRevisar: filtro === 'revisar', soloSinProducto: filtro === 'sin_producto', ...(productoId && { productoId }), ...(buscar !== '' && { buscar }) }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = consulta.data?.pages.flatMap((p) => p.items) ?? [];

  const columnas: Array<Columna<ListaDePrecioDto>> = [
    {
      id: 'nombre', titulo: 'Producto', principal: true,
      celda: (l) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {l.nombre}
          {l.productoId ? <EnlaceDeEntidad tipo="producto" id={l.productoId} className="text-sm text-texto-suave">Producto: {l.productoNombre ?? 'ver ficha'}</EnlaceDeEntidad> : null}
          {l.porRevisar ? <Insignia tono="aviso">Revisar</Insignia> : null}
          {l.archivadoEn ? <Insignia tono="neutro">Archivada</Insignia> : null}
        </span>
      ),
    },
    { id: 'unidad', titulo: 'Unidad', celda: (l) => l.unidad },
    { id: 'precios', titulo: 'Precios (sin IGV)', celda: (l) => resumenDeLista(l) },
    { id: 'historial', titulo: 'Historial', alinear: 'derecha' as const, celda: (l: ListaDePrecioDto) => <Boton variante="fantasma" aria-label={`Ver historial de ${l.nombre}`} onClick={() => setHistorial(l)}>Historial</Boton> },
    ...(configurar
      ? [{
          id: 'acciones', titulo: 'Acciones', alinear: 'derecha' as const,
          celda: (l: ListaDePrecioDto) => l.archivadoEn ? (
            <Boton variante="fantasma" onClick={() => void resolverAccion(restaurarLista(l.id), 'Lista restaurada.')}>Restaurar</Boton>
          ) : (
            <span className="inline-flex gap-1">
              <Boton variante="fantasma" onClick={() => setHoja({ lista: l })}>Editar</Boton>
              <Boton variante="fantasma" onClick={() => void resolverAccion(archivarLista(l.id), 'Lista archivada.')}>Archivar</Boton>
            </span>
          ),
        }]
      : []),
  ];
  const nueva = configurar ? <Boton variante="primario" icono="mas" onClick={() => setHoja({ lista: null })}>Nueva lista</Boton> : undefined;
  const bloqueBtn = configurar ? <Boton onClick={() => setBloque(true)}>Cambiar en bloque</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Lista de precios" accionPrincipal={nueva} accionesSecundarias={bloqueBtn} />
      <SeccionesDelCotizador />
      {productoId ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
          Mostrando solo la lista de un producto.
          <Boton variante="fantasma" onClick={() => setParametros({})}>Ver todas</Boton>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <CampoSelect etiqueta="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          {(Object.keys(ETIQUETA) as Filtro[]).map((f) => <option key={f} value={f}>{ETIQUETA[f]}</option>)}
        </CampoSelect>
        <Campo etiqueta="Buscar" type="search" value={texto} maxLength={100} placeholder="Nombre del producto" onChange={(e) => setTexto(e.target.value)} />
      </div>
      {consulta.isPending ? (
        <Cargando etiqueta="Cargando precios" />
      ) : consulta.isError ? (
        <EstadoVacio titulo="No pudimos cargar los precios" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Lista de precios"
            columnas={columnas}
            filas={filas}
            clave={(l) => l.id}
            vacio={<EstadoVacio titulo={vacioTitulo(filtro)} descripcion={vacioDescripcion(filtro)} icono="caja" accion={filtro === 'activas' ? nueva : undefined} />}
          />
          <CargarMas cursor={consulta.hasNextPage ? (consulta.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={consulta.isFetchingNextPage} onCargar={() => void consulta.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeBloque abierto={bloque} alCerrar={() => setBloque(false)} />
      <HojaHistorialDeLista lista={historial} alCerrar={() => setHistorial(null)} />
      <HojaDeLista abierto={hoja !== null} lista={hoja?.lista ?? null} alCerrar={() => setHoja(null)} />
    </div>
  );
}
