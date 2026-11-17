import { useState } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarProductos } from './api.ts';
import { crearSolicitud } from './api-operaciones.ts';
import { argumentosDeSolicitud, lineaDeSolicitudVacia, validarSolicitud, type ErroresDeSolicitud, type FormularioDeSolicitud } from './logica-operaciones.ts';
import { mensajeDeRechazo } from './logica.ts';
import { refrescarCompras } from './acciones.ts';

async function buscar(texto: string) {
  return datosOError(await buscarProductos(texto)).items.map((p) => ({ id: p.id, nombre: p.nombre, ...(p.codigo && { detalle: p.codigo }) }));
}

const hoyLocal = () => new Date().toLocaleDateString('en-CA');

function Formulario({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (id: string) => void }) {
  const [form, setForm] = useState<FormularioDeSolicitud>({ area: '', necesariaEl: '', motivo: '', lineas: [lineaDeSolicitudVacia(1)] });
  const [errores, setErrores] = useState<ErroresDeSolicitud>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [siguiente, setSiguiente] = useState(2);
  const cambiar = (c: Partial<FormularioDeSolicitud>) => setForm((f) => ({ ...f, ...c }));
  const cambiarLinea = (clave: number, c: Partial<FormularioDeSolicitud['lineas'][number]>) => cambiar({ lineas: form.lineas.map((l) => (l.clave === clave ? { ...l, ...c } : l)) });

  async function guardar() {
    const e = validarSolicitud(form, hoyLocal());
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = await crearSolicitud(argumentosDeSolicitud(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar('Solicitud creada en borrador. Envíala para que la aprueben.', 'exito');
      await refrescarCompras();
      alCrear(r.datos.id);
    } else if ('error' in r) setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Área que lo pide (opcional)" value={form.area} maxLength={100} onChange={(e) => cambiar({ area: e.target.value })} />
        <Campo etiqueta="Necesaria para (opcional)" type="date" min={hoyLocal()} value={form.necesariaEl} error={errores.necesariaEl} onChange={(e) => cambiar({ necesariaEl: e.target.value })} />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-texto">Qué se necesita</legend>
        {form.lineas.map((l, i) => (
          <div key={l.clave} className="grid gap-2 rounded-control border border-borde p-3 sm:grid-cols-2">
            <SelectorDeRegistro etiqueta={`Producto ${i + 1} (opcional)`} valor={l.producto} alCambiar={(producto) => cambiarLinea(l.clave, { producto })} buscar={buscar} textoSinResultados="Ningún producto se parece a eso" />
            <Campo etiqueta="Descripción" value={l.descripcion} maxLength={300} ayuda={l.producto ? 'Si la dejas vacía se usa el nombre del producto.' : 'Obligatoria si no eliges un producto.'} onChange={(e) => cambiarLinea(l.clave, { descripcion: e.target.value })} />
            <CampoCantidad etiqueta="Cantidad" valor={l.cantidad} alCambiar={(cantidad) => cambiarLinea(l.clave, { cantidad })} />
            <div className="flex items-end justify-end">
              <Boton variante="fantasma" icono="cerrar" aria-label={`Quitar la línea ${i + 1}`} disabled={form.lineas.length === 1} onClick={() => cambiar({ lineas: form.lineas.filter((x) => x.clave !== l.clave) })} />
            </div>
          </div>
        ))}
        {errores.lineas ? <p role="alert" className="text-sm font-medium text-peligro">{errores.lineas}</p> : null}
        <div><Boton onClick={() => { cambiar({ lineas: [...form.lineas, lineaDeSolicitudVacia(siguiente)] }); setSiguiente((n) => n + 1); }}>Agregar línea</Boton></div>
      </fieldset>
      <Campo etiqueta="Motivo (opcional)" value={form.motivo} maxLength={500} onChange={(e) => cambiar({ motivo: e.target.value })} />
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Crear solicitud</Boton>
      </div>
    </form>
  );
}

/** Hoja «Nueva solicitud de compra»: el formulario se monta al abrir, así empieza limpio cada vez. */
export function HojaDeSolicitud({ abierto, alCerrar, alCrear }: { abierto: boolean; alCerrar: () => void; alCrear: (id: string) => void }) {
  return <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Nueva solicitud de compra">{abierto ? <Formulario alCerrar={alCerrar} alCrear={alCrear} /> : null}</HojaInferior>;
}
