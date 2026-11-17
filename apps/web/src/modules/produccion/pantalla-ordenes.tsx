import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatearSoles, type OrdenDeProduccionDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { usePermisosDeProduccion } from './acciones.ts';
import { listarOrdenes, POR_PAGINA } from './api.ts';
import { CLAVE_PRODUCCION } from './claves.ts';
import { HojaDeOrden } from './hoja-orden.tsx';
import { ETIQUETA_DE_ESTADO, FILTROS, hoyLocal, textoDeEntrega, TONO_DE_ESTADO, type FiltroDeOrdenes } from './logica.ts';
import { Cargando } from './marco.tsx';

const monto = (c: number) => <span className="tabular-nums">{formatearSoles(c)}</span>;

/** Las columnas de la lista, como las de Movimientos de Registro: fecha, código, detalle, entrega y los tres montos. */
function columnas(hoy: string): Array<Columna<OrdenDeProduccionDto>> {
  return [
    { id: 'fecha', titulo: 'Fecha', celda: (o) => o.fecha.split('-').reverse().join('/') },
    { id: 'codigo', titulo: 'Código', celda: (o) => o.codigo },
    {
      id: 'detalle',
      titulo: 'Trabajo',
      principal: true,
      celda: (o) => (
        <span className="flex flex-col">
          <span className="font-medium text-texto">{o.resumen}</span>
          <span className="text-sm text-texto-suave">{o.clienteNombre}</span>
        </span>
      ),
    },
    { id: 'entrega', titulo: 'Entrega', celda: (o) => <span className={o.atrasada ? 'font-medium text-peligro' : undefined}>{textoDeEntrega(o, hoy)}</span> },
    { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (o) => monto(o.totalCentimos) },
    { id: 'cuenta', titulo: 'A cuenta', alinear: 'derecha', celda: (o) => monto(o.adelantoCentimos) },
    { id: 'falta', titulo: 'Falta cancelar', alinear: 'derecha', celda: (o) => <span className={`tabular-nums ${o.saldoCentimos > 0 && o.estado !== 'anulada' ? 'font-medium text-aviso' : ''}`}>{formatearSoles(o.saldoCentimos)}</span> },
    { id: 'estado', titulo: 'Estado', celda: (o) => <Insignia tono={TONO_DE_ESTADO[o.estado]}>{ETIQUETA_DE_ESTADO[o.estado]}</Insignia> },
  ];
}

/** Órdenes de trabajo del taller: el mismo diseño que Movimientos de Registro (filtros arriba, botón «Nueva…» y tabla). */
export function PantallaOrdenes() {
  const navegar = useNavigate();
  const { editar } = usePermisosDeProduccion();
  const [hoy] = useState(hoyLocal);
  const [estado, setEstado] = useState<FiltroDeOrdenes>('en_cola');
  const [texto, setTexto] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [hoja, setHoja] = useState(false);
  const buscar = useRetardo(texto, 300);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PRODUCCION, 'lista', estado, buscar, desde, hasta],
    queryFn: async ({ pageParam }) =>
      datosOError(await listarOrdenes({ estado, limite: POR_PAGINA, ...(buscar.trim() && { buscar: buscar.trim() }), ...(desde && { desde }), ...(hasta && { hasta }), ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const conFiltros = estado !== 'en_cola' || buscar.trim() !== '' || desde !== '' || hasta !== '';
  const nueva = editar ? <Boton variante="primario" icono="mas" onClick={() => setHoja(true)}>Nueva orden</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Órdenes de trabajo" accionPrincipal={nueva} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <CampoSelect etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value as FiltroDeOrdenes)}>
          {Object.entries(FILTROS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </CampoSelect>
        <Campo etiqueta="Buscar" placeholder="Cliente, número o trabajo…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando órdenes de trabajo" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las órdenes" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Órdenes de trabajo"
            columnas={columnas(hoy)}
            filas={filas}
            clave={(o) => o.id}
            onAbrir={(o) => void navegar(`/m/produccion/${o.id}`)}
            vacio={<EstadoVacio titulo={conFiltros ? 'No encontramos ninguna orden así' : 'Aquí no hay nada'} descripcion="Anota el trabajo de un cliente con su adelanto y lo que falta cancelar: entra en la cola del taller." icono="caja" accion={nueva} />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeOrden abierto={hoja} alCerrar={() => setHoja(false)} alCrear={(id) => void navegar(`/m/produccion/${id}`)} />
    </div>
  );
}
