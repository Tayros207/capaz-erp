import { useEffect, useRef } from 'react';
import { MAXIMO_DE_LINEAS_DE_COTIZACION } from '@capaz/shared';
import { milesimasATextoPlano, precioParaUsar } from '../../../shared/api/logica-precio-anterior.ts';
import { milesimasATexto } from '../../../shared/formato/milesimas.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { CLASES_DE_CONTROL } from '../../../shared/ui/campo-comun.ts';
import { SugerenciaDePrecio } from '../../../shared/ui/sugerencia-de-precio.tsx';
import { unir } from '../../../shared/ui/unir.ts';
import { alEnterEnImporte, calcularFila, filaVacia, opcionesDeUnidad, precioLeido, quitarFila, usarPrecioAnterior, type ErroresDeFila, type FilaDirecta } from './logica-directa.ts';

type Props = {
  filas: FilaDirecta[];
  incluyeIgv: boolean;
  igv: number;
  /** El cliente de la hoja: con él, cada fila puede sugerir lo que se le cobró la última vez. */
  clienteId?: string | null;
  unidades: readonly string[];
  errores: Record<string, ErroresDeFila>;
  errorGeneral?: string;
  soloLectura: boolean;
  nuevaClave: () => string;
  alCambiar: (filas: FilaDirecta[]) => void;
};

// En pantallas anchas cada fila es una fila de tabla; a 390 px, una tarjeta con sus etiquetas a la vista.
const COLUMNAS = 'md:grid md:grid-cols-[minmax(0,1fr)_6rem_7rem_8rem_8rem_2.75rem] md:items-start md:gap-2';
const CONTROL = unir(CLASES_DE_CONTROL, 'border-borde-fuerte');

function Celda({ etiqueta, error, children }: { etiqueta: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-texto md:sr-only">{etiqueta}</span>
      {children}
      {error ? <span role="alert" className="text-sm font-medium text-peligro">{error}</span> : null}
    </div>
  );
}

/** Cómo se leyó el precio tecleado («1.250» → «= S/ 1.25»), para que nadie emita S/ 1250 creyendo que escribió S/ 1.25. */
function PrecioLeido({ id, fila }: { id: string; fila: Pick<FilaDirecta, 'precio' | 'manda'> }) {
  const leido = precioLeido(fila);
  if (leido === null) return null;
  if (leido === 'ilegible') return <span id={id} className="text-right text-sm text-peligro">No se entiende</span>;
  return <span id={id} className="whitespace-nowrap text-right text-sm tabular-nums text-texto-suave">= S/ {milesimasATexto(leido)}</span>;
}

