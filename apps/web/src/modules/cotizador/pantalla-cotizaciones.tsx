import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { BarraDeBusqueda } from '../../shared/ui/datos/barra-de-busqueda.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { ChipDeCliente } from '../../shared/ui/entidades.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import type { CotizacionDto } from '@capaz/shared';
import { resolverAccion } from './acciones.ts';
import { usePermisosDeCotizaciones } from './acciones-cotizacion.ts';
import { buscarClientes } from './api.ts';
import { volverACotizar } from './api-lista-cotizaciones.ts';
import { listarCotizaciones } from './api-cotizaciones.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { HojaDeCotizacion } from './hoja-cotizacion.tsx';
import { InsigniaDeCotizacion } from './insignia-cotizacion.tsx';
import { soles } from './logica.ts';
import { FILTROS, FORMULARIO_VACIO, etiquetaDeFiltro, rutaDeFicha, rutaDeReenvio, sePuedeReenviar, type FiltroDeEstado } from './logica-cotizaciones.ts';
import { Cargando, SeccionesDelCotizador } from './marco.tsx';

type Acciones = { puedeDuplicar: boolean; ocupada: string | null; volver: (c: CotizacionDto) => void; reenviar: (c: CotizacionDto) => void; abrir: (c: CotizacionDto) => void };

function columnas(a: Acciones): Array<Columna<CotizacionDto>> {
  return [...COLUMNAS_BASE, {
    id: 'acciones', titulo: 'Acciones',
    celda: (c) => (
      <span className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        <Boton variante="fantasma" onClick={() => a.abrir(c)}>Abrir</Boton>
        {sePuedeReenviar(c.estado) ? <Boton variante="fantasma" onClick={() => a.reenviar(c)}>Reenviar</Boton> : null}
        {a.puedeDuplicar ? <Boton variante="fantasma" cargando={a.ocupada === c.id} disabled={a.ocupada !== null} onClick={() => a.volver(c)}>Volver a cotizar</Boton> : null}
      </span>
    ),
  }];
}

const COLUMNAS_BASE: Array<Columna<CotizacionDto>> = [
  { id: 'codigo', titulo: 'Cotización', principal: true, celda: (c) => c.codigo },
  { id: 'titulo', titulo: 'Título', celda: (c) => c.titulo },
  { id: 'cliente', titulo: 'Cliente', celda: (c) => (c.clienteId && c.clienteNombre ? <span onClick={(e) => e.stopPropagation()}><ChipDeCliente id={c.clienteId} nombre={c.clienteNombre} /></span> : 'Sin cliente') },
  { id: 'estado', titulo: 'Estado', celda: (c) => <InsigniaDeCotizacion estado={c.estado} validaHasta={c.validaHasta} /> },
  { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (c) => (c.conOpciones ? 'Con opciones' : soles(c.totalCentimos)) },
];

export function PantallaCotizaciones() {
  const navegar = useNavigate();
  const { editar, costos } = usePermisosDeCotizaciones();
  const [estado, setEstado] = useState<FiltroDeEstado>('abiertas');
  const [texto, setTexto] = useState('');
  const [cliente, setCliente] = useState<Opcion | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const buscar = useRetardo(texto.trim());
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_COTIZADOR, 'cotizaciones', estado, buscar, cliente?.id ?? null],
    queryFn: async ({ pageParam }) => datosOError(await listarCotizaciones({ estado, ...(buscar && { buscar }), ...(cliente && { clienteId: cliente.id }) }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  async function buscarElCliente(t: string): Promise<Opcion[]> {
    return datosOError(await buscarClientes(t)).items.map((c) => ({ id: c.id, nombre: c.nombre }));
  }
  async function volver(c: CotizacionDto) {
    setOcupada(c.id);
    const r = await volverACotizar(c.id);
    setOcupada(null);
    if (await resolverAccion(r, 'Cotización nueva creada como borrador.') && 'datos' in r && r.ok) void navegar(rutaDeFicha(r.datos.id));
  }
  const acciones: Acciones = { puedeDuplicar: editar, ocupada, volver: (c) => void volver(c), reenviar: (c) => void navegar(rutaDeReenvio(c.id)), abrir: (c) => void navegar(rutaDeFicha(c.id)) };
  const boton = editar ? <Boton variante="primario" icono="mas" onClick={() => setNueva(true)}>Nueva cotización</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Cotizaciones" accionPrincipal={boton} />
      <SeccionesDelCotizador />
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr_16rem] sm:items-end">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as FiltroDeEstado)}>
          {FILTROS.map((f) => <option key={f} value={f}>{etiquetaDeFiltro(f)}</option>)}
        </CampoSelect>
        <BarraDeBusqueda valor={texto} onCambio={setTexto} etiqueta="Buscar cotizaciones" placeholder="Buscar por título, código o cliente…" />
        <SelectorDeRegistro etiqueta="Cliente" valor={cliente} alCambiar={setCliente} buscar={buscarElCliente} textoSinResultados="Ningún cliente se parece a eso" />
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando cotizaciones" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las cotizaciones" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Cotizaciones"
            columnas={columnas(acciones)}
            filas={filas}
            clave={(c) => c.id}
            onAbrir={(c) => void navegar(rutaDeFicha(c.id))}
            vacio={<EstadoVacio titulo="No hay cotizaciones aquí" descripcion="Las cotizaciones que armes aparecerán en esta lista." icono="caja" accion={boton} />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeCotizacion abierto={nueva} id={null} inicial={FORMULARIO_VACIO} puedeVerCostos={costos} alCerrar={() => setNueva(false)} alGuardar={(id) => void navegar(rutaDeFicha(id))} />
    </div>
  );
}
