import { useState } from 'react';
import { centimosSchema, formatearSoles, type OrdenDeProduccionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { refrescarProduccion } from './acciones.ts';
import { buscarClientes, crearOrden, editarOrden } from './api.ts';
import {
  argumentosDeCrear,
  argumentosDeEditar,
  atajosDeEntrega,
  faltaCancelar,
  formularioDesde,
  hoyLocal,
  lineaVacia,
  mensajeDeRechazo,
  subtotalDeLinea,
  totalDeFormulario,
  validarOrden,
  type ErroresDeOrden,
  type FormularioDeOrden,
  type LineaDeFormulario,
} from './logica.ts';

async function buscar(texto: string) {
  return datosOError(await buscarClientes(texto)).items.map((c) => ({ id: c.id, nombre: c.nombre, ...(c.documentoNumero && { detalle: c.documentoNumero }) }));
}

function FichaDeTrabajo({ n, l, puedeQuitar, alCambiar, alQuitar }: { n: number; l: LineaDeFormulario; puedeQuitar: boolean; alCambiar: (c: Partial<LineaDeFormulario>) => void; alQuitar: () => void }) {
  const subtotal = subtotalDeLinea(l);
  return (
    <div className="flex flex-col gap-3 rounded-control border border-borde p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-texto">Trabajo {n}</h3>
        {puedeQuitar ? <Boton variante="fantasma" onClick={alQuitar}>Quitar</Boton> : null}
      </div>
      <Campo etiqueta="Trabajo a realizar" maxLength={200} placeholder="Ej: 01 troquel forma" value={l.descripcion} onChange={(e) => alCambiar({ descripcion: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoCantidad etiqueta="Cantidad" valor={l.cantidad} alCambiar={(cantidad) => alCambiar({ cantidad })} />
        <CampoPrecio etiqueta="Valor unitario" valor={l.precio} alCambiar={(precio) => alCambiar({ precio })} ayuda={subtotal > 0 ? `Valor de este trabajo: ${formatearSoles(subtotal)}` : undefined} />
      </div>
      <details className="rounded-control border border-borde px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-texto">Detalles de máquina (opcional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Material" maxLength={120} placeholder="couché 150g" value={l.material} onChange={(e) => alCambiar({ material: e.target.value })} />
          <Campo etiqueta="Medida" maxLength={120} placeholder="A5" value={l.medida} onChange={(e) => alCambiar({ medida: e.target.value })} />
          <Campo etiqueta="Colores" maxLength={120} placeholder="full color" value={l.colores} onChange={(e) => alCambiar({ colores: e.target.value })} />
          <Campo etiqueta="Acabado" maxLength={120} placeholder="plastificado" value={l.acabado} onChange={(e) => alCambiar({ acabado: e.target.value })} />
        </div>
      </details>
    </div>
  );
}

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  /** Con orden: «Corregir la orden». Sin ella: «Nueva orden de trabajo». */
  orden?: OrdenDeProduccionCompletaDto;
  alCrear?: (id: string) => void;
};

function Formulario({ orden, alCerrar, alCrear }: Omit<Props, 'abierto'>) {
  const hoy = hoyLocal();
  const [form, setForm] = useState<FormularioDeOrden>(() => (orden ? formularioDesde(orden, (n) => centimosSchema.parse(n)) : { cliente: null, lineas: [lineaVacia(1)], adelanto: null, entregaEl: '', notas: '' }));
  const [errores, setErrores] = useState<ErroresDeOrden>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [siguiente, setSiguiente] = useState(form.lineas.length + 1);
  const cambiar = (c: Partial<FormularioDeOrden>) => setForm((f) => ({ ...f, ...c }));
  const cambiarLinea = (clave: number, c: Partial<LineaDeFormulario>) => cambiar({ lineas: form.lineas.map((l) => (l.clave === clave ? { ...l, ...c } : l)) });
  const total = totalDeFormulario(form);
  const falta = faltaCancelar(form);

  async function guardar() {
    const e = validarOrden(form, orden ? '0000-00-00' : hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = orden ? await editarOrden(argumentosDeEditar(orden.id, form)) : await crearOrden(argumentosDeCrear(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar(orden ? `Corregimos ${r.datos.codigo}: ahora es de ${formatearSoles(r.datos.totalCentimos)}.` : `Creamos ${r.datos.codigo} por ${formatearSoles(r.datos.totalCentimos)}. Ya está en la cola.`, 'exito');
      await refrescarProduccion();
      alCerrar();
      if (!orden) alCrear?.(r.datos.id);
    } else if ('error' in r) setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <SelectorDeRegistro etiqueta="Cliente" valor={form.cliente} alCambiar={(cliente) => cambiar({ cliente })} buscar={buscar} error={errores.cliente} textoSinResultados="Ningún cliente se parece a eso" />
      {form.lineas.map((l, i) => (
        <FichaDeTrabajo key={l.clave} n={i + 1} l={l} puedeQuitar={form.lineas.length > 1} alCambiar={(c) => cambiarLinea(l.clave, c)} alQuitar={() => cambiar({ lineas: form.lineas.filter((x) => x.clave !== l.clave) })} />
      ))}
      {errores.lineas ? <p role="alert" className="text-sm font-medium text-peligro">{errores.lineas}</p> : null}
      <div><Boton onClick={() => { cambiar({ lineas: [...form.lineas, lineaVacia(siguiente)] }); setSiguiente((n) => n + 1); }}>Agregar otro trabajo</Boton></div>
      <div className="flex flex-col gap-3 rounded-control border border-borde bg-superficie-alta p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-texto-suave">Valor del trabajo</span>
          <span className="text-xl font-semibold tabular-nums text-texto">{formatearSoles(total)}</span>
        </div>
        <CampoMonto etiqueta="A cuenta (adelanto)" valor={form.adelanto} alCambiar={(adelanto) => cambiar({ adelanto })} error={errores.adelanto} ayuda="Lo que el cliente dejó hoy. Puede ser todo el valor." />
        <div className="flex items-baseline justify-between gap-2" aria-live="polite">
          <span className="text-sm text-texto-suave">Falta cancelar</span>
          <span className={`text-lg font-semibold tabular-nums ${falta > 0 ? 'text-aviso' : 'text-exito'}`}>{formatearSoles(falta)}</span>
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-texto">¿Para cuándo lo necesita? (opcional)</legend>
        <div className="flex flex-wrap gap-2">
          {atajosDeEntrega(hoy).map((a) => (
            <Boton key={a.texto} variante={form.entregaEl === a.dia ? 'primario' : 'secundario'} aria-pressed={form.entregaEl === a.dia} onClick={() => cambiar({ entregaEl: a.dia })}>{a.texto}</Boton>
          ))}
        </div>
        <Campo etiqueta="Fecha de entrega" type="date" min={orden ? undefined : hoy} value={form.entregaEl} error={errores.entregaEl} onChange={(e) => cambiar({ entregaEl: e.target.value })} />
      </fieldset>
      <CampoTextarea etiqueta="Nota para el taller (opcional)" filas={3} maxLength={1000} placeholder="Ej: el cliente pasa a recoger el sábado temprano" value={form.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
      {fallo ? <p role="alert" className="rounded-control border border-peligro p-2 text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{orden ? 'Guardar la corrección' : 'Crear la orden'}</Boton>
      </div>
    </form>
  );
}

/** Hoja «Nueva orden de trabajo» o «Corregir la orden»: el formulario se monta al abrir, así empieza limpio cada vez. */
export function HojaDeOrden({ abierto, alCerrar, orden, alCrear }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={orden ? `Corregir ${orden.codigo}` : 'Nueva orden de trabajo'}>
      {abierto ? <Formulario orden={orden} alCerrar={alCerrar} alCrear={alCrear} /> : null}
    </HojaInferior>
  );
}
