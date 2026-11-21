import { useEffect, useRef, useState } from 'react';
import { centimosSchema, type ProductoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearCantidad, milesimasATexto, textoAMilesimas } from '../../shared/formato/milesimas.ts';
import { formatearSoles, centimosATexto, textoACentimos } from '../../shared/formato/soles.ts';
import { GRUPOS_DE_UNIDADES, unidadConocida } from '../../shared/formato/unidades.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CLASES_DE_CONTROL } from '../../shared/ui/campo-comun.ts';
import { precioParaUsar } from '../../shared/api/logica-precio-anterior.ts';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { FichaDeMaquina } from '../../shared/ui/ficha-de-maquina.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { SugerenciaDePrecio } from '../../shared/ui/sugerencia-de-precio.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { buscarProductos, primerosProductos } from './api.ts';
import { MAXIMO_DE_FILAS, agregarDesdeCatalogo, alEnterEnImporte, cambiarCantidad, cambiarImporte, cambiarPrecio, cambiarUnidad, cuadra, importeMostrado, quitarFila, usarPrecioAnterior } from './logica-filas.ts';
import { lineaVacia, totalesDe, type ErroresDeLinea, type LineaDeFormulario } from './logica.ts';

type Props = {
  lineas: LineaDeFormulario[];
  igvPorcentaje: number;
  /** El cliente del pedido: con él, cada fila puede sugerir lo que se le cobró la última vez. */
  clienteId?: string | null;
  /** Errores por clave de fila. */
  errores?: Record<string, ErroresDeLinea>;
  error?: string;
  /** Pedido entregado: solo se tocan precio, importe e IGV; lo demás queda fijo. */
  soloPrecio?: boolean;
  alCambiar: (lineas: LineaDeFormulario[]) => void;
};

// En pantallas anchas cada fila es una fila de tabla; a 390 px, una tarjeta «Ítem N» con sus etiquetas a la vista.
const COLUMNAS = 'md:grid md:grid-cols-[2.5rem_minmax(0,1fr)_6rem_8rem_7rem_7rem_3.5rem_2.75rem] md:items-start md:gap-2';
const CONTROL = unir(CLASES_DE_CONTROL, 'border-borde-fuerte');
const soles = (c: number | null) => (c === null ? '—' : formatearSoles(c));

function Celda({ etiqueta, error, children }: { etiqueta: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-texto md:sr-only">{etiqueta}</span>
      {children}
      {error ? <span role="alert" className="text-sm font-medium text-peligro">{error}</span> : null}
    </div>
  );
}

type NumericaProps = {
  valor: number | null;
  aTexto: (v: number) => string;
  aValor: (texto: string) => number | null;
  alCambiar: (v: number | null) => void;
  alEnter?: () => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'>;

/** Celda numérica: guarda lo que se teclea mientras se escribe («12.» o «1,2») y solo al salir muestra el valor formateado. */
function CeldaNumerica({ valor, aTexto, aValor, alCambiar, alEnter, className, ...resto }: NumericaProps) {
  const [escrito, setEscrito] = useState<string | null>(null);
  return (
    <input
      inputMode="decimal"
      className={unir(CONTROL, 'text-right tabular-nums', className)}
      value={escrito ?? (valor === null ? '' : aTexto(valor))}
      onChange={(ev) => { setEscrito(ev.target.value); alCambiar(aValor(ev.target.value)); }}
      onBlur={() => setEscrito(null)}
      onKeyDown={alEnter ? (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); alEnter(); } } : undefined}
      {...resto}
    />
  );
}

const aCentimosTexto = (n: number) => centimosATexto(centimosSchema.parse(n));
const deCentimos = (t: string) => (t.trim() === '' ? null : textoACentimos(t));
const deMilesimas = (t: string) => (t.trim() === '' ? null : textoAMilesimas(t));

