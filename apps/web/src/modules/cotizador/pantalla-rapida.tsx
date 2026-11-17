import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ListaDePrecioDto, ProductoCotizableDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { refrescarCotizador } from './acciones.ts';
import { buscarClientes, buscarProductosParaCotizar, consultarPrecio, crearCotizacion, verConfiguracion } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { HojaDeLista } from './hoja-lista.tsx';
import { REFERENCIAS, soles, argumentosDeCotizacionRapida, mensajeDeRechazo, resumenDeLista, rutaDeCotizacion, validarCantidadRapida } from './logica.ts';
import { calcularParaMostrar, opcionDeProducto, productoParaLista, textoSinPrecio, validarCantidadDeCatalogo } from './logica-catalogo.ts';
import { SeccionesDelCotizador } from './marco.tsx';
import { usePermisosDelCotizador } from './use-cotizador.ts';

const PRECIO_DE: Record<(typeof REFERENCIAS)[number]['clave'], 'p100Centimos' | 'p1000Centimos' | 'p5000Centimos'> = {
  p100: 'p100Centimos', p1000: 'p1000Centimos', p5000: 'p5000Centimos',
};

function PreciosDeLista({ lista }: { lista: ListaDePrecioDto }) {
  return (
    <section aria-label="Precios de la lista" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-lg font-semibold text-texto">{lista.nombre}</h2>
        <Insignia tono="info">Precios por escala</Insignia>
        {lista.porRevisar ? <Insignia tono="aviso">Revisar precios</Insignia> : null}
      </div>
      <GrupoDeCifras etiqueta="Precios de referencia, sin IGV">
        {REFERENCIAS.map((r) => <Cifra key={r.clave} etiqueta={`${r.etiqueta} (sin IGV)`} valor={soles(lista[PRECIO_DE[r.clave]])} />)}
      </GrupoDeCifras>
      <p className="sr-only">{resumenDeLista(lista)}</p>
    </section>
  );
}

/** Producto sin lista: se cotiza con el precio del catálogo; el servidor recalcula al crear. */
function PrecioDeCatalogo({ p, cantidad, igv, alFijar }: { p: ProductoCotizableDto; cantidad: number | null; igv: number | undefined; alFijar?: () => void }) {
  const unitario = p.precioCatalogoSinIgvMilesimas ?? 0;
  const c = cantidad !== null && igv !== undefined && validarCantidadDeCatalogo(cantidad) === undefined ? calcularParaMostrar(cantidad, unitario, igv) : null;
  return (
    <section aria-label="Precio del catálogo" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-lg font-semibold text-texto">{p.nombre}</h2>
        <Insignia tono="neutro">Precio del catálogo</Insignia>
        {alFijar ? <Boton variante="secundario" onClick={alFijar}>Fijar precios por escala</Boton> : null}
      </div>
      <GrupoDeCifras etiqueta="Precio de esta cantidad">
        <Cifra etiqueta={`Cada ${p.unidad} (sin IGV)`} valor={`S/ ${milesimasATexto(unitario)}`} />
        {c ? <Cifra etiqueta="Importe (sin IGV)" valor={soles(c.importeCentimos)} /> : null}
        {c ? <Cifra etiqueta={`IGV (${igv} %)`} valor={soles(c.igvCentimos)} /> : null}
        {c ? <Cifra etiqueta="Total" valor={soles(c.totalCentimos)} tono="exito" /> : null}
      </GrupoDeCifras>
    </section>
  );
}

