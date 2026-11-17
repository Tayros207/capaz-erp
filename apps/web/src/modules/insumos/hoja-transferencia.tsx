import { useState } from 'react';
import { refrescarInventario, useSucursales } from './use-inventario.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarArticulos } from './api.ts';
import { crearTransferencia } from './api-operaciones.ts';
import { argumentosDeTransferencia, lineaVacia, validarTransferencia, type ErroresDeTransferencia, type FormularioDeTransferencia } from './logica-operaciones.ts';
import { mensajeDeRechazo } from './logica.ts';

function Formulario({ alCerrar }: { alCerrar: () => void }) {
  const sucursales = useSucursales();
  const [form, setForm] = useState<FormularioDeTransferencia>({ origenId: '', destinoId: '', nota: '', lineas: [lineaVacia(1)] });
  const [errores, setErrores] = useState<ErroresDeTransferencia>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [siguiente, setSiguiente] = useState(2);
  const lista = sucursales.data ?? [];
  const origenId = form.origenId || lista[0]?.id || '';
  const cambiar = (c: Partial<FormularioDeTransferencia>) => setForm((f) => ({ ...f, ...c }));
  const cambiarLinea = (clave: number, c: Partial<FormularioDeTransferencia['lineas'][number]>) => cambiar({ lineas: form.lineas.map((l) => (l.clave === clave ? { ...l, ...c } : l)) });

  async function guardar() {
    const completo = { ...form, origenId };
    const e = validarTransferencia(completo);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = await crearTransferencia(argumentosDeTransferencia(completo));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar(`Transferencia ${r.datos.numero}-${r.datos.anio} hecha: ${r.datos.origenCodigo} → ${r.datos.destinoCodigo}.`, 'exito');
      await refrescarInventario();
      alCerrar();
    } else if ('error' in r) setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelect etiqueta="Sale de" value={origenId} error={errores.origenId} onChange={(e) => cambiar({ origenId: e.target.value })}>
          {lista.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.codigo}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta="Llega a" value={form.destinoId} error={errores.destinoId} onChange={(e) => cambiar({ destinoId: e.target.value })}>
          <option value="">Elige la sucursal</option>
          {lista.filter((s) => s.id !== origenId).map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.codigo}</option>)}
        </CampoSelect>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-texto">Qué se envía</legend>
        {form.lineas.map((l, i) => (
          <div key={l.clave} className="grid gap-2 rounded-control border border-borde p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
            <SelectorDeRegistro etiqueta={`Artículo ${i + 1}`} valor={l.articulo} alCambiar={(articulo) => cambiarLinea(l.clave, { articulo })} buscar={buscarArticulos} textoSinResultados="Ningún artículo controlado se parece a eso" />
            <CampoCantidad etiqueta="Cantidad" valor={l.cantidad} alCambiar={(cantidad) => cambiarLinea(l.clave, { cantidad })} />
            <Boton variante="fantasma" icono="cerrar" aria-label={`Quitar el artículo ${i + 1}`} disabled={form.lineas.length === 1} onClick={() => cambiar({ lineas: form.lineas.filter((x) => x.clave !== l.clave) })} />
          </div>
        ))}
        {errores.lineas ? <p role="alert" className="text-sm font-medium text-peligro">{errores.lineas}</p> : null}
        <div><Boton onClick={() => { cambiar({ lineas: [...form.lineas, lineaVacia(siguiente)] }); setSiguiente((n) => n + 1); }}>Agregar artículo</Boton></div>
      </fieldset>
      <Campo etiqueta="Nota (opcional)" maxLength={500} value={form.nota} onChange={(e) => cambiar({ nota: e.target.value })} />
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Transferir</Boton>
      </div>
    </form>
  );
}

/** Hoja «Nueva transferencia»: el formulario se monta al abrir, así cada vez empieza limpio. */
export function HojaDeTransferencia({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  return <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Nueva transferencia">{abierto ? <Formulario alCerrar={alCerrar} /> : null}</HojaInferior>;
}