/** Las filas de la hoja: descripción, cantidad, unidad, precio e importe; lo último que se escribe manda. */
export function DirectaFilas({ filas, incluyeIgv, igv, clienteId, unidades, errores, errorGeneral, soloLectura, nuevaClave, alCambiar }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const foco = useRef<string | null>(null);
  useEffect(() => {
    if (!foco.current) return;
    raiz.current?.querySelector<HTMLInputElement>(`[data-clave="${foco.current}"] [data-campo="descripcion"]`)?.focus();
    foco.current = null;
  }, [filas]);

  const cambiar = (clave: string, parte: Partial<FilaDirecta>) => alCambiar(filas.map((f) => (f.clave === clave ? { ...f, ...parte } : f)));
  const enter = (clave: string) => {
    const r = alEnterEnImporte(filas, clave, nuevaClave());
    foco.current = r.foco;
    if (r.foco) alCambiar(r.filas);
  };

  return (
    <section aria-label="Filas de la cotización" className="flex flex-col gap-3">
      <div ref={raiz} className="flex flex-col gap-3">
        <div aria-hidden="true" className={unir(COLUMNAS, 'hidden border-b border-borde pb-2 text-sm font-medium text-texto-suave')}>
          <span>Descripción</span><span className="text-right">Cantidad</span><span>Unidad</span><span className="text-right">P. unitario</span><span className="text-right">Importe</span><span />
        </div>
        {filas.map((f, i) => {
          const c = calcularFila(f, incluyeIgv, igv);
          const e = errores[f.clave] ?? {};
          const textoPrecio = f.manda === 'precio' ? f.precio : c.textoDelOtro;
          const textoImporte = f.manda === 'importe' ? f.importe : c.textoDelOtro;
          const opciones = opcionesDeUnidad({ unidades: [...unidades, f.unidad] });
          return (
            <div key={f.clave} data-clave={f.clave} className={unir(COLUMNAS, 'flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-3 md:rounded-none md:border-0 md:bg-transparent md:p-0')}>
              <Celda etiqueta="Descripción" error={e.descripcion}>
                <input data-campo="descripcion" aria-label={`Descripción de la fila ${i + 1}`} aria-invalid={e.descripcion ? true : undefined} className={CONTROL} maxLength={300} value={f.descripcion} readOnly={soloLectura} onChange={(ev) => cambiar(f.clave, { descripcion: ev.target.value })} />
                {soloLectura ? null : (
                  <SugerenciaDePrecio
                    clienteId={clienteId}
                    descripcion={f.descripcion}
                    conIgv={incluyeIgv}
                    precioActualMilesimas={c.precioMilesimas}
                    alUsar={(p) => cambiar(f.clave, usarPrecioAnterior(f, milesimasATextoPlano(precioParaUsar(p, incluyeIgv)), p.unidad))}
                  />
                )}
              </Celda>
              <div className="grid grid-cols-2 gap-3 md:contents">
                <Celda etiqueta="Cantidad" error={e.cantidad}>
                  <input inputMode="decimal" aria-label={`Cantidad de la fila ${i + 1}`} aria-invalid={e.cantidad ? true : undefined} className={unir(CONTROL, 'text-right tabular-nums')} value={f.cantidad} readOnly={soloLectura} onChange={(ev) => cambiar(f.clave, { cantidad: ev.target.value })} />
                </Celda>
                <Celda etiqueta="Unidad">
                  <select aria-label={`Unidad de la fila ${i + 1}`} className={CONTROL} value={f.unidad} disabled={soloLectura} onChange={(ev) => cambiar(f.clave, { unidad: ev.target.value, unidadElegida: true })}>
                    {opciones.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Celda>
                <Celda etiqueta={incluyeIgv ? 'P. unitario (con IGV)' : 'P. unitario'} error={e.precio}>
                  <input inputMode="decimal" aria-label={`Precio unitario de la fila ${i + 1}`} aria-describedby={soloLectura || precioLeido(f) === null ? undefined : `precio-leido-${f.clave}`} aria-invalid={e.precio ? true : undefined} className={unir(CONTROL, 'text-right tabular-nums')} value={textoPrecio} readOnly={soloLectura} onChange={(ev) => cambiar(f.clave, { precio: ev.target.value, manda: 'precio' })} />
                  {soloLectura ? null : <PrecioLeido id={`precio-leido-${f.clave}`} fila={f} />}
                </Celda>
                <Celda etiqueta={incluyeIgv ? 'Importe (con IGV)' : 'Importe'} error={e.importe}>
                  <input
                    data-campo="importe"
                    inputMode="decimal"
                    aria-label={`Importe de la fila ${i + 1}`}
                    aria-invalid={e.importe ? true : undefined}
                    className={unir(CONTROL, 'text-right tabular-nums')}
                    value={textoImporte}
                    readOnly={soloLectura}
                    onChange={(ev) => cambiar(f.clave, { importe: ev.target.value, manda: 'importe' })}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' && !soloLectura) { ev.preventDefault(); enter(f.clave); } }}
                  />
                </Celda>
              </div>
              {soloLectura ? <span /> : (
                <div className="flex justify-end md:justify-center">
                  <Boton variante="fantasma" icono="cerrar" aria-label={`Quitar la fila ${i + 1}`} disabled={filas.length <= 1} onClick={() => alCambiar(quitarFila(filas, f.clave))} />
                </div>
              )}
              {!c.exacto && !soloLectura ? <p className="text-sm text-texto-suave md:col-span-6">El precio unitario solo guarda tres decimales: se conserva el importe que escribiste.</p> : null}
            </div>
          );
        })}
      </div>
      {errorGeneral ? <p role="alert" className="text-sm font-medium text-peligro">{errorGeneral}</p> : null}
      {soloLectura ? null : <div><Boton icono="mas" disabled={filas.length >= MAXIMO_DE_LINEAS_DE_COTIZACION} onClick={() => alCambiar([...filas, filaVacia(nuevaClave())])}>Agregar fila</Boton></div>}
    </section>
  );
}
