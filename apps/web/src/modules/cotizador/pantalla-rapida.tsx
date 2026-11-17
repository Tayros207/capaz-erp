import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ListaDePrecioDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { refrescarCotizador } from './acciones.ts';
import { buscarClientes, consultarPrecio, crearCotizacion, listarListas } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { REFERENCIAS, soles, argumentosDeCotizacionRapida, mensajeDeRechazo, resumenDeLista, rutaDeCotizacion, validarCantidadRapida } from './logica.ts';
import { SeccionesDelCotizador } from './marco.tsx';
import { usePermisosDelCotizador } from './use-cotizador.ts';

const PRECIO_DE: Record<(typeof REFERENCIAS)[number]['clave'], 'p100Centimos' | 'p1000Centimos' | 'p5000Centimos'> = {
  p100: 'p100Centimos', p1000: 'p1000Centimos', p5000: 'p5000Centimos',
};

/** Cotización rápida: elige el producto, escribe la cantidad y ve precio, IGV y total (los calcula el servidor). */
export function PantallaRapida() {
  const navegar = useNavigate();
  const { editar } = usePermisosDelCotizador();
  const encontradas = useRef(new Map<string, ListaDePrecioDto>());
  const [lista, setLista] = useState<Opcion | null>(null);
  const [cliente, setCliente] = useState<Opcion | null>(null);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [datosDeLista, setDatosDeLista] = useState<ListaDePrecioDto | null>(null);

  const cantidadConsultada = useRetardo(cantidad);
  const errorDeCantidad = cantidad === null ? undefined : validarCantidadRapida(cantidad);
  const consultable = lista !== null && cantidadConsultada !== null && cantidadConsultada === cantidad && validarCantidadRapida(cantidadConsultada) === undefined;
  const precio = useQuery({
    queryKey: [...CLAVE_COTIZADOR, 'precio', lista?.id, cliente?.id ?? null, cantidadConsultada],
    queryFn: async () => datosOError(await consultarPrecio({ listaId: lista?.id ?? '', cantidadMilesimas: cantidadConsultada ?? 0, ...(cliente && { clienteId: cliente.id }), ajuste: { tipo: 'ninguno' } })),
    enabled: consultable,
    retry: false,
  });

  async function buscarListas(texto: string) {
    const { items } = datosOError(await listarListas({ estado: 'activas', soloPorRevisar: false, buscar: texto }, undefined, 8));
    for (const l of items) encontradas.current.set(l.id, l);
    return items.map((l) => ({ id: l.id, nombre: l.nombre, detalle: `por ${l.unidad}` }));
  }
  async function buscarDeClientes(texto: string) {
    const { items } = datosOError(await buscarClientes(texto));
    return items.map((c) => ({ id: c.id, nombre: c.nombre }));
  }

  async function crear() {
    if (!lista || cantidad === null || validarCantidadRapida(cantidad)) return;
    setCreando(true);
    const r = await crearCotizacion(argumentosDeCotizacionRapida(lista.id, lista.nombre, cantidad, cliente ? { id: cliente.id, nombre: cliente.nombre } : null));
    setCreando(false);
    if (r.ok && 'datos' in r) {
      await refrescarCotizador();
      notificar('Cotización creada como borrador.', 'exito');
      void navegar(rutaDeCotizacion(r.datos.id));
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Cotización rápida" />
      <SeccionesDelCotizador />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorDeRegistro
          etiqueta="Producto"
          valor={lista}
          alCambiar={(o) => { setLista(o); setDatosDeLista(o ? (encontradas.current.get(o.id) ?? null) : null); setCantidad(null); }}
          buscar={buscarListas}
          ayuda="Busca en tu lista de precios."
          textoSinResultados="Ningún producto de tu lista se parece a eso"
        />
        <SelectorDeRegistro
          etiqueta="Cliente (opcional)"
          valor={cliente}
          alCambiar={setCliente}
          buscar={buscarDeClientes}
          ayuda="Si tiene un precio especial, se aplica."
          textoSinResultados="Ningún cliente se parece a eso"
        />
      </div>
      {datosDeLista ? (
        <section aria-label="Precios de la lista" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-titulo text-lg font-semibold text-texto">{datosDeLista.nombre}</h2>
            {datosDeLista.porRevisar ? <Insignia tono="aviso">Revisar precios</Insignia> : null}
          </div>
          <GrupoDeCifras etiqueta="Precios de referencia, sin IGV">
            {REFERENCIAS.map((r) => <Cifra key={r.clave} etiqueta={`${r.etiqueta} (sin IGV)`} valor={soles(datosDeLista[PRECIO_DE[r.clave]])} />)}
          </GrupoDeCifras>
          <p className="sr-only">{resumenDeLista(datosDeLista)}</p>
        </section>
      ) : null}
      {lista ? (
        <div className="grid gap-4 sm:grid-cols-[16rem]">
          <CampoCantidad etiqueta="Cantidad" valor={cantidad} unidad={datosDeLista?.unidad} error={errorDeCantidad} alCambiar={setCantidad} />
        </div>
      ) : (
        <EstadoVacio titulo="Elige un producto para empezar" descripcion="Verás sus precios y, al escribir la cantidad, cuánto cuesta." icono="buscar" />
      )}
      {consultable && precio.isPending ? <p role="status" className="text-texto-suave">Calculando…</p> : null}
      {consultable && precio.isError ? <p role="alert" className="text-sm font-medium text-peligro">{precio.error.message}</p> : null}
      {consultable && precio.data ? (
        <section aria-label="Resultado" className="flex flex-col gap-2">
          <GrupoDeCifras etiqueta="Precio de esta cantidad">
            <Cifra etiqueta="Precio (sin IGV)" valor={soles(precio.data.importeCentimos)} />
            <Cifra etiqueta={`IGV (${precio.data.igvPorcentaje} %)`} valor={soles(precio.data.igvCentimos)} />
            <Cifra etiqueta="Total" valor={soles(precio.data.totalCentimos)} tono="exito" />
            <Cifra etiqueta={`Cada ${precio.data.unidad}`} valor={`S/ ${milesimasATexto(precio.data.precioUnitarioMilesimas)}`} ayuda="Sin IGV" />
          </GrupoDeCifras>
          <p className="text-sm text-texto-suave">
            {precio.data.ajusteClientePct ? `Incluye el ajuste del cliente (${precio.data.ajusteClientePct} %). ` : ''}
            {precio.data.minimoAplicado ? 'Se aplicó el precio mínimo de la lista.' : ''}
          </p>
        </section>
      ) : null}
      {editar ? (
        <div className="flex justify-end">
          <Boton variante="primario" cargando={creando} disabled={!consultable || !precio.data} onClick={() => void crear()}>Crear cotización</Boton>
        </div>
      ) : null}
    </div>
  );
}
