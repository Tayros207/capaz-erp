import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatearSoles, type AdelantoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { usePermisosDePersonal } from './acciones.ts';
import { listarAdelantos, type FiltroDeAdelantos } from './api.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { HojaDeAdelanto } from './hoja-adelanto.tsx';
import { ETIQUETA_DE_ADELANTO, formatearDia, TONO_DE_ADELANTO } from './logica.ts';
import { Cargando } from './marco.tsx';

const monto = (a: AdelantoDto) => <span className={a.estado === 'anulado' ? 'tabular-nums text-texto-suave line-through' : 'font-medium tabular-nums'}>{formatearSoles(a.montoCentimos)}</span>;

const COLUMNAS: Array<Columna<AdelantoDto>> = [
  { id: 'codigo', titulo: 'Código', principal: true, celda: (a) => a.codigo },
  { id: 'colaborador', titulo: 'Colaborador', celda: (a) => a.colaboradorNombre },
  { id: 'fecha', titulo: 'Fecha', celda: (a) => formatearDia(a.fecha), valorDeOrden: (a) => a.fecha },
  { id: 'monto', titulo: 'Monto', alinear: 'derecha', celda: monto, valorDeOrden: (a) => a.montoCentimos },
  { id: 'estado', titulo: 'Estado', celda: (a) => <Insignia tono={TONO_DE_ADELANTO[a.estado]}>{ETIQUETA_DE_ADELANTO[a.estado]}</Insignia> },
];

const FILTROS: Array<[FiltroDeAdelantos, string]> = [['vigentes', 'Vigentes'], ['anulados', 'Anulados'], ['todos', 'Todos']];

/** Adelantos: lista con filtro de estado; al abrir uno se ve su detalle y, con permiso, se anula. */
export function PantallaAdelantos() {
  const navegar = useNavigate();
  const { adelantos, anular } = usePermisosDePersonal();
  const [estado, setEstado] = useState<FiltroDeAdelantos>('vigentes');
  const [abierto, setAbierto] = useState<AdelantoDto | null>(null);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PERSONAL, 'adelantos', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarAdelantos({ estado }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const nuevo = adelantos ? <Boton variante="primario" icono="mas" onClick={() => void navegar('/m/personal/adelantos/nuevo')}>Nuevo adelanto</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Adelantos" accionPrincipal={nuevo} />
      <div className="sm:max-w-56">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as FiltroDeAdelantos)}>
          {FILTROS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando adelantos" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar los adelantos" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Adelantos"
            columnas={COLUMNAS}
            filas={filas}
            clave={(a) => a.id}
            onAbrir={setAbierto}
            vacio={<EstadoVacio titulo={estado === 'vigentes' ? 'No hay adelantos vigentes' : 'Ningún adelanto con ese estado'} descripcion="Los adelantos que registres aparecerán aquí." icono="caja" accion={nuevo} />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeAdelanto adelanto={abierto} puedeAnular={anular} alCerrar={() => setAbierto(null)} />
    </div>
  );
}
