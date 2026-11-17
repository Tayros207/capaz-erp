import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { AjusteDePrecio as AjusteEnviado, ProductoCotizableDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoUnidad } from '../../shared/ui/campo-unidad.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { AjusteDePrecio } from './ajuste-de-precio.tsx';
import { buscarProductosParaCotizar, consultarPrecio } from './api.ts';
import { useUnidadesDeLaEmpresa } from './use-unidades.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { soles } from './logica.ts';
import { opcionDeProducto } from './logica-catalogo.ts';
import { ajusteParaEnviar } from './logica-precio.ts';
import { validarLinea, type ErroresDeLinea, type LineaDeFormulario } from './logica-cotizaciones.ts';

type Props = { linea: LineaDeFormulario; esNueva: boolean; clienteId: string | null; alGuardar: (l: LineaDeFormulario) => void; alQuitar: () => void; alCerrar: () => void };

/** El precio de una línea de lista lo calcula el servidor (`precio_consultar`); aquí solo se muestra. */
function PrecioDeLista({ l, clienteId }: { l: LineaDeFormulario; clienteId: string | null }) {
  const cantidad = useRetardo(l.cantidadMilesimas);
  const ajuste = JSON.parse(useRetardo(JSON.stringify(ajusteParaEnviar(l.ajuste)))) as AjusteEnviado;
  const listo = l.lista !== null && cantidad !== null && cantidad === l.cantidadMilesimas && cantidad > 0;
  const q = useQuery({
    queryKey: [...CLAVE_COTIZADOR, 'precio-linea', l.lista?.id, clienteId, cantidad, ajuste],
    queryFn: async () => datosOError(await consultarPrecio({ listaId: l.lista?.id ?? '', cantidadMilesimas: cantidad ?? 0, ...(clienteId && { clienteId }), ajuste })),
    enabled: listo,
    retry: false,
  });
  if (!listo) return null;
  if (q.isPending) return <p role="status" className="text-texto-suave">Calculando…</p>;
  if (q.isError) return <p role="alert" className="text-sm font-medium text-peligro">{q.error.message}</p>;
  return (
    <GrupoDeCifras etiqueta="Precio de esta línea">
      <Cifra etiqueta="Precio (sin IGV)" valor={soles(q.data.importeCentimos)} ayuda={`Cada ${q.data.unidad}: S/ ${milesimasATexto(q.data.precioUnitarioMilesimas)}${q.data.importeCentimos !== q.data.precioListaCentimos ? ` · Precio de lista: ${soles(q.data.precioListaCentimos)}` : ''}`} />
      <Cifra etiqueta={`Total con IGV (${q.data.igvPorcentaje} %)`} valor={soles(q.data.totalCentimos)} />
    </GrupoDeCifras>
  );
}

