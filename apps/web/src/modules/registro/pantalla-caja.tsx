import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatearSoles, type MovimientoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { listarMovimientos, POR_PAGINA, verCajaDelDia } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { argumentosDeListado, detalleDeMovimiento, diaEnZona, FILTROS_VACIOS } from './logica.ts';
import { Monto } from './pantalla-movimientos.tsx';

const COLUMNAS: Array<Columna<MovimientoDto>> = [
  { id: 'codigo', titulo: 'Código', celda: (m) => m.codigo },
  {
    id: 'detalle', titulo: 'Detalle', principal: true,
    celda: (m) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        {detalleDeMovimiento(m)}
        {m.estado === 'anulado' ? <Insignia tono="neutro">Anulado</Insignia> : null}
      </span>
    ),
  },
  { id: 'cuenta', titulo: 'Cuenta', celda: (m) => m.cuentaNombre },
  { id: 'monto', titulo: 'Monto', alinear: 'derecha', celda: (m) => <Monto m={m} /> },
];

function Movimientos({ fecha }: { fecha: string }) {
  const navegar = useNavigate();
  const filtros = { ...FILTROS_VACIOS, desde: fecha, hasta: fecha };
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_REGISTRO, 'movimientos', 'caja', fecha],
    queryFn: async ({ pageParam }) => datosOError(await listarMovimientos(argumentosDeListado(filtros, POR_PAGINA, pageParam))),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  if (lista.isPending) return <Esqueleto className="h-12" />;
  if (lista.isError) return <EstadoVacio titulo="No pudimos cargar los movimientos" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />;
  return (
    <>
      <Lista etiqueta="Movimientos del día" columnas={COLUMNAS} filas={filas} clave={(m) => m.id} onAbrir={(m) => void navegar(`/m/registro/movimientos/${m.id}`)} vacio={<EstadoVacio titulo="Sin movimientos ese día" icono="caja" />} />
      <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
    </>
  );
}

/** Caja del día: una tarjeta por cuenta (saldo inicial, ingresos, egresos, saldo final) y debajo los movimientos. */
export function PantallaCaja() {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [fecha, setFecha] = useState(hoy);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy;
  const caja = useQuery({ queryKey: [...CLAVE_REGISTRO, 'caja', dia], queryFn: async () => datosOError(await verCajaDelDia(dia)) });

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Caja del día" />
      <div className="max-w-xs">
        <Campo etiqueta="Fecha" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      {caja.isPending ? (
        <div aria-busy="true" aria-label="Cargando la caja" className="flex flex-col gap-2"><Esqueleto className="h-24" /><Esqueleto className="h-24" /></div>
      ) : caja.isError ? (
        <EstadoVacio titulo="No pudimos cargar la caja" descripcion={caja.error.message} icono="caja" accion={<Boton onClick={() => void caja.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <GrupoDeCifras etiqueta="Totales del día">
            <Cifra etiqueta="Ingresos" valor={formatearSoles(caja.data.totalIngresosCentimos)} tono="exito" />
            <Cifra etiqueta="Egresos" valor={formatearSoles(caja.data.totalEgresosCentimos)} tono="peligro" />
          </GrupoDeCifras>
          {caja.data.cuentas.map((c) => (
            <section key={c.cuentaId} aria-label={`Cuenta ${c.nombre}`} className="flex flex-col gap-2">
              <h2 className="font-titulo font-semibold text-texto">{c.nombre} <span className="text-sm font-normal text-texto-suave">· {c.movimientos} {c.movimientos === 1 ? 'movimiento' : 'movimientos'}</span></h2>
              <GrupoDeCifras etiqueta={`Cifras de ${c.nombre}`}>
                <Cifra etiqueta="Saldo inicial" valor={formatearSoles(c.saldoInicialCentimos)} />
                <Cifra etiqueta="Ingresos" valor={formatearSoles(c.ingresosCentimos)} tono="exito" />
                <Cifra etiqueta="Egresos" valor={formatearSoles(c.egresosCentimos)} tono="peligro" />
                <Cifra etiqueta="Saldo final" valor={formatearSoles(c.saldoFinalCentimos)} />
              </GrupoDeCifras>
            </section>
          ))}
          <h2 className="font-titulo font-semibold text-texto">Movimientos del día</h2>
          <Movimientos fecha={dia} />
        </>
      )}
    </div>
  );
}
