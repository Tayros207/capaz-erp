import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { datosOError } from '../../../shared/api/consultas.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoMonto } from '../../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { confirmar } from '../../../shared/ui/confirmar.ts';
import { HojaInferior } from '../../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../../shared/ui/selector-de-registro.tsx';
import { refrescarCotizador } from '../acciones.ts';
import { buscarProductosParaCotizar } from '../api.ts';
import { mensajeDeRechazo, pideConfirmarUnitario } from '../logica.ts';
import { generarReferencias, guardarReferencias } from './api-cuadro.ts';
import { ETIQUETA_DE_COLUMNA, ETIQUETA_DE_SEMAFORO, textoDeImporte, textoDePorcentaje } from './logica-cuadro.ts';
import { REFERENCIAS_VACIAS, argumentosDeReferencias, type FormularioDeReferencias } from './logica-cuadro-precio.ts';
import type { ContextoDelCuadro } from './use-cuadro.ts';

type Props = { ctx: ContextoDelCuadro; abierta: boolean; alCerrar: () => void };

async function buscarProductos(texto: string) {
  const { items } = datosOError(await buscarProductosParaCotizar(texto));
  return items.flatMap((p) => (p.productoId ? [{ id: p.productoId, nombre: p.nombre }] : []));
}

type Margenes = Array<{ cantidad: string; margenPct: string | null; semaforo: 'verde' | 'ambar' | 'rojo' | null }> | undefined;

/** Los tres precios de referencia con su margen (si hay permiso de costos). */
function TresPrecios({ precios, margenes }: { precios: number[]; margenes: Margenes }) {
  return (
    <ul aria-label="Precios de referencia, sin IGV" className="grid grid-cols-3 gap-2">
      {(['100', '1000', '5000'] as const).map((c, i) => {
        const m = margenes?.find((x) => x.cantidad === c);
        const sem = m?.semaforo ? ETIQUETA_DE_SEMAFORO[m.semaforo] : null;
        return (
          <li key={c} className="flex flex-col gap-0.5 rounded-control border border-borde bg-superficie-alta p-2">
            <span className="text-sm text-texto-suave">{ETIQUETA_DE_COLUMNA[c]}</span>
            <span className="font-semibold tabular-nums text-texto">{textoDeImporte(precios[i] ?? null)}</span>
            {m ? <span className="text-xs text-texto-suave">Margen {textoDePorcentaje(m.margenPct)}{sem ? ` · ${sem.texto}` : ''}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Guarda en la lista (crítica: el servidor pide confirmar). Si el precio por unidad no baja, se pregunta y se reintenta. */
async function enviarReferencias(id: string, f: FormularioDeReferencias): Promise<boolean> {
  const r = await guardarReferencias(argumentosDeReferencias(id, f));
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar('Precios guardados en la lista.', 'exito');
    await refrescarCotizador();
    return true;
  }
  if (!('error' in r)) return false;
  if (!f.confirmarUnitarioNoBaja && pideConfirmarUnitario(r.error.codigo, r.error.mensaje) && (await confirmar('El precio por unidad no baja', r.error.mensaje, { textoConfirmar: 'Guardar igual' }))) {
    return enviarReferencias(id, { ...f, confirmarUnitarioNoBaja: true });
  }
  notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

function Contenido({ ctx, alCerrar }: Omit<Props, 'abierta'>) {
  const [f, setF] = useState<FormularioDeReferencias>(REFERENCIAS_VACIAS);
  const [ocupado, setOcupado] = useState(false);
  const q = useQuery({ queryKey: ['cotizador', 'cuadro-referencias', ctx.id, ctx.vista.precioFinalCentimos, ctx.vista.interno?.utilidad.pct], queryFn: async () => datosOError(await generarReferencias(ctx.id)), retry: false });

  async function guardar() {
    setOcupado(true);
    const hecho = await enviarReferencias(ctx.id, f);
    setOcupado(false);
    if (hecho) alCerrar();
  }

  if (q.isPending) return <p role="status" className="text-texto-suave">Calculando los tres precios…</p>;
  if (q.isError) return <p role="alert" className="text-sm font-medium text-peligro">{q.error.message}</p>;
  const { referencias, validacion, margenes } = q.data;
  const precios = [referencias.p100Centimos, referencias.p1000Centimos, referencias.p5000Centimos];
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <TresPrecios precios={precios} margenes={margenes} />
      {validacion.bloqueos.map((b) => <p key={b} role="alert" className="text-sm font-medium text-peligro">{b}</p>)}
      {validacion.avisos.map((a) => <p key={a} role="status" className="text-sm font-medium text-aviso">{a}</p>)}
      <Campo etiqueta="Nombre de la lista" maxLength={120} value={f.nombre} ayuda="Si lo dejas vacío se usa el producto del trabajo." onChange={(e) => setF((a) => ({ ...a, nombre: e.target.value }))} />
      <SelectorDeRegistro
        etiqueta="Producto del catálogo (opcional)" valor={f.productoId ? { id: f.productoId, nombre: 'Producto elegido' } : null} buscar={buscarProductos}
        textoSinResultados="Ningún producto se parece a eso" ayuda="Una lista por producto: si ya existe, se actualiza." alCambiar={(o) => setF((a) => ({ ...a, productoId: o?.id ?? null }))}
      />
      <CampoSelect etiqueta="Entre las tres cantidades" value={f.modo} onChange={(e) => setF((a) => ({ ...a, modo: e.target.value === 'escalon' ? 'escalon' : 'curva' }))}>
        <option value="curva">Curva (baja poco a poco)</option>
        <option value="escalon">Escalón (cambia por tramos)</option>
      </CampoSelect>
      <CampoMonto etiqueta="Precio mínimo (opcional)" valor={f.minimoCentimos} alCambiar={(v) => setF((a) => ({ ...a, minimoCentimos: v }))} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado} disabled={validacion.bloqueos.length > 0}>Guardar en la lista de precios</Boton>
      </div>
    </form>
  );
}

/** «Precios 100 / 1.000 / 5.000»: muestra los tres precios que calcula el servidor y los guarda en la lista de precios. */
export function HojaDeReferencias({ abierta, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierta} alCerrar={resto.alCerrar} titulo="Precios 100 / 1.000 / 5.000">
      {abierta ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
