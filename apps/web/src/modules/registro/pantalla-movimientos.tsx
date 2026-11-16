import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { MovimientoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { listarMovimientos, POR_PAGINA } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { DetalleDeMovimiento } from './detalle-de-movimiento.tsx';
import { HojaDeMovimiento } from './hoja-movimiento.tsx';
import { HojaDeTransferencia } from './hoja-transferencia.tsx';
import { argumentosDeListado, errorDeRango, FILTROS_VACIOS, formatearDia, montoConSigno, puedeTransferir, type FiltrosDeMovimientos, type TipoDeMovimiento } from './logica.ts';
import { useCuentas, usePuedeEditar } from './use-registro.ts';

const CLASE_DE_TONO = { exito: 'text-exito', peligro: 'text-peligro', neutro: 'line-through', suave: 'text-texto-suave' } as const;

/** Monto con signo y tono; el signo también va en el texto, no solo en el color. */
export function Monto({ m }: { m: MovimientoDto }) {
  const { texto, tono } = montoConSigno(m);
  return <span className={`font-medium tabular-nums ${CLASE_DE_TONO[tono]}`}>{texto}</span>;
}

const COLUMNAS: Array<Columna<MovimientoDto>> = [
  { id: 'fecha', titulo: 'Fecha', celda: (m) => formatearDia(m.fecha) },
  { id: 'codigo', titulo: 'Código', celda: (m) => m.codigo },
  {
    id: 'detalle',
    titulo: 'Detalle',
    principal: true,
    celda: (m) => <DetalleDeMovimiento m={m} />,
  },
  { id: 'categoria', titulo: 'Categoría', celda: (m) => m.categoriaNombre ?? '—' },
  { id: 'cuenta', titulo: 'Cuenta', celda: (m) => m.cuentaNombre },
  { id: 'monto', titulo: 'Monto', alinear: 'derecha', celda: (m) => <Monto m={m} /> },
];

export function PantallaMovimientos() {
  const navegar = useNavigate();
  const puedeEditar = usePuedeEditar();
  const cuentas = useCuentas();
  const [filtros, setFiltros] = useState<FiltrosDeMovimientos>(FILTROS_VACIOS);
  const [nuevo, setNuevo] = useState<TipoDeMovimiento | null>(null);
  const [transfiriendo, setTransfiriendo] = useState(false);
  const rangoMalo = errorDeRango(filtros);
  const cambiar = (c: Partial<FiltrosDeMovimientos>) => setFiltros((f) => ({ ...f, ...c }));

  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_REGISTRO, 'movimientos', filtros],
    queryFn: async ({ pageParam }) => datosOError(await listarMovimientos(argumentosDeListado(filtros, POR_PAGINA, pageParam))),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
    enabled: !rangoMalo,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const conFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS);

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Movimientos"
        accionPrincipal={puedeEditar ? <Boton variante="primario" icono="mas" onClick={() => setNuevo('ingreso')}>Nuevo ingreso</Boton> : undefined}
        accionesSecundarias={
          puedeEditar ? (
            <>
              <Boton onClick={() => setTransfiriendo(true)} disabled={!puedeTransferir(cuentas.data?.items ?? [])} title={puedeTransferir(cuentas.data?.items ?? []) ? undefined : 'Necesitas al menos dos cuentas'}>Transferir entre cuentas</Boton>
              <Boton icono="mas" onClick={() => setNuevo('egreso')}>Nuevo egreso</Boton>
            </>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Campo etiqueta="Desde" type="date" value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} error={rangoMalo} />
        <CampoSelect etiqueta="Tipo" value={filtros.tipo} onChange={(e) => cambiar({ tipo: e.target.value as FiltrosDeMovimientos['tipo'] })}>
          <option value="">Ingresos y egresos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="egreso">Solo egresos</option>
        </CampoSelect>
        <CampoSelect etiqueta="Cuenta" value={filtros.cuentaId} onChange={(e) => cambiar({ cuentaId: e.target.value })}>
          <option value="">Todas las cuentas</option>
          {(cuentas.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </CampoSelect>
      </div>

      {lista.isPending && lista.fetchStatus !== 'idle' ? (
        <div aria-busy="true" aria-label="Cargando movimientos" className="flex flex-col gap-2">
          <Esqueleto className="h-12" />
          <Esqueleto className="h-12" />
          <Esqueleto className="h-12" />
        </div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar los movimientos" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Movimientos"
            columnas={COLUMNAS}
            filas={filas}
            clave={(m) => m.id}
            onAbrir={(m) => void navegar(`/m/registro/movimientos/${m.id}`)}
            vacio={
              <EstadoVacio
                titulo={conFiltros ? 'Ningún movimiento con esos filtros' : 'Todavía no hay movimientos'}
                descripcion={conFiltros ? 'Cambia las fechas, el tipo o la cuenta.' : 'Los ingresos y egresos que registres aparecerán aquí.'}
                icono="caja"
                accion={puedeEditar && !conFiltros ? <Boton variante="primario" onClick={() => setNuevo('ingreso')}>Nuevo ingreso</Boton> : undefined}
              />
            }
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}

      <HojaDeTransferencia abierto={transfiriendo} cuentas={cuentas.data?.items ?? []} alCerrar={() => setTransfiriendo(false)} />
      <HojaDeMovimiento tipo={nuevo} cuentas={cuentas.data?.items ?? []} alCerrar={() => setNuevo(null)} />
    </div>
  );
}
