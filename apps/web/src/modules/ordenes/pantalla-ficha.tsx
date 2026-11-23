import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ESTADOS_DE_DATOS_EDITABLES_DE_PEDIDO, ESTADOS_DE_PEDIDO_PARA_GUIA, type PedidoCompletoDto, type VentaCorregidaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
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
import { anotar, aplicarPaso, cancelar, corregirDatos, refrescarPedidos, refrescarTrasCorregir, usePermisosDePedidos } from './acciones.ts';
import { verPedido } from './api.ts';
import { accionesDeImpresion, enviarPorWhatsApp } from './acciones-documentos.ts';
import { TITULO_DE_DOCUMENTO, documentosDisponibles, mensajeDeWhatsAppDeVersion } from './documentos.ts';
import { verSaldoDelPedido } from './deuda-del-pedido.ts';
import { HojaCorregir } from './hoja-corregir.tsx';
import { textoDeDelta, tonoDeDelta } from './huella-de-correccion.ts';
import { AvisoDeVersion, PagosDelPedido, VersionesAnteriores } from './versiones-del-pedido.tsx';
import { rutaDeGuiaNueva } from './armado-de-guia.ts';
import { GuiasDelPedido } from './guias-del-pedido.tsx';
import { CLAVE_PEDIDOS } from './claves.ts';
import { lineasDeHuella } from './datos-de-pedido.ts';
import { HojaEditarDatos } from './hoja-editar-datos.tsx';
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

function TituloDeEvento({ e }: { e: PedidoCompletoDto['historial'][number] }) {
  const c = e.detalle?.correccion;
  if (c) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="break-words font-medium text-texto">{textoDeEvento(e)}</span>
        <Insignia tono={tonoDeDelta(c.deltaCentimos)}>{textoDeDelta(c.deltaCentimos)}</Insignia>
      </span>
    );
  }
  if (e.guia) return <Link to={`/m/ordenes/guias/${e.guia.id}`} className="break-words text-texto underline">{textoDeEvento(e)}</Link>;
  return <span className="break-words text-texto">{textoDeEvento(e)}</span>;
}

