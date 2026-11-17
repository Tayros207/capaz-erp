import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { FacturaDto, Respuesta } from '@capaz/shared';
import { formatearSoles } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarCompras, usePermisosDeCompras } from './acciones.ts';
import { anularFactura, listarFacturas, POR_PAGINA_DE_OPERACIONES } from './api-operaciones.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { HojaDeDecision } from './hoja-decision.tsx';
import { HojaDeFactura } from './hoja-factura.tsx';
import { ETIQUETA_DE_CONCILIACION, TONO_DE_CONCILIACION, textoDeDiferencia } from './logica-operaciones.ts';
import { mensajeDeRechazo } from './logica.ts';
import { Cargando } from './marco.tsx';

const FILTROS = { vigentes: 'Vigentes', anuladas: 'Anuladas', todas: 'Todas' } as const;
type Filtro = keyof typeof FILTROS;

function Conciliacion({ f }: { f: FacturaDto }) {
  const c = f.conciliacion;
  const dif = textoDeDiferencia(c.diferenciaConOrdenCentimos, formatearSoles);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Insignia tono={f.anuladoEn ? 'neutro' : TONO_DE_CONCILIACION[c.estado]}>{f.anuladoEn ? 'Anulada' : ETIQUETA_DE_CONCILIACION[c.estado]}</Insignia>
      {!f.anuladoEn && c.estado === 'difiere' && dif ? <span className="text-sm text-peligro">{dif} que la orden</span> : null}
    </span>
  );
}

async function aplicar(llamada: Promise<Respuesta<unknown>>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarCompras();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

/** Facturas de proveedores, comparadas con su orden de compra y con lo recibido. */
export function PantallaFacturas() {
  const { editar } = usePermisosDeCompras();
  const [filtro, setFiltro] = useState<Filtro>('vigentes');
  const [hoja, setHoja] = useState(false);
  const [aAnular, setAAnular] = useState<FacturaDto | null>(null);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_COMPRAS, 'facturas', filtro],
    queryFn: async ({ pageParam }) => datosOError(await listarFacturas({ estado: filtro, limite: POR_PAGINA_DE_OPERACIONES, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const columnas: Array<Columna<FacturaDto>> = [
    { id: 'comprobante', titulo: 'Comprobante', principal: true, celda: (f) => f.comprobante },
    { id: 'proveedor', titulo: 'Proveedor', celda: (f) => f.proveedorNombre },
    { id: 'fecha', titulo: 'Fecha', celda: (f) => f.fecha },
    { id: 'orden', titulo: 'Orden', celda: (f) => f.ordenCodigo ?? '—' },
    { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (f) => <span className="tabular-nums">{f.moneda === 'PEN' ? formatearSoles(f.totalCentimos) : `${f.moneda} ${(f.totalCentimos / 100).toFixed(2)}`}</span> },
    { id: 'conciliacion', titulo: 'Conciliación', celda: (f) => <Conciliacion f={f} /> },
    ...(editar ? [{ id: 'acciones', titulo: '', alinear: 'derecha' as const, celda: (f: FacturaDto) => (f.anuladoEn ? null : <Boton variante="fantasma" onClick={() => setAAnular(f)}>Anular</Boton>) }] : []),
  ];
  const nueva = editar ? <Boton variante="primario" icono="mas" onClick={() => setHoja(true)}>Registrar factura</Boton> : undefined;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Facturas de proveedores" accionPrincipal={nueva} />
      <div className="grid gap-3 sm:grid-cols-[14rem]">
        <CampoSelect etiqueta="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          {Object.entries(FILTROS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando facturas" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las facturas" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista etiqueta="Facturas de proveedores" columnas={columnas} filas={filas} clave={(f) => f.id} vacio={<EstadoVacio titulo="No hay facturas con ese estado" descripcion="Registra la factura de un proveedor y se compara sola con su orden de compra." icono="caja" accion={nueva} />} />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeFactura abierto={hoja} alCerrar={() => setHoja(false)} />
      <HojaDeDecision
        abierto={aAnular !== null}
        titulo={`Anular factura ${aAnular?.comprobante ?? ''}`}
        etiqueta="Motivo de la anulación"
        textoBoton="Anular factura"
        peligro
        alCerrar={() => setAAnular(null)}
        alEnviar={(motivo) => aplicar(anularFactura({ id: aAnular!.id, motivo }), 'Factura anulada.')}
      />
    </div>
  );
}
