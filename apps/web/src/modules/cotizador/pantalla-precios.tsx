import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ListaDePrecioDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { resolverAccion } from './acciones.ts';
import { archivarLista, listarListas, type EstadoDeListas } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { HojaDeLista } from './hoja-lista.tsx';
import { resumenDeLista } from './logica.ts';
import { Cargando, SeccionesDelCotizador } from './marco.tsx';
import { usePermisosDelCotizador } from './use-cotizador.ts';

type Filtro = 'activas' | 'revisar' | 'archivadas';
const ETIQUETA: Record<Filtro, string> = { activas: 'Activas', revisar: 'Por revisar', archivadas: 'Archivadas' };

/** Lista de precios: precios de referencia por producto, con la marca «Revisar» si hace mucho que no se fijan. */
export function PantallaPrecios() {
  const { configurar } = usePermisosDelCotizador();
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const [texto, setTexto] = useState('');
  const buscar = useRetardo(texto.trim());
  const [hoja, setHoja] = useState<{ lista: ListaDePrecioDto | null } | null>(null);
  const estado: EstadoDeListas = filtro === 'archivadas' ? 'archivadas' : 'activas';
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_COTIZADOR, 'listas', filtro, buscar],
    queryFn: async ({ pageParam }) => datosOError(await listarListas({ estado, soloPorRevisar: filtro === 'revisar', ...(buscar !== '' && { buscar }) }, pageParam)),
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
          {l.porRevisar ? <Insignia tono="aviso">Revisar</Insignia> : null}
          {l.archivadoEn ? <Insignia tono="neutro">Archivada</Insignia> : null}
        </span>
      ),
    },
    { id: 'unidad', titulo: 'Unidad', celda: (l) => l.unidad },
    { id: 'precios', titulo: 'Precios (sin IGV)', celda: (l) => resumenDeLista(l) },
    ...(configurar
      ? [{
          id: 'acciones', titulo: 'Acciones', alinear: 'derecha' as const,
          celda: (l: ListaDePrecioDto) => l.archivadoEn ? '—' : (
            <span className="inline-flex gap-1">
              <Boton variante="fantasma" onClick={() => setHoja({ lista: l })}>Editar</Boton>
              <Boton variante="fantasma" onClick={() => void resolverAccion(archivarLista(l.id), 'Lista archivada.')}>Archivar</Boton>
            </span>
          ),
        }]
      : []),
  ];
  const nueva = configurar ? <Boton variante="primario" icono="mas" onClick={() => setHoja({ lista: null })}>Nueva lista</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Lista de precios" accionPrincipal={nueva} />
      <SeccionesDelCotizador />
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
            vacio={<EstadoVacio titulo={filtro === 'revisar' ? 'Ningún precio por revisar' : 'Todavía no hay precios'} descripcion={filtro === 'revisar' ? 'Todos tus precios se fijaron hace poco.' : 'Anota tus precios para cotizar en segundos.'} icono="caja" accion={filtro === 'activas' ? nueva : undefined} />}
          />
          <CargarMas cursor={consulta.hasNextPage ? (consulta.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={consulta.isFetchingNextPage} onCargar={() => void consulta.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeLista abierto={hoja !== null} lista={hoja?.lista ?? null} alCerrar={() => setHoja(null)} />
    </div>
  );
}