/** Agregar desde el catálogo: un buscador en la misma hoja que llena la última fila en blanco o agrega una. */
function BuscadorDeCatalogo({ alElegir, alCerrar }: { alElegir: (p: ProductoDto) => void; alCerrar: () => void }) {
  const encontrados = useRef(new Map<string, ProductoDto>());
  const guardar = (items: ProductoDto[]) => {
    for (const p of items) encontrados.current.set(p.id, p);
    return items.map((p) => ({ id: p.id, nombre: p.nombre, detalle: `S/ ${milesimasATexto(p.precioUnitarioMilesimas)} por ${p.unidad}` }));
  };
  return (
    <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie p-3">
      <SelectorDeRegistro
        etiqueta="Producto del catálogo"
        valor={null}
        alCambiar={(o) => { const p = o ? encontrados.current.get(o.id) : undefined; if (p) alElegir(p); }}
        buscar={async (t) => guardar(datosOError(await buscarProductos(t)).items)}
        buscarSinTexto={async () => guardar(datosOError(await primerosProductos()).items)}
        textoSinResultados="Ningún producto se parece a eso"
      />
      <div><Boton variante="fantasma" onClick={alCerrar}>Cerrar el catálogo</Boton></div>
    </div>
  );
}

/** Las filas del pedido en línea (con sus totales): lo último que se escribe, precio o importe, manda. */
export function FilasDePedido({ lineas, igvPorcentaje, clienteId, errores = {}, error, soloPrecio = false, alCambiar }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const foco = useRef<string | null>(null);
  const [catalogo, setCatalogo] = useState(false);
  const totales = totalesDe(lineas, igvPorcentaje);
  useEffect(() => {
    if (!foco.current) return;
    raiz.current?.querySelector<HTMLInputElement>(`[data-clave="${foco.current}"] [data-campo="descripcion"]`)?.focus();
    foco.current = null;
  }, [lineas]);

  const cambiar = (clave: string, fn: (l: LineaDeFormulario) => LineaDeFormulario) => alCambiar(lineas.map((l) => (l.clave === clave ? fn(l) : l)));
  const enter = (clave: string) => {
    const r = alEnterEnImporte(lineas, clave, crypto.randomUUID());
    foco.current = r.foco;
    if (r.foco) alCambiar(r.lineas);
  };
  const llena = lineas.length >= MAXIMO_DE_FILAS;

  return (
    <section aria-label="Detalle del pedido" className="flex flex-col gap-3">
      <h2 className="font-titulo font-semibold text-texto">Detalle</h2>
      <div ref={raiz} className="flex flex-col gap-3">
        <div aria-hidden="true" className={unir(COLUMNAS, 'hidden border-b border-borde pb-2 text-sm font-medium text-texto-suave')}>
          <span>N.º</span><span>Descripción</span><span className="text-right">Cantidad</span><span>Unidad</span><span className="text-right">P. unitario</span><span className="text-right">Importe</span><span className="text-center">IGV</span><span />
        </div>
        {lineas.map((l, i) => {
          const e = errores[l.clave] ?? {};
          const n = i + 1;
          const unidadFuera = unidadConocida(l.unidad) === undefined;
          return (
            <div key={l.clave} data-clave={l.clave} className={unir(COLUMNAS, 'flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-3 md:rounded-none md:border-0 md:bg-transparent md:p-0')}>
              <span className="font-titulo font-semibold text-texto md:pt-2.5 md:text-center md:font-medium">
                <span className="md:hidden">Ítem {n}</span>
                <span aria-hidden="true" className="hidden md:inline">{n}</span>
              </span>
              <Celda etiqueta="Descripción" error={e.descripcion}>
                <input data-campo="descripcion" disabled={soloPrecio} aria-label={`Descripción del ítem ${n}`} aria-invalid={e.descripcion ? true : undefined} className={CONTROL} maxLength={300} value={l.descripcion} onChange={(ev) => cambiar(l.clave, (a) => ({ ...a, descripcion: ev.target.value }))} />
                <SugerenciaDePrecio
                  clienteId={clienteId}
                  productoId={l.producto?.id}
                  descripcion={l.descripcion}
                  conIgv
                  precioActualMilesimas={l.precioUnitarioMilesimas}
                  alUsar={(p) => cambiar(l.clave, (a) => usarPrecioAnterior(a, precioParaUsar(p, true), p.unidad))}
                />
              </Celda>
              <div className="grid grid-cols-2 gap-3 md:contents">
                <Celda etiqueta="Cantidad" error={e.cantidad}>
                  <CeldaNumerica disabled={soloPrecio} aria-label={`Cantidad del ítem ${n}`} aria-invalid={e.cantidad ? true : undefined} valor={l.cantidadMilesimas} aTexto={(v) => formatearCantidad(v)} aValor={deMilesimas} alCambiar={(v) => cambiar(l.clave, (a) => cambiarCantidad(a, v))} />
                </Celda>
                <Celda etiqueta="Unidad">
                  <select disabled={soloPrecio} aria-label={`Unidad del ítem ${n}`} className={CONTROL} value={l.unidad} onChange={(ev) => cambiar(l.clave, (a) => cambiarUnidad(a, ev.target.value))}>
                    {unidadFuera ? <option value={l.unidad}>{l.unidad}</option> : null}
                    {GRUPOS_DE_UNIDADES.map((g) => (
                      <optgroup key={g.grupo} label={g.grupo}>
                        {g.unidades.map((u) => <option key={u.valor} value={u.valor}>{u.nombre} ({u.valor})</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Celda>
                <Celda etiqueta="P. unitario (con IGV)" error={e.precio}>
                  <CeldaNumerica aria-label={`Precio unitario del ítem ${n}`} aria-invalid={e.precio ? true : undefined} valor={l.precioUnitarioMilesimas} aTexto={milesimasATexto} aValor={deMilesimas} alCambiar={(v) => cambiar(l.clave, (a) => cambiarPrecio(a, v))} />
                </Celda>
                <Celda etiqueta="Importe (con IGV)">
                  <CeldaNumerica data-campo="importe" aria-label={`Importe del ítem ${n}`} valor={importeMostrado(l)} aTexto={aCentimosTexto} aValor={deCentimos} alCambiar={(v) => cambiar(l.clave, (a) => cambiarImporte(a, v))} alEnter={() => enter(l.clave)} />
                </Celda>
              </div>
              <label className="flex min-h-(--alto-control) cursor-pointer items-center gap-2 md:justify-center">
                <input type="checkbox" aria-label={`IGV del ítem ${n}`} checked={l.afectoIgv} onChange={(ev) => cambiar(l.clave, (a) => ({ ...a, afectoIgv: ev.target.checked }))} className="size-5 cursor-pointer accent-accion" />
                <span className="text-sm font-medium text-texto md:sr-only">Afecto a IGV</span>
              </label>
              <div className="flex justify-end md:justify-center">
                <Boton variante="fantasma" icono="cerrar" aria-label={`Quitar el ítem ${n}`} disabled={soloPrecio || lineas.length <= 1} onClick={() => alCambiar(quitarFila(lineas, l.clave))} />
              </div>
              {!cuadra(l) ? <p className="text-sm text-texto-suave md:col-span-8">El unitario guarda tres decimales: el importe queda en {soles(importeMostrado(l))}</p> : null}
              <FichaDeMaquina n={n} valores={l} deshabilitado={soloPrecio} className="md:col-span-8" alCambiar={(campo, valor) => cambiar(l.clave, (a) => ({ ...a, [campo]: valor }))} />
            </div>
          );
        })}
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-peligro">{error}</p> : null}
      {soloPrecio ? null : <div className="flex flex-wrap gap-2">
        <Boton icono="mas" disabled={llena} onClick={() => alCambiar([...lineas, lineaVacia(crypto.randomUUID())])}>Agregar fila</Boton>
        <Boton icono="caja" disabled={llena} aria-expanded={catalogo} onClick={() => setCatalogo((a) => !a)}>Agregar desde el catálogo</Boton>
      </div>}
      {catalogo && !soloPrecio ? <BuscadorDeCatalogo alCerrar={() => setCatalogo(false)} alElegir={(p) => { alCambiar(agregarDesdeCatalogo(lineas, p, crypto.randomUUID())); setCatalogo(false); }} /> : null}
      <GrupoDeCifras etiqueta="Totales del pedido">
        <Cifra etiqueta="Subtotal" valor={soles(totales?.subtotalCentimos ?? null)} />
        <Cifra etiqueta={`IGV ${igvPorcentaje} %`} valor={soles(totales?.igvCentimos ?? null)} />
        <Cifra etiqueta="Total" valor={soles(totales?.totalCentimos ?? null)} ayuda="Los precios ya incluyen IGV." />
      </GrupoDeCifras>
    </section>
  );
}