function Historial({ p }: { p: PedidoCompletoDto }) {
  return (
    <section id="historial" tabIndex={-1} aria-label="Historial del pedido" className="flex flex-col gap-2 outline-none">
      <h2 className="font-titulo font-semibold text-texto">Historial</h2>
      {p.version > 1 ? <Link to={`/m/ordenes/correcciones?pedido=${p.id}`} className="w-fit text-sm font-medium text-accion underline">Ver las correcciones de este pedido</Link> : null}
      <ol className="flex flex-col gap-2">
        {p.historial.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5">
            <TituloDeEvento e={e} />
            {lineasDeHuella(e.detalle).map((l) => (
              <span key={l} className="break-words text-sm text-texto">{l}</span>
            ))}
            <span className="text-sm text-texto-suave">{[formatearFechaHora(e.creadoEn), e.usuarioNombre].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

type PropsDeContenido = { pedido: PedidoCompletoDto; corregido: VentaCorregidaDto | null; alCorregir: (r: VentaCorregidaDto | null) => void };

function Contenido({ pedido, corregido, alCorregir }: PropsDeContenido) {
  const permisos = usePermisosDePedidos();
  const yo = useYo();
  const editable = pedido.estado === 'borrador' && permisos.editar;
  const borrador = useBorrador(pedido, editable);
  const [ocupado, setOcupado] = useState(false);
  const [hoja, setHoja] = useState<'nota' | 'cancelar' | 'adelanto' | 'datos' | 'corregir' | null>(null);
  const navegar = useNavigate();
  const puedeCorregir = permisos.editar && (ESTADOS_DE_DATOS_EDITABLES_DE_PEDIDO as readonly string[]).includes(pedido.estado);
  const principal = permisos.editar ? siguientePaso(pedido.estado) : null;
  // Entregado: solo precio e IGV, y solo dueño o administrador (el servidor lo vuelve a comprobar).
  const esDuenio = yo?.empresa?.rol === 'owner' || yo?.empresa?.rol === 'admin';
  const puedeCorregirPedido = permisos.editar && (puedeCorregir || (pedido.estado === 'entregado' && esDuenio));
  const saldo = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'saldo', pedido.id], queryFn: () => verSaldoDelPedido(pedido.id, pedido.clienteId), enabled: pedido.estado !== 'borrador' && pedido.estado !== 'cancelado', retry: false });
  const pagos = saldo.data ?? null;

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

  const avisarPorWhatsApp = () => {
    // Lo recién guardado manda sobre lo que la consulta de pagos aún no refrescó.
    const d = corregido?.deuda;
    const dePagos = d ? { abonadoCentimos: d.abonadoCentimos, saldoCentimos: d.saldoCentimos, aFavorCentimos: corregido.aFavorCentimos } : pagos;
    return enviarPorWhatsApp(pedido, mensajeDeWhatsAppDeVersion(pedido, dePagos ? { abonadoCentimos: dePagos.abonadoCentimos, saldoCentimos: dePagos.saldoCentimos, aFavorCentimos: dePagos.aFavorCentimos } : null));
  };
  const verHistorial = () => { const h = document.getElementById('historial'); h?.scrollIntoView({ behavior: 'smooth', block: 'start' }); h?.focus({ preventScroll: true }); };

  // El documento que se le da al cliente: la proforma mientras es borrador y la nota de pedido (constancia) desde que se confirma.
  const documentoPrincipal = documentosDisponibles(pedido.estado).find((t) => t === (pedido.estado === 'borrador' ? 'proforma' : 'nota')) ?? null;

  const acciones: AccionDeMenu[] = [
    ...accionesDeImpresion(pedido, (ruta) => void navegar(ruta)),
    ...(pedido.estado === 'cancelado' ? [] : [{ etiqueta: 'Enviar por WhatsApp', onSeleccionar: () => void enviarPorWhatsApp(pedido) }]),
    ...(permisos.editar ? otrosPasos(pedido.estado).map((paso) => ({ etiqueta: paso.texto, onSeleccionar: () => pulsarPrincipal(paso) })) : []),
    ...(puedeCorregirPedido ? [{ etiqueta: 'Corregir pedido', onSeleccionar: () => setHoja('corregir') }] : []),
    ...(puedeCorregir ? [{ etiqueta: 'Editar datos', onSeleccionar: () => setHoja('datos') }] : []),
    ...(permisos.editar ? [{ etiqueta: 'Agregar nota', onSeleccionar: () => setHoja('nota') }] : []),
    ...(permisos.cancelar && sePuedeCancelar(pedido.estado) ? [{ etiqueta: 'Cancelar pedido', peligro: true, onSeleccionar: () => setHoja('cancelar') }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={pedido.numero === null ? `Pedido de ${pedido.clienteNombre}` : `${pedido.codigo}${pedido.version > 1 ? ` · v${pedido.version}` : ''}`}
        migas={[{ texto: 'Pedidos', a: '/m/ordenes' }, { texto: pedido.codigo }]}
        accionPrincipal={principal ? <Boton variante="primario" cargando={ocupado} onClick={() => pulsarPrincipal(principal)}>{principal.texto}</Boton> : undefined}
        accionesSecundarias={
          <>
            <InsigniasDePedido pedido={pedido} />
            {editable ? <Boton cargando={ocupado} disabled={!borrador.hayCambios} onClick={() => void guardarCambios()}>Guardar cambios</Boton> : null}
            {puedeCorregirPedido ? <Boton onClick={() => setHoja('corregir')}>Corregir pedido</Boton> : null}
            {puedeCorregir ? <Boton onClick={() => setHoja('datos')}>Editar datos</Boton> : null}
            {documentoPrincipal ? <Boton onClick={() => void navegar(`/m/ordenes/${pedido.id}/${documentoPrincipal}`)}>{`Imprimir ${TITULO_DE_DOCUMENTO[documentoPrincipal].toLowerCase()}`}</Boton> : null}
            {permisos.editar && (ESTADOS_DE_PEDIDO_PARA_GUIA as readonly string[]).includes(pedido.estado) ? <Boton onClick={() => void navegar(rutaDeGuiaNueva({ pedidoIds: [pedido.id] }))}>Guía de remisión</Boton> : null}
            {pedido.estado === 'cancelado' ? null : <Boton onClick={() => void enviarPorWhatsApp(pedido)}>Enviar por WhatsApp</Boton>}
            {acciones.length > 0 ? <MenuDeAcciones etiqueta="Más acciones del pedido" acciones={acciones} /> : null}
          </>
        }
      />
      {corregido ? <AvisoDeVersion resultado={corregido} alWhatsApp={() => void avisarPorWhatsApp()} alImprimirNota={() => void navegar(`/m/ordenes/${pedido.id}/nota`)} alImprimirOrden={corregido.correccion.estadoAlCorregir === 'en_proceso' || corregido.correccion.estadoAlCorregir === 'listo' ? () => void navegar(`/m/ordenes/${pedido.id}/orden-de-trabajo`) : null} alHistorial={verHistorial} alCerrar={() => alCorregir(null)} /> : null}
      {pedido.estado === 'cancelado' ? null : <BarraDeEstado pasos={PASOS_DE_PEDIDO} actual={pasoActual(pedido.estado)} etiqueta="Estado del pedido" />}
      {borrador.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{borrador.aviso}</p> : null}
      {editable ? (
        <FormularioPedido valor={borrador.form} errores={borrador.errores} fecha={pedido.fecha} alCambiar={borrador.cambiar} />
      ) : (
        <Lectura p={pedido} />
      )}
      <PagosDelPedido saldo={pagos} />
      <GuiasDelPedido pedidoId={pedido.id} />
      <VersionesAnteriores pedido={pedido} />
      <Historial p={pedido} />
      {ofreceAdelanto && totalActual !== null ? (
        <HojaAdelanto abierto={hoja === 'adelanto'} totalCentimos={totalActual} alAceptar={aceptarAdelanto} alCerrar={() => { setHoja(null); void refrescarPedidos(); }} />
      ) : null}
      {puedeCorregirPedido ? <HojaCorregir abierto={hoja === 'corregir'} pedido={pedido} alGuardar={(r) => { setHoja(null); alCorregir(r); void refrescarTrasCorregir(r); }} alCerrar={() => setHoja(null)} /> : null}
      {puedeCorregir ? <HojaEditarDatos abierto={hoja === 'datos'} pedido={pedido} alEnviar={(c) => corregirDatos(pedido.id, c)} alCerrar={() => setHoja(null)} /> : null}
      <HojaTexto abierto={hoja === 'nota'} titulo="Agregar nota" etiqueta="Nota" textoEnviar="Agregar nota" maximo={1000} alEnviar={(t) => anotar(pedido.id, t)} alCerrar={() => setHoja(null)} />
      <HojaTexto abierto={hoja === 'cancelar'} titulo="Cancelar pedido" etiqueta="Motivo de la cancelación" textoEnviar="Continuar" maximo={300} peligroso alEnviar={(t) => cancelar(pedido.id, t)} alCerrar={() => setHoja(null)} />
    </div>
  );
}

export function PantallaFichaPedido() {
  const { id = '' } = useParams();
  const [corregido, setCorregido] = useState<VentaCorregidaDto | null>(null);
  const consulta = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'ficha', id], queryFn: async () => datosOError(await verPedido(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando pedido" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos este pedido" descripcion={consulta.error.message} icono="caja" />;
  // `key` reinicia el formulario cuando el servidor devuelve una versión nueva del pedido; el aviso de «ahora es versión N» vive aquí para sobrevivir a ese reinicio.
  return <Contenido corregido={corregido} alCorregir={setCorregido} key={`${consulta.data.id}-${consulta.data.actualizadoEn}-${consulta.data.historial.length}`} pedido={consulta.data} />;
}
