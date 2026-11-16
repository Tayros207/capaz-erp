import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { PedidoCompletoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { BarraDeEstado } from '../../shared/ui/datos/barra-de-estado.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { sePuedeCobrarAdelanto, type MedioDePago } from './adelanto.ts';
import { ejecutarAdelanto } from './flujo-adelanto.ts';
import { HojaAdelanto } from './hoja-adelanto.tsx';
import { anotar, aplicarPaso, cancelar, refrescarPedidos, usePermisosDePedidos } from './acciones.ts';
import { verPedido } from './api.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { FormularioPedido } from './formulario-pedido.tsx';
import { HojaTexto } from './hoja-texto.tsx';
import { LineasDePedido } from './lineas-de-pedido.tsx';
import { PASOS_DE_PEDIDO, formatearDia, formularioDesde, otrosPasos, pasoActual, sePuedeCancelar, siguientePaso, textoDeEvento, totalesDe, type Paso } from './logica.ts';
import { Cargando, InsigniasDePedido } from './marco.tsx';
import { useBorrador } from './use-borrador.ts';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

function Lectura({ p }: { p: PedidoCompletoDto }) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Cliente" valor={p.clienteNombre} />
        <Dato etiqueta="Fecha del pedido" valor={formatearDia(p.fecha)} />
        <Dato etiqueta="Fecha de entrega" valor={formatearDia(p.entregaEl)} />
        <Dato etiqueta="Notas" valor={p.notas ?? ''} />
        {p.entregadoEn ? <Dato etiqueta="Entregado" valor={formatearFechaHora(p.entregadoEn)} /> : null}
        {p.canceladoEn ? <Dato etiqueta="Cancelado" valor={`${formatearFechaHora(p.canceladoEn)} · ${p.motivoCancelacion ?? ''}`} /> : null}
      </dl>
      <LineasDePedido lineas={formularioDesde(p).lineas} igvPorcentaje={p.igvPorcentaje} />
    </div>
  );
}