/** Cotización rápida: elige qué cotizar (catálogo o lista), escribe la cantidad y ve precio, IGV y total. */
export function PantallaRapida() {
  const navegar = useNavigate();
  const { editar, configurar } = usePermisosDelCotizador();
  const encontrados = useRef(new Map<string, ProductoCotizableDto>());
  const [elegido, setElegido] = useState<ProductoCotizableDto | null>(null);
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [fijando, setFijando] = useState(false);

  const esLista = elegido?.origen === 'lista';
  const esCatalogo = elegido?.origen === 'catalogo';
  const cantidadConsultada = useRetardo(cantidad);
  const errorDeCantidad = cantidad === null || !elegido ? undefined : esLista ? validarCantidadRapida(cantidad) : validarCantidadDeCatalogo(cantidad);
  const consultable = esLista && cantidadConsultada !== null && cantidadConsultada === cantidad && validarCantidadRapida(cantidadConsultada) === undefined;
  const precio = useQuery({
    queryKey: [...CLAVE_COTIZADOR, 'precio', elegido?.listaId, cliente?.id ?? null, cantidadConsultada],
    queryFn: async () => datosOError(await consultarPrecio({ listaId: elegido?.listaId ?? '', cantidadMilesimas: cantidadConsultada ?? 0, ...(cliente && { clienteId: cliente.id }), ajuste: { tipo: 'ninguno' } })),
    enabled: consultable,
    retry: false,
  });
  const configuracion = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'configuracion'], queryFn: async () => datosOError(await verConfiguracion()), enabled: esCatalogo });

  async function buscarQueCotizar(texto: string) {
    const { items } = datosOError(await buscarProductosParaCotizar(texto));
    const opciones = items.map((p) => ({ p, o: opcionDeProducto(p) }));
    for (const { p, o } of opciones) encontrados.current.set(o.id, p);
    return opciones.map(({ o }) => o);
  }
  async function buscarDeClientes(texto: string) {
    const { items } = datosOError(await buscarClientes(texto));
    return items.map((c) => ({ id: c.id, nombre: c.nombre }));
  }

  const puedeCrear = elegido !== null && (esLista ? consultable && !!precio.data : esCatalogo && errorDeCantidad === undefined && cantidad !== null);
  async function crear() {
    if (!elegido || cantidad === null || !puedeCrear) return;
    setCreando(true);
    const r = await crearCotizacion(argumentosDeCotizacionRapida(elegido, cantidad, cliente));
    setCreando(false);
    if (r.ok && 'datos' in r) {
      await refrescarCotizador();
      notificar('Cotización creada como borrador.', 'exito');
      void navegar(rutaDeCotizacion(r.datos.id));
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }
  /** Tras fijar los precios por escala, la siguiente consulta sale por la lista. */
  const alFijar = (l: ListaDePrecioDto) => setElegido({ productoId: l.productoId, listaId: l.id, nombre: l.nombre, unidad: l.unidad, origen: 'lista', lista: l });
  const producto = elegido ? productoParaLista(elegido) : null;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Cotización rápida" />
      <SeccionesDelCotizador />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorDeRegistro
          etiqueta="Producto"
          valor={elegido ? opcionDeProducto(elegido) : null}
          alCambiar={(o) => { setElegido(o ? (encontrados.current.get(o.id) ?? null) : null); setCantidad(null); }}
          buscar={buscarQueCotizar}
          ayuda="Busca en tu catálogo de productos."
          textoSinResultados="Ningún producto se parece a eso"
          {...(configurar && { alCrear: () => void navegar('/productos'), textoCrear: 'Crear un producto en el catálogo' })}
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
      {elegido?.origen === 'lista' && elegido.lista ? <PreciosDeLista lista={elegido.lista} /> : null}
      {esCatalogo && elegido ? <PrecioDeCatalogo p={elegido} cantidad={cantidad} igv={configuracion.data?.igvPorcentaje} {...(configurar && producto && { alFijar: () => setFijando(true) })} /> : null}
      {elegido?.origen === 'sin_precio' ? (
        <EstadoVacio
          titulo="Este producto no tiene precio"
          descripcion={textoSinPrecio(configurar)}
          icono="caja"
          accion={configurar && producto ? <Boton variante="primario" onClick={() => setFijando(true)}>Fijar precio</Boton> : undefined}
        />
      ) : elegido ? (
        <div className="grid gap-4 sm:grid-cols-[16rem]">
          <CampoCantidad etiqueta="Cantidad" valor={cantidad} unidad={elegido.unidad} error={errorDeCantidad} alCambiar={setCantidad} />
        </div>
      ) : (
        <EstadoVacio titulo="Elige un producto para empezar" descripcion="Busca en tu catálogo. Si tiene precios por escala se usan; si no, se cotiza con su precio del catálogo." icono="buscar" />
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
          <Boton variante="primario" cargando={creando} disabled={!puedeCrear} onClick={() => void crear()}>Crear cotización</Boton>
        </div>
      ) : null}
      <HojaDeLista abierto={fijando} lista={null} producto={producto} alGuardar={alFijar} alCerrar={() => setFijando(false)} />
    </div>
  );
}
