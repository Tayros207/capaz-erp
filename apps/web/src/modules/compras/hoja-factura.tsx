import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { MONEDAS_DE_FACTURA } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarProveedores } from './api.ts';
import { ordenesDeProveedor, registrarFactura } from './api-operaciones.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { argumentosDeFactura, validarFactura, type ErroresDeFactura, type FormularioDeFactura } from './logica-operaciones.ts';
import { mensajeDeRechazo } from './logica.ts';
import { refrescarCompras } from './acciones.ts';

async function buscar(texto: string) {
  return datosOError(await buscarProveedores(texto)).items.map((c) => ({ id: c.id, nombre: c.nombre, ...(c.documentoNumero && { detalle: c.documentoNumero }) }));
}

const hoyLocal = () => new Date().toLocaleDateString('en-CA');

function Formulario({ alCerrar }: { alCerrar: () => void }) {
  const [form, setForm] = useState<FormularioDeFactura>({ proveedor: null, ordenId: '', serie: '', numero: '', fecha: hoyLocal(), venceEl: '', moneda: 'PEN', subtotal: null, igv: null, notas: '' });
  const [errores, setErrores] = useState<ErroresDeFactura>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeFactura>) => setForm((f) => ({ ...f, ...c }));
  const ordenes = useQuery({
    queryKey: [...CLAVE_COMPRAS, 'ordenes-de-proveedor', form.proveedor?.id],
    queryFn: async () => datosOError(await ordenesDeProveedor(form.proveedor!.id)).items.filter((o) => o.estado !== 'cancelada' && o.estado !== 'borrador'),
    enabled: !!form.proveedor,
  });

  async function guardar() {
    const e = validarFactura(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = await registrarFactura(argumentosDeFactura(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      const c = r.datos.conciliacion.estado;
      notificar(c === 'difiere' ? `Factura ${r.datos.comprobante} registrada: difiere de la orden, revisa la diferencia.` : `Factura ${r.datos.comprobante} registrada.`, c === 'difiere' ? 'aviso' : 'exito');
      await refrescarCompras();
      alCerrar();
    } else if ('error' in r) setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <SelectorDeRegistro etiqueta="Proveedor" valor={form.proveedor} alCambiar={(proveedor) => cambiar({ proveedor, ordenId: '' })} buscar={buscar} error={errores.proveedor} textoSinResultados="Ningún contacto se parece a eso" />
      <CampoSelect etiqueta="Orden de compra (opcional)" value={form.ordenId} disabled={!form.proveedor} ayuda="Con la orden elegida se compara el monto con lo pedido y lo recibido." onChange={(e) => cambiar({ ordenId: e.target.value })}>
        <option value="">Sin orden</option>
        {(ordenes.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.estado.replace('_', ' ')}</option>)}
      </CampoSelect>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Serie" value={form.serie} error={errores.serie} maxLength={20} onChange={(e) => cambiar({ serie: e.target.value })} />
        <Campo etiqueta="Número" value={form.numero} error={errores.numero} maxLength={30} onChange={(e) => cambiar({ numero: e.target.value })} />
        <Campo etiqueta="Fecha" type="date" value={form.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
        <Campo etiqueta="Vence (opcional)" type="date" value={form.venceEl} error={errores.venceEl} onChange={(e) => cambiar({ venceEl: e.target.value })} />
        <CampoSelect etiqueta="Moneda" value={form.moneda} onChange={(e) => cambiar({ moneda: e.target.value as FormularioDeFactura['moneda'] })}>
          {MONEDAS_DE_FACTURA.map((m) => <option key={m} value={m}>{m}</option>)}
        </CampoSelect>
        <span />
        <CampoMonto etiqueta="Base sin IGV" valor={form.subtotal} error={errores.subtotal} alCambiar={(subtotal) => cambiar({ subtotal })} />
        <CampoMonto etiqueta="IGV" valor={form.igv} alCambiar={(igv) => cambiar({ igv })} />
      </div>
      <Campo etiqueta="Notas (opcional)" value={form.notas} maxLength={500} onChange={(e) => cambiar({ notas: e.target.value })} />
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Registrar factura</Boton>
      </div>
    </form>
  );
}

/** Hoja «Registrar factura del proveedor»: el formulario se monta al abrir, así empieza limpio cada vez. */
export function HojaDeFactura({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  return <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Registrar factura del proveedor">{abierto ? <Formulario alCerrar={alCerrar} /> : null}</HojaInferior>;
}