function Contenido({ linea, esNueva, clienteId, alGuardar, alQuitar, alCerrar }: Props) {
  const unidadesDeLaEmpresa = useUnidadesDeLaEmpresa();
  const [l, setL] = useState(linea);
  const [errores, setErrores] = useState<ErroresDeLinea>({});
  const encontrados = useRef(new Map<string, ProductoCotizableDto>());
  const [sinPrecio, setSinPrecio] = useState<ProductoCotizableDto | null>(null);

  async function buscar(texto: string) {
    const { items } = datosOError(await buscarProductosParaCotizar(texto));
    const opciones = items.map((p) => ({ p, o: opcionDeProducto(p) }));
    for (const { p, o } of opciones) encontrados.current.set(o.id, p);
    return opciones.map(({ o }) => o);
  }
  /** Lista: se cotiza por escala. Catálogo: pasa a línea manual con el producto y su precio sin IGV. Sin precio: se avisa. */
  function elegir(p: ProductoCotizableDto | null) {
    setSinPrecio(p?.origen === 'sin_precio' ? p : null);
    if (!p) return setL((a) => ({ ...a, lista: null }));
    if (p.origen === 'lista') return setL((a) => ({ ...a, lista: opcionDeProducto(p), productoId: p.productoId, unidad: p.unidad }));
    if (p.origen === 'catalogo') return setL((a) => ({ ...a, tipo: 'manual', lista: null, productoId: p.productoId, descripcion: p.nombre, unidad: p.unidad, precioUnitarioMilesimas: p.precioCatalogoSinIgvMilesimas ?? null }));
    setL((a) => ({ ...a, lista: null }));
  }
  /** Un producto sin precio también se puede cotizar escribiendo el precio a mano, sin perder el enlace con el catálogo. */
  function escribirPrecio(p: ProductoCotizableDto) {
    setSinPrecio(null);
    setL((a) => ({ ...a, tipo: 'manual', lista: null, productoId: p.productoId, descripcion: p.nombre, unidad: p.unidad }));
  }
  function guardar() {
    const e = validarLinea(l);
    setErrores(e);
    if (Object.keys(e).length === 0) alGuardar(l);
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); guardar(); }}>
      <CampoSelect etiqueta="De dónde sale el precio" value={l.tipo} disabled={!esNueva} onChange={(e) => setL((a) => ({ ...a, tipo: e.target.value as 'lista' | 'manual' }))}>
        <option value="lista">De mi catálogo y lista de precios</option>
        <option value="manual">Escribo el precio yo</option>
      </CampoSelect>
      {l.tipo === 'lista' ? (
        <>
          <SelectorDeRegistro
            etiqueta="Producto"
            valor={l.lista ?? (sinPrecio ? opcionDeProducto(sinPrecio) : null)}
            alCambiar={(o) => elegir(o ? (encontrados.current.get(o.id) ?? null) : null)}
            buscar={buscar}
            error={errores.lista}
            ayuda="Busca en tu catálogo de productos."
            textoSinResultados="Ningún producto se parece a eso"
          />
          {sinPrecio ? (
            <div role="status" className="flex flex-col items-start gap-2 text-sm text-texto-suave">
              <p>Este producto no tiene precio. Fíjalo en la lista de precios o escribe el precio tú.</p>
              <Boton variante="secundario" onClick={() => escribirPrecio(sinPrecio)}>Escribir el precio yo</Boton>
            </div>
          ) : null}
          <Campo etiqueta="Descripción (opcional)" maxLength={300} value={l.descripcion} ayuda="Si la dejas vacía se usa el nombre del producto." onChange={(e) => setL((a) => ({ ...a, descripcion: e.target.value }))} />
        </>
      ) : (
        <>
          {l.productoId ? <div><Insignia tono="neutro">Producto del catálogo</Insignia></div> : null}
          <Campo etiqueta="Descripción" maxLength={300} value={l.descripcion} error={errores.descripcion} onChange={(e) => setL((a) => ({ ...a, descripcion: e.target.value }))} />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoCantidad etiqueta="Cantidad" valor={l.cantidadMilesimas} unidad={l.unidad} error={errores.cantidad} alCambiar={(v) => setL((a) => ({ ...a, cantidadMilesimas: v }))} />
        {l.tipo === 'manual' ? (
          <>
            <CampoUnidad unidadesDeLaEmpresa={unidadesDeLaEmpresa} valor={l.unidad} alCambiar={(u) => setL((a) => ({ ...a, unidad: u }))} />
            <CampoPrecio etiqueta="Precio unitario" valor={l.precioUnitarioMilesimas} error={errores.precio} ayuda="Sin IGV." alCambiar={(v) => setL((a) => ({ ...a, precioUnitarioMilesimas: v }))} />
          </>
        ) : null}
      </div>
      {l.tipo === 'lista' && l.lista ? <AjusteDePrecio ajuste={l.ajuste} error={errores.ajuste} alCambiar={(ajuste) => setL((a) => ({ ...a, ajuste }))} /> : null}
      {l.tipo === 'lista' ? <PrecioDeLista l={l} clienteId={clienteId} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {esNueva ? null : <Boton variante="peligro" onClick={alQuitar}>Quitar línea</Boton>}
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario">{esNueva ? 'Agregar línea' : 'Guardar línea'}</Boton>
      </div>
    </form>
  );
}

/** Hoja para agregar o cambiar una línea. `linea` nula = cerrada. */
export function HojaLineaDeCotizacion({ linea, ...resto }: Omit<Props, 'linea'> & { linea: LineaDeFormulario | null }) {
  return (
    <HojaInferior abierto={linea !== null} alCerrar={resto.alCerrar} titulo={resto.esNueva ? 'Nueva línea' : 'Editar línea'}>
      {linea ? <Contenido key={linea.clave} linea={linea} {...resto} /> : null}
    </HojaInferior>
  );
}
