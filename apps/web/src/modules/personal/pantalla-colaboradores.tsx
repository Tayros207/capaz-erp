import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { ColaboradorDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { BarraDeBusqueda } from '../../shared/ui/datos/barra-de-busqueda.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { usePermisosDePersonal } from './acciones.ts';
import { listarColaboradores, type FiltroDeColaboradores } from './api.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { HojaDeColaborador } from './hoja-colaborador.tsx';
import { formatearDia } from './logica.ts';
import { Cargando } from './marco.tsx';

const COLUMNAS: Array<Columna<ColaboradorDto>> = [
  { id: 'nombre', titulo: 'Nombre', principal: true, celda: (c) => c.nombre, valorDeOrden: (c) => c.nombre.toLocaleLowerCase('es') },
  { id: 'cargo', titulo: 'Cargo', celda: (c) => c.cargo ?? '—' },
  { id: 'telefono', titulo: 'Teléfono', celda: (c) => c.telefono ?? '—' },
  { id: 'ingreso', titulo: 'Ingreso', celda: (c) => formatearDia(c.fechaIngreso) },
  { id: 'estado', titulo: 'Estado', celda: (c) => (c.archivado ? <Insignia>Archivado</Insignia> : <Insignia tono="exito">Activo</Insignia>) },
];

const FILTROS: Array<[FiltroDeColaboradores, string]> = [['activos', 'Activos'], ['archivados', 'Archivados'], ['todos', 'Todos']];

/** Colaboradores con búsqueda por nombre y filtro de estado. */
export function PantallaColaboradores() {
  const navegar = useNavigate();
  const { editar } = usePermisosDePersonal();
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<FiltroDeColaboradores>('activos');
  const [nuevo, setNuevo] = useState(false);
  const buscar = useRetardo(texto.trim(), 300);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PERSONAL, 'colaboradores', estado, buscar],
    queryFn: async ({ pageParam }) => datosOError(await listarColaboradores({ estado, ...(buscar && { buscar }) }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const accion = editar ? <Boton variante="primario" icono="mas" onClick={() => setNuevo(true)}>Nuevo colaborador</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Colaboradores" accionPrincipal={accion} />
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <BarraDeBusqueda valor={texto} onCambio={setTexto} etiqueta="Buscar colaboradores" placeholder="Buscar por nombre…" />
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as FiltroDeColaboradores)}>
          {FILTROS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando colaboradores" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar los colaboradores" descripcion={lista.error.message} icono="usuario" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Colaboradores"
            columnas={COLUMNAS}
            filas={filas}
            clave={(c) => c.id}
            onAbrir={(c) => void navegar(`/m/personal/colaboradores/${c.id}`)}
            vacio={
              <EstadoVacio
                titulo={buscar ? 'Nadie coincide con la búsqueda' : 'Todavía no hay colaboradores'}
                descripcion={buscar ? 'Prueba con otra parte del nombre.' : 'Agrega a tu equipo para marcar su asistencia y registrar adelantos.'}
                icono="usuario"
                accion={buscar ? undefined : accion}
              />
            }
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeColaborador abierto={nuevo} alCerrar={() => setNuevo(false)} alCrear={(id) => void navegar(`/m/personal/colaboradores/${id}`)} />
    </div>
  );
}
