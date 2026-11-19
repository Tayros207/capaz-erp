import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { datosOError } from '../../../shared/api/consultas.ts';
import { notificar } from '../../../shared/ui/notificar.ts';
import { SelectorDeRegistro, type Opcion } from '../../../shared/ui/selector-de-registro.tsx';
import { editarCotizacion, verCotizacion } from '../api-cotizaciones.ts';
import { buscarClientes } from '../api.ts';
import { clientesIniciales } from '../clientes-iniciales.ts';
import { mensajeDeRechazo } from '../logica.ts';
import { mostrarDecimal } from '../logica-taller.ts';
import { fijarTrabajo } from './api-cuadro.ts';
import { CampoAlSalir } from './campo-al-salir.tsx';
import { cambioDeTrabajo, type CampoDeTrabajo, type MedidasPendientes } from './logica-cuadro-filas.ts';
import { Seccion } from './seccion.tsx';
import { claveDelCuadro, type ContextoDelCuadro } from './use-cuadro.ts';

/** Datos del trabajo: producto, cantidad, pieza, tintas y caras. Cada campo se guarda al salir de él. */
export function PanelTrabajo({ id, vista, aplicar, editable }: ContextoDelCuadro) {
  const t = vista.trabajo;
  // La pieza se guarda con las dos medidas juntas: la que se teclea primero espera aquí a la otra.
  const [pendientes, setPendientes] = useState<MedidasPendientes>({});
  const consultas = useQueryClient();
  // El cliente es de la cotización: se lee de ella (el cuadro solo guarda el nombre que tenía al empezar).
  const clienteDeLaCotizacion = useQuery({ queryKey: [...claveDelCuadro(id), 'cliente'], queryFn: async () => datosOError(await verCotizacion(id)), retry: false });
  const clienteActual = clienteDeLaCotizacion.data?.clienteNombre ?? t.cliente;
  // Quien se está cambiando de cliente: mientras no elija otro, el campo queda abierto para buscar.
  const [cambiandoCliente, setCambiandoCliente] = useState(false);

  async function buscarCliente(texto: string): Promise<Opcion[]> {
    const { items } = datosOError(await buscarClientes(texto));
    return items.map((c) => ({ id: c.id, nombre: c.nombre }));
  }
  /** El cliente es de la cotización (no del cuadro): se anota con la herramienta de cotizaciones y se recarga el cuadro. */
  async function ponerCliente(o: Opcion) {
    const r = await editarCotizacion({ id, clienteId: o.id });
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: claveDelCuadro(id) }); // incluye la consulta del cliente
      setCambiandoCliente(false);
      notificar('Cliente anotado.', 'exito');
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }
  const campo = (c: CampoDeTrabajo, etiqueta: string, valor: string, extra: { decimal?: boolean; maxLength?: number; ayuda?: string } = {}) => (
    <CampoAlSalir
      etiqueta={etiqueta}
      valor={valor}
      deshabilitado={!editable}
      {...extra}
      alConfirmar={async (texto) => {
        const cambio = cambioDeTrabajo(vista, id, c, texto, pendientes);
        if (cambio === null) return null;
        if ('error' in cambio) return cambio.error;
        if ('pendiente' in cambio) {
          setPendientes((p) => ({ ...p, [cambio.pendiente.campo]: cambio.pendiente.valor }));
          return null;
        }
        const guardado = await aplicar(fijarTrabajo(cambio.args));
        if (guardado) setPendientes({});
        return guardado ? null : 'No se guardó.';
      }}
    />
  );
  return (
    <Seccion titulo="Datos del trabajo">
      {campo('producto', 'Producto', t.producto, { maxLength: 120 })}
      {campo('descripcion', 'Descripción', t.descripcion ?? '', { maxLength: 600 })}
      {campo('cantidad', 'Cantidad', mostrarDecimal(t.cantidad), { decimal: true, ayuda: 'La cantidad a cotizar (100, 1.000 o 5.000 marcan la columna base).' })}
      <div className="grid grid-cols-2 gap-3">
        {campo('anchoCm', 'Ancho de la pieza (cm)', t.pieza ? mostrarDecimal(t.pieza.anchoCm) : (pendientes.anchoCm ?? ''), { decimal: true })}
        {campo('altoCm', 'Alto de la pieza (cm)', t.pieza ? mostrarDecimal(t.pieza.altoCm) : (pendientes.altoCm ?? ''), { decimal: true })}
        {campo('tintas', 'Tintas', String(t.tintas), { decimal: true })}
        {campo('caras', 'Caras', String(t.caras), { decimal: true })}
      </div>
      {!t.pieza && (pendientes.anchoCm || pendientes.altoCm) ? (
        <p role="status" className="text-sm text-aviso">Falta {pendientes.anchoCm ? 'el alto' : 'el ancho'} de la pieza: se guarda al escribirlo.</p>
      ) : null}
      {editable ? (
        <SelectorDeRegistro
          etiqueta="Cliente"
          valor={clienteActual && !cambiandoCliente ? { id: 'actual', nombre: clienteActual } : null}
          alCambiar={(o) => { if (o === null) setCambiandoCliente(true); else if (o.id !== 'actual') void ponerCliente(o); }}
          buscar={buscarCliente}
          buscarSinTexto={clientesIniciales}
          textoSinResultados="Ningún cliente se parece a eso"
          ayuda={clienteActual ? undefined : 'Hace falta para emitir la cotización.'}
        />
      ) : clienteActual ? <p className="text-sm text-texto-suave">Cliente: {clienteActual}</p> : null}
    </Seccion>
  );
}