function Historial({ p }: { p: PedidoCompletoDto }) {
  return (
    <section aria-label="Historial del pedido" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Historial</h2>
      <ol className="flex flex-col gap-2">
        {p.historial.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5">
            <span className="break-words text-texto">{textoDeEvento(e)}</span>
            <span className="text-sm text-texto-suave">{formatearFechaHora(e.creadoEn)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Contenido({ pedido }: { pedido: PedidoCompletoDto }) {
  const permisos = usePermisosDePedidos();
  const yo = useYo();
  const editable = pedido.estado === 'borrador' && permisos.editar;
  const borrador = useBorrador(pedido, editable);
  const [ocupado, setOcupado] = useState(false);
  const [hoja, setHoja] = useState<'nota' | 'cancelar' | 'adelanto' | null>(null);
  const principal = permisos.editar ? siguientePaso(pedido.estado) : null;

  async function conOcupado(fn: () => Promise<void>) {
    setOcupado(true);
    await fn();
    setOcupado(false);
  }
  const guardarCambios = () =>
    conOcupado(async () => {
      if (!(await borrador.guardar())) return;
      notificar('Borrador guardado.', 'exito');
      await refrescarPedidos();
    });
  // Confirmar un borrador guarda antes lo que esté sin guardar: se confirma lo que se ve.
  const darPaso = (paso: Paso) =>
    conOcupado(async () => {
      if (paso.tipo === 'confirmar' && !(await borrador.guardar())) return;
      if (!(await aplicarPaso(pedido.id, paso))) await refrescarPedidos();
    });

  const totalActual = totalesDe(borrador.form.lineas, pedido.igvPorcentaje)?.totalCentimos ?? null;
  const ofreceAdelanto = pedido.estado === 'borrador' && sePuedeCobrarAdelanto({ puedeEscribirEnRegistro: !!yo && puedeEscribirEn(yo, 'registro'), clienteId: pedido.clienteId, totalCentimos: totalActual });
  // Con la casilla de adelanto, «Confirmar» abre la hoja; sin ella, el flujo de siempre.
  const pulsarPrincipal = (paso: Paso) => (ofreceAdelanto && paso.tipo === 'confirmar' ? setHoja('adelanto') : void darPaso(paso));
  const aceptarAdelanto = async (adelanto: { montoCentimos: number; medio: MedioDePago } | null) => {
    if (!(await borrador.guardar())) return null;
    if (!adelanto) {
      await aplicarPaso(pedido.id, { tipo: 'confirmar', texto: 'Confirmar pedido' });
      return null;
    }
    return ejecutarAdelanto(pedido.id, adelanto.montoCentimos, adelanto.medio);
  };

  const acciones: AccionDeMenu[] = [
    ...(permisos.editar ? otrosPasos(pedido.estado).map((paso) => ({ etiqueta: paso.texto, onSeleccionar: () => pulsarPrincipal(paso) })) : []),
    ...(permisos.editar ? [{ etiqueta: 'Agregar nota', onSeleccionar: () => setHoja('nota') }] : []),
    ...(permisos.cancelar && sePuedeCancelar(pedido.estado) ? [{ etiqueta: 'Cancelar pedido', peligro: true, onSeleccionar: () => setHoja('cancelar') }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={pedido.numero === null ? `Pedido de ${pedido.clienteNombre}` : pedido.codigo}
        migas={[{ texto: 'Pedidos', a: '/m/ordenes' }, { texto: pedido.codigo }]}
        accionPrincipal={principal ? <Boton variante="primario" cargando={ocupado} onClick={() => pulsarPrincipal(principal)}>{principal.texto}</Boton> : undefined}
        accionesSecundarias={
          <>
            <InsigniasDePedido pedido={pedido} />
            {editable ? <Boton cargando={ocupado} disabled={!borrador.hayCambios} onClick={() => void guardarCambios()}>Guardar cambios</Boton> : null}
            {acciones.length > 0 ? <MenuDeAcciones etiqueta="Más acciones del pedido" acciones={acciones} /> : null}
          </>
        }
      />
      {pedido.estado === 'cancelado' ? null : <BarraDeEstado pasos={PASOS_DE_PEDIDO} actual={pasoActual(pedido.estado)} etiqueta="Estado del pedido" />}
      {borrador.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{borrador.aviso}</p> : null}
      {editable ? (
        <FormularioPedido valor={borrador.form} errores={borrador.errores} igvPorcentaje={pedido.igvPorcentaje} fecha={pedido.fecha} alCambiar={borrador.cambiar} />
      ) : (
        <Lectura p={pedido} />
      )}
      <Historial p={pedido} />
      {ofreceAdelanto && totalActual !== null ? (
        <HojaAdelanto abierto={hoja === 'adelanto'} totalCentimos={totalActual} alAceptar={aceptarAdelanto} alCerrar={() => { setHoja(null); void refrescarPedidos(); }} />
      ) : null}
      <HojaTexto abierto={hoja === 'nota'} titulo="Agregar nota" etiqueta="Nota" textoEnviar="Agregar nota" maximo={1000} alEnviar={(t) => anotar(pedido.id, t)} alCerrar={() => setHoja(null)} />
      <HojaTexto abierto={hoja === 'cancelar'} titulo="Cancelar pedido" etiqueta="Motivo de la cancelación" textoEnviar="Continuar" maximo={300} peligroso alEnviar={(t) => cancelar(pedido.id, t)} alCerrar={() => setHoja(null)} />
    </div>
  );
}

export function PantallaFichaPedido() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'ficha', id], queryFn: async () => datosOError(await verPedido(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando pedido" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos este pedido" descripcion={consulta.error.message} icono="caja" />;
  // `key` reinicia el formulario cuando el servidor devuelve una versión nueva del pedido.
  return <Contenido key={`${consulta.data.id}-${consulta.data.actualizadoEn}-${consulta.data.historial.length}`} pedido={consulta.data} />;
}
