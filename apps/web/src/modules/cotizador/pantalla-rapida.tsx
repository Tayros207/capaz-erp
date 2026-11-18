import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ListaDePrecioDto, ProductoCotizableDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { ChipDeCliente } from '../../shared/ui/entidades.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { AjusteDePrecio } from './ajuste-de-precio.tsx';
import { buscarClientes, buscarProductosParaCotizar } from './api.ts';
import { clientesIniciales } from './clientes-iniciales.ts';
import { HojaDeLista } from './hoja-lista.tsx';
import { productoParaLista, opcionDeProducto, textoSinPrecio } from './logica-catalogo.ts';
import { SeccionesDelCotizador } from './marco.tsx';
import { CantidadRapida } from './rapida-cantidad.tsx';
import { PrecioDeCatalogo, PreciosDeLista } from './rapida-precios.tsx';
import { ResultadoRapido } from './rapida-resultado.tsx';
import { useCotizacionRapida } from './use-cotizacion-rapida.ts';
import { usePermisosDelCotizador } from './use-cotizador.ts';

/** Cotización rápida: elige qué cotizar (catálogo o lista), escribe la cantidad y ve precio, IGV y total. */
export function PantallaRapida() {
  const navegar = useNavigate();
  const { editar, configurar } = usePermisosDelCotizador();
  const r = useCotizacionRapida();
  const encontrados = useRef(new Map<string, ProductoCotizableDto>());
  const [fijando, setFijando] = useState(false);
  const { elegido, cliente, cantidad, precio } = r;

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
  /** Tras fijar los precios por escala, la siguiente consulta sale por la lista. */
  const alFijar = (l: ListaDePrecioDto) => r.setElegido({ productoId: l.productoId, listaId: l.id, nombre: l.nombre, unidad: l.unidad, origen: 'lista', lista: l });
  const producto = elegido ? productoParaLista(elegido) : null;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Cotización rápida" />
      <SeccionesDelCotizador />
      {editar ? <p className="text-sm text-texto-suave">¿Un trabajo con varias partes? <Link to="/m/cotizador/cuadro/nuevo" className="font-medium text-accion underline-offset-2 hover:underline">Cotizar por partes</Link></p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorDeRegistro
          etiqueta="Producto"
          valor={elegido ? opcionDeProducto(elegido) : null}
          alCambiar={(o) => r.elegirProducto(o ? (encontrados.current.get(o.id) ?? null) : null)}
          buscar={buscarQueCotizar}
          buscarSinTexto={() => buscarQueCotizar('')}
          ayuda="Busca en tu catálogo de productos."
          textoSinResultados="Ningún producto se parece a eso"
          {...(configurar && { alCrear: () => void navegar('/productos'), textoCrear: 'Crear un producto en el catálogo' })}
        />
        <SelectorDeRegistro etiqueta="Cliente (opcional)" valor={cliente} alCambiar={r.setCliente} buscar={buscarDeClientes} buscarSinTexto={clientesIniciales} ayuda="Si tiene un precio especial, se aplica." textoSinResultados="Ningún cliente se parece a eso" />
      </div>
      {cliente ? <div><ChipDeCliente id={cliente.id} nombre={cliente.nombre} /></div> : null}
      {elegido?.origen === 'lista' && elegido.lista ? <PreciosDeLista lista={elegido.lista} /> : null}
      {r.esCatalogo && elegido ? <PrecioDeCatalogo p={elegido} cantidad={cantidad} igv={r.configuracion.data?.igvPorcentaje} {...(configurar && producto && { alFijar: () => setFijando(true) })} /> : null}
      {elegido?.origen === 'sin_precio' ? (
        <EstadoVacio
          titulo="Este producto no tiene precio"
          descripcion={textoSinPrecio(configurar)}
          icono="caja"
          accion={configurar && producto ? <Boton variante="primario" onClick={() => setFijando(true)}>Fijar precio</Boton> : undefined}
        />
      ) : elegido ? (
        <CantidadRapida unidad={elegido.unidad} cantidad={cantidad} error={r.errorDeCantidad} sePuedeFijar={r.esLista} alCambiar={r.setCantidad} alEnter={() => { if (r.puedeCrear && !r.creando) void r.crear(false); }} />
      ) : (
        <EstadoVacio titulo="Elige un producto para empezar" descripcion="Busca en tu catálogo. Si tiene precios por escala se usan; si no, se cotiza con su precio del catálogo." icono="buscar" />
      )}
      {r.consultable && precio.isPending ? <p role="status" className="text-texto-suave">Calculando…</p> : null}
      {r.consultable && precio.isError ? <p role="alert" className="text-sm font-medium text-peligro">{precio.error.message}</p> : null}
      {r.consultable && precio.data ? <ResultadoRapido precio={precio.data} /> : null}
      {r.esLista && r.consultable ? <AjusteDePrecio ajuste={r.ajuste} alCambiar={r.setAjuste} error={r.errorDeAjuste} /> : null}
      {editar ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="secundario" disabled={!r.puedeCrear || r.creando} onClick={() => void r.crear(false)}>Crear como borrador</Boton>
          <Boton variante="primario" cargando={r.creando} disabled={!r.puedeCrear} onClick={() => void r.crear(true)}>Crear y emitir</Boton>
        </div>
      ) : null}
      <HojaDeLista abierto={fijando} lista={null} producto={producto} alGuardar={alFijar} alCerrar={() => setFijando(false)} />
    </div>
  );
}
