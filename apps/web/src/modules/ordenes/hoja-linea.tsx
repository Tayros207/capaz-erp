import { useRef, useState } from 'react';
import { centimosSchema, type Centimos, type ProductoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { unitarioDeTotal } from '../../shared/formato/precio-total.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoUnidad } from '../../shared/ui/campo-unidad.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Cifra } from '../../shared/ui/cifra.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarProductos, primerosProductos } from './api.ts';
import { conProducto, importeDeLinea, validarLinea, type ErroresDeLinea, type LineaDeFormulario } from './logica.ts';

type Props = { linea: LineaDeFormulario; esNueva: boolean; alGuardar: (l: LineaDeFormulario) => void; alQuitar: () => void; alCerrar: () => void };

function Contenido({ linea, esNueva, alGuardar, alQuitar, alCerrar }: Props) {
  const [l, setL] = useState(linea);
  const [errores, setErrores] = useState<ErroresDeLinea>({});
  // Lo último que devolvió la búsqueda, para llenar la línea con los datos del producto elegido.
  const encontrados = useRef(new Map<string, ProductoDto>());
  const importe = importeDeLinea(l);
  // El precio se puede escribir de dos maneras: el unitario, o el total del trabajo (y el unitario sale solo). Manda lo último tecleado.
  const [fuente, setFuente] = useState<'unitario' | 'total'>('unitario');
  const [totalEscrito, setTotalEscrito] = useState<Centimos | null>(null);
  const total = fuente === 'total' ? totalEscrito : importe === null ? null : centimosSchema.parse(importe);
  const reparto = fuente === 'total' ? unitarioDeTotal(totalEscrito, l.cantidadMilesimas) : null;

  const conUnitarioDeTotal = (a: LineaDeFormulario, t: Centimos | null, cantidad: number | null): LineaDeFormulario => ({
    ...a, cantidadMilesimas: cantidad, precioUnitarioMilesimas: unitarioDeTotal(t, cantidad)?.precioUnitarioMilesimas ?? null,
  });
  const alTotal = (t: Centimos | null) => {
    setFuente('total');
    setTotalEscrito(t);
    setL((a) => conUnitarioDeTotal(a, t, a.cantidadMilesimas));
  };
  const alCantidad = (c: number | null) => setL((a) => (fuente === 'total' ? conUnitarioDeTotal(a, totalEscrito, c) : { ...a, cantidadMilesimas: c }));
  const alUnitario = (v: number | null) => {
    setFuente('unitario');
    setL((a) => ({ ...a, precioUnitarioMilesimas: v }));
  };

  const aLinea = (p: ProductoDto) => ({ id: p.id, nombre: p.nombre, detalle: `S/ ${milesimasATexto(p.precioUnitarioMilesimas)} por ${p.unidad}` });
  async function buscar(texto: string) {
    const { items } = datosOError(await buscarProductos(texto));
    for (const p of items) encontrados.current.set(p.id, p);
    return items.map(aLinea);
  }
  async function primeros() {
    const { items } = datosOError(await primerosProductos());
    for (const p of items) encontrados.current.set(p.id, p);
    return items.map(aLinea);
  }

  function guardar() {
    const e = validarLinea(l);
    setErrores(e);
    if (Object.keys(e).length === 0) alGuardar(l);
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        guardar();
      }}
    >
      <SelectorDeRegistro
        etiqueta="Producto"
        valor={l.producto}
        alCambiar={(o) => {
          setFuente('unitario');
          setL((a) => conProducto(a, o ? (encontrados.current.get(o.id) ?? null) : null));
        }}
        buscar={buscar}
        buscarSinTexto={primeros}
        ayuda="Opcional: búscalo en tu catálogo o escribe abajo lo que se pide."
        textoSinResultados="Ningún producto se parece a eso"
      />
      <Campo etiqueta="Descripción" value={l.descripcion} maxLength={300} error={errores.descripcion} onChange={(e) => setL((a) => ({ ...a, descripcion: e.target.value }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoCantidad etiqueta="Cantidad" valor={l.cantidadMilesimas} unidad={l.unidad} error={errores.cantidad} alCambiar={alCantidad} />
        <CampoUnidad valor={l.unidad} alCambiar={(unidad) => setL((a) => ({ ...a, unidad }))} />
        <CampoMonto
          etiqueta="Precio total del trabajo"
          valor={total}
          alCambiar={alTotal}
          ayuda={reparto && !reparto.exacto ? `El unitario guarda tres decimales: el importe queda en ${formatearSoles(reparto.importeCentimos)}.` : 'Con IGV incluido. Escríbelo y el precio unitario se calcula solo.'}
        />
        <CampoPrecio etiqueta="Precio unitario" valor={l.precioUnitarioMilesimas} error={errores.precio} ayuda="Con IGV incluido." alCambiar={alUnitario} />
        <CampoSelect etiqueta="IGV" value={l.afectoIgv ? 'si' : 'no'} onChange={(e) => setL((a) => ({ ...a, afectoIgv: e.target.value === 'si' }))}>
          <option value="si">Afecto (el precio lo incluye)</option>
          <option value="no">No afecto</option>
        </CampoSelect>
      </div>
      <Cifra etiqueta="Importe de la línea" valor={importe === null ? '—' : formatearSoles(importe)} />
      <div className="flex flex-wrap justify-end gap-2">
        {esNueva ? null : <Boton variante="peligro" onClick={alQuitar}>Quitar línea</Boton>}
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario">{esNueva ? 'Agregar línea' : 'Guardar línea'}</Boton>
      </div>
    </form>
  );
}

/** Hoja para agregar o cambiar una línea. `linea` nula = cerrada; el formulario se reinicia en cada apertura. */
export function HojaLinea({ linea, ...resto }: Omit<Props, 'linea'> & { linea: LineaDeFormulario | null }) {
  return (
    <HojaInferior abierto={linea !== null} alCerrar={resto.alCerrar} titulo={resto.esNueva ? 'Nueva línea' : 'Editar línea'}>
      {linea ? <Contenido key={linea.clave} linea={linea} {...resto} /> : null}
    </HojaInferior>
  );
}
