import { useRef } from 'react';
import type { Centimos } from '@capaz/shared';
import { precioParaUsar } from '../../shared/api/logica-precio-anterior.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoUnidad } from '../../shared/ui/campo-unidad.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { SugerenciaDePrecio } from '../../shared/ui/sugerencia-de-precio.tsx';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { buscarProductosParaLinea } from './api.ts';
import {
  claveSiguiente, cuadraFila, erroresDeProducto, filaConCantidad, filaConPrecio, filaConSubtotal, filaDeCatalogo, filaDeProductoVacia, filaLibre, MAXIMO_DE_LINEAS_DE_MOVIMIENTO,
  subtotalDeFila, type FilaDeProducto, type ProductoElegido,
} from './logica-lineas.ts';

type Props = {
  filas: FilaDeProducto[];
  alCambiar: (filas: FilaDeProducto[]) => void;
  /** Cliente del movimiento: con él se sugiere el precio de la última vez. */
  clienteId?: string | undefined;
  error?: string | undefined;
};

type PropsFila = { f: FilaDeProducto; n: number; clienteId: string | undefined; alCambiarFila: (f: FilaDeProducto) => void; alQuitar: () => void };

/** Elegir de qué producto es la fila: del catálogo o, si no está, escribirlo libre. */
function ElegirProducto({ f, n, alElegir, alQuitar }: { f: FilaDeProducto; n: number; alElegir: (nueva: FilaDeProducto) => void; alQuitar: () => void }) {
  const encontrados = useRef(new Map<string, ProductoElegido>());
  const buscar = async (texto: string): Promise<Opcion[]> => {
    const productos = await buscarProductosParaLinea(texto);
    for (const p of productos) encontrados.current.set(p.id, { id: p.id, nombre: p.nombre, unidad: p.unidad, precioUnitarioMilesimas: p.precioUnitarioMilesimas });
    return productos.map((p) => ({ id: p.id, nombre: p.nombre, detalle: `${p.unidad} · S/ ${milesimasATexto(p.precioUnitarioMilesimas)}` }));
  };
  return (
    <div role="group" aria-label={`Producto ${n}`} className="flex flex-col gap-2 rounded-control border border-borde p-3">
      <SelectorDeRegistro
        etiqueta={`Producto ${n}`}
        valor={null}
        alCambiar={(o) => { const p = o && encontrados.current.get(o.id); if (p) alElegir({ ...filaDeCatalogo(f.clave, p), cantidadMilesimas: f.cantidadMilesimas }); }}
        buscar={buscar}
        placeholder="Ej: Troquelado, etiquetas"
        textoSinResultados="No está en tu lista: toca «Producto nuevo» para escribirlo"
        alCrear={(texto) => alElegir({ ...filaLibre(f.clave, texto), cantidadMilesimas: f.cantidadMilesimas })}
        textoCrear="Producto nuevo"
        botonCrear="Producto nuevo (escribir)"
      />
      <Boton variante="fantasma" onClick={alQuitar}>Quitar</Boton>
    </div>
  );
}

function FilaEditable({ f, n, clienteId, alCambiarFila, alQuitar }: PropsFila) {
  const errores = erroresDeProducto(f);
  const sub = subtotalDeFila(f);
  return (
    <div role="group" aria-label={`Producto ${n}`} className="flex flex-col gap-3 rounded-control border border-borde p-3">
      <Campo etiqueta={`Producto ${n}`} maxLength={300} value={f.descripcion} error={errores.descripcion} onChange={(e) => alCambiarFila({ ...f, descripcion: e.target.value })} placeholder="Ej: Troquelado, 2 millares" />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoUnidad valor={f.unidad} alCambiar={(u) => alCambiarFila({ ...f, unidad: u })} />
        <CampoCantidad etiqueta="Cantidad" unidad={f.unidad} valor={f.cantidadMilesimas} error={errores.cantidad} alCambiar={(c) => alCambiarFila(filaConCantidad(f, c))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoPrecio etiqueta="Precio" valor={f.precioUnitarioMilesimas} error={errores.precio} alCambiar={(p) => alCambiarFila(filaConPrecio(f, p))} />
        <CampoMonto etiqueta="Importe" valor={sub as Centimos | null} ayuda={cuadraFila(f) ? undefined : 'El precio se guarda con 3 decimales y no da exacto este importe.'} alCambiar={(c) => alCambiarFila(filaConSubtotal(f, c))} />
      </div>
      <SugerenciaDePrecio clienteId={clienteId} productoId={f.productoId} descripcion={f.descripcion} conIgv precioActualMilesimas={f.precioUnitarioMilesimas} alUsar={(p) => alCambiarFila(filaConPrecio({ ...f, unidad: p.unidad.trim() || f.unidad }, precioParaUsar(p, true)))} />
      <Boton variante="fantasma" onClick={alQuitar}>Quitar</Boton>
    </div>
  );
}

/** Los productos de un movimiento: uno o varios, cada uno con cantidad y precio. El total manda sobre el monto. */
export function EditorDeProductos({ filas, alCambiar, clienteId, error }: Props) {
  const cambiarFila = (i: number, nueva: FilaDeProducto) => alCambiar(filas.map((x, j) => (j === i ? nueva : x)));
  const quitar = (i: number) => alCambiar(filas.filter((_, j) => j !== i));
  return (
    <section aria-label="Productos" className="flex flex-col gap-3">
      {filas.map((f, i) =>
        f.elegida ? (
          <FilaEditable key={f.clave} f={f} n={i + 1} clienteId={clienteId} alCambiarFila={(nueva) => cambiarFila(i, nueva)} alQuitar={() => quitar(i)} />
        ) : (
          <ElegirProducto key={f.clave} f={f} n={i + 1} alElegir={(nueva) => cambiarFila(i, nueva)} alQuitar={() => quitar(i)} />
        ),
      )}
      {error ? <p role="alert" className="text-sm font-medium text-peligro">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Boton variante="secundario" disabled={filas.length >= MAXIMO_DE_LINEAS_DE_MOVIMIENTO} onClick={() => alCambiar([...filas, filaDeProductoVacia(claveSiguiente(filas))])}>
          {filas.length === 0 ? 'Agregar productos' : 'Agregar otro producto'}
        </Boton>
      </div>
    </section>
  );
}
