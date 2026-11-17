import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { centimosSchema, type CotizacionCompletaDto } from '@capaz/shared';
import { ChipDeCliente, EnlaceDeEntidad } from '../../shared/ui/entidades.tsx';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { ResumenDelCuadro } from './cuadro/resumen-del-cuadro.tsx';
import { refrescarCotizador, resolverAccion } from './acciones.ts';
import { enviarPorWhatsApp, usePermisosDeCotizaciones } from './acciones-cotizacion.ts';
import { aceptarCotizacion, anularCotizacion, duplicarCotizacion, listarPedidosDelCliente, marcarEnviada, nuevaVersion, rechazarCotizacion, verCotizacion } from './api-cotizaciones.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { formatearDia } from './documento-cotizacion.ts';
import { AvisoDePrecios } from './aviso-de-precios.tsx';
import { CajaEmitida } from './caja-emitida.tsx';
import { COLUMNAS_DE_LINEAS } from './ficha-lineas.tsx';
import { HistorialDeCotizacion } from './ficha-historial.tsx';
import { HojaPreciosDeHoy } from './hoja-precios-de-hoy.tsx';
import { HojaAceptar } from './hoja-aceptar.tsx';
import { HojaDeCotizacion } from './hoja-cotizacion.tsx';
import { HojaEnlace } from './hoja-enlace.tsx';
import { HojaMotivo } from './hoja-motivo.tsx';
import { InsigniaDeCotizacion } from './insignia-cotizacion.tsx';
import { soles } from './logica.ts';
import {
  accionesVisibles, argumentosDeAceptar, argumentosDeAnulacion, argumentosDeRechazo, formularioDesdeCotizacion,
  rutaDeDocumento, rutaDeFicha, sePuedeImprimir, textoDeAceptadas, textoDeMargen,
} from './logica-cotizaciones.ts';
import { Cargando, SeccionesDelCotizador } from './marco.tsx';
import { useEmision } from './use-emision.ts';
import { notificar } from '../../shared/ui/notificar.ts';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

/** «Ver pedido»: el pedido nacido de esta cotización, o dónde está si aún espera aprobación. Sin permiso de Pedidos no se muestra. */
function DatoDePedido({ c }: { c: CotizacionCompletaDto }) {
  const clienteId = c.clienteId;
  const consulta = useQuery({
    queryKey: [...CLAVE_COTIZADOR, 'pedido-de', c.id],
    queryFn: async () => datosOError(await listarPedidosDelCliente(clienteId ?? '')).items.find((p) => p.origenTipo === 'cotizacion' && p.origenId === c.id) ?? null,
    enabled: clienteId !== null,
    retry: false,
  });
  if (clienteId === null || consulta.isPending || consulta.isError) return null;
  const pedido = consulta.data;
  return (
    <Dato
      etiqueta="Pedido"
      valor={pedido ? <EnlaceDeEntidad tipo="pedido" id={pedido.id}>Ver pedido · {pedido.codigo}</EnlaceDeEntidad> : <Link to="/bandeja" className="font-medium text-accion underline-offset-2 hover:underline">Esperando tu aprobación en la bandeja</Link>}
    />
  );
}

type Hoja = 'editar' | 'aceptar' | 'rechazar' | 'anular' | 'margen' | 'enlace' | 'precios' | null;

/** Los avisos de precios que dejó volver a cotizar (nueva versión, duplicar): viajan en el estado de la navegación. */
const avisosDeNavegacion = (estado: unknown): string[] => {
  const a = (estado as { avisos?: unknown } | null)?.avisos;
  return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
};

function Contenido({ c }: { c: CotizacionCompletaDto }) {
  const navegar = useNavigate();
  const avisos = avisosDeNavegacion(useLocation().state);
  const permisos = usePermisosDeCotizaciones();
  const [hoja, setHoja] = useState<Hoja>(null);
  const [ocupado, setOcupado] = useState(false);
  // El enlace nuevo se muestra una sola vez dentro de la hoja: la ficha se refresca al cerrarla, no antes.
  const [enlaceCambio, setEnlaceCambio] = useState(false);
  const visibles = new Set(accionesVisibles(c.estado, permisos));
  const margen = textoDeMargen(c.margenPct);

  async function conOcupado(fn: () => Promise<unknown>) {
    setOcupado(true);
    await fn();
    setOcupado(false);
  }
  const emision = useEmision(c.id, setHoja);
  // «Reenviar» desde la lista llega con `?enlace=1`: se abre la hoja del enlace y se limpia el parámetro.
  const [parametros, setParametros] = useSearchParams();
  const pideEnlace = parametros.get('enlace') === '1';
  useEffect(() => {
    if (!pideEnlace) return;
    if (permisos.emitir && sePuedeImprimir(c.estado)) setHoja('enlace');
    setParametros((p) => { p.delete('enlace'); return p; }, { replace: true });
  }, [pideEnlace, permisos.emitir, c.estado, setParametros]);
  const emitir = () => conOcupado(emision.emitir);
  const simple = (llamada: () => ReturnType<typeof marcarEnviada> | ReturnType<typeof nuevaVersion>, ok: string, irA?: (id: string) => string) =>
    conOcupado(async () => {
      const r = await llamada();
      const hecho = await resolverAccion(r, ok);
      if (!hecho || !r.ok || !('datos' in r)) return;
      // Volver a cotizar (nueva versión, duplicar) trae los precios de hoy: lo que cambió se avisa y se deja en la ficha.
      const avisosDePrecios = 'avisos' in r.datos ? r.datos.avisos : [];
      for (const a of avisosDePrecios) notificar(a, 'aviso');
      if (irA || avisosDePrecios.length > 0) void navegar(irA ? irA(r.datos.id) : rutaDeFicha(r.datos.id), { state: { avisos: avisosDePrecios } });
    });

  const acciones: AccionDeMenu[] = [
    ...(sePuedeImprimir(c.estado) ? [{ etiqueta: 'Imprimir cotización', onSeleccionar: () => void navegar(rutaDeDocumento(c.id)) }, { etiqueta: 'Enviar por WhatsApp', onSeleccionar: () => void enviarPorWhatsApp(c) }] : []),
    ...(permisos.emitir && sePuedeImprimir(c.estado) ? [{ etiqueta: 'Enlace para el cliente', onSeleccionar: () => setHoja('enlace') }] : []),
    ...(visibles.has('enviar') ? [{ etiqueta: 'Marcar como enviada', onSeleccionar: () => void simple(() => marcarEnviada(c.id), 'Marcada como enviada.') }] : []),
    ...(visibles.has('rechazar') ? [{ etiqueta: 'Rechazar', onSeleccionar: () => setHoja('rechazar') }] : []),
    ...(visibles.has('nueva_version') ? [{ etiqueta: 'Nueva versión', onSeleccionar: () => void simple(() => nuevaVersion(c.id), 'Nueva versión creada como borrador.') }] : []),
    ...(visibles.has('duplicar') ? [{ etiqueta: 'Duplicar', onSeleccionar: () => void simple(() => duplicarCotizacion(c.id), 'Cotización duplicada como borrador.', rutaDeFicha) }] : []),
    ...(visibles.has('anular') ? [{ etiqueta: 'Anular', peligro: true, onSeleccionar: () => setHoja('anular') }] : []),
  ];
  /** Abre WhatsApp y, si se pudo, marca la cotización como enviada. */
  const enviarYMarcar = () =>
    conOcupado(async () => {
      if (await enviarPorWhatsApp(c)) await resolverAccion(marcarEnviada(c.id), 'Marcada como enviada.');
    });
  // La acción siguiente va en primer plano: emitir → enviar por WhatsApp → aceptar.
  const alAceptar = <Boton variante="primario" onClick={() => setHoja('aceptar')}>Aceptar</Boton>;
  const principal = visibles.has('emitir') ? (
    <Boton variante="primario" cargando={ocupado} onClick={() => void emitir()}>Emitir</Boton>
  ) : visibles.has('enviar') && c.clienteId ? (
    <Boton variante="primario" cargando={ocupado} onClick={() => void enviarYMarcar()}>Enviar por WhatsApp</Boton>
  ) : visibles.has('aceptar') ? alAceptar : undefined;
  const aceptarAparte = visibles.has('aceptar') && principal !== alAceptar && !visibles.has('emitir');

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={c.titulo}
        migas={[{ texto: 'Cotizaciones', a: '/m/cotizador/cotizaciones' }, { texto: c.codigo }]}
        accionPrincipal={principal}
        accionesSecundarias={
          <>
            <InsigniaDeCotizacion estado={c.estado} />
            {aceptarAparte ? <Boton onClick={() => setHoja('aceptar')}>Aceptar</Boton> : null}
            {visibles.has('editar') ? <Boton onClick={() => setHoja('editar')}>Editar</Boton> : null}
            {acciones.length > 0 ? <MenuDeAcciones etiqueta="Más acciones de la cotización" acciones={acciones} /> : null}
          </>
        }
      />
      <AvisoDePrecios avisos={avisos} />
      {c.estado === 'emitida' || c.estado === 'enviada' ? (
        <CajaEmitida codigo={c.codigo} puedeEnlace={permisos.emitir} puedeNuevaVersion={visibles.has('nueva_version')} alImprimir={() => void navegar(rutaDeDocumento(c.id))} alEnlace={() => setHoja('enlace')} alNuevaVersion={() => void simple(() => nuevaVersion(c.id), 'Nueva versión creada como borrador.')} />
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Cliente" valor={c.clienteId && c.clienteNombre ? <ChipDeCliente id={c.clienteId} nombre={c.clienteNombre} /> : 'Sin cliente todavía'} />
        {c.estado === 'aceptada' ? <DatoDePedido c={c} /> : null}
        <Dato etiqueta="Código" valor={`${c.codigo} · versión ${c.version}${c.versionActual !== c.version ? ` (vigente: ${c.versionActual})` : ''}`} />
        <Dato etiqueta="Válida hasta" valor={formatearDia(c.validaHasta)} />
        <Dato etiqueta="Líneas" valor={c.conOpciones ? 'Opciones para elegir (no se suman)' : 'Un solo trabajo (se suman)'} />
        {c.aceptadaEn ? <Dato etiqueta="Aceptada" valor={`${formatearFechaHora(c.aceptadaEn)} · ${textoDeAceptadas(c.lineasAceptadas, c.lineas.length)} · ${c.totalAceptadoCentimos === null ? '' : soles(c.totalAceptadoCentimos)}`} /> : null}
        {c.motivoRechazo ? <Dato etiqueta="Motivo del rechazo" valor={c.motivoRechazo} /> : null}
        {c.anuladoEn ? <Dato etiqueta="Anulada" valor={`${formatearFechaHora(c.anuladoEn)} · ${c.motivoAnulacion ?? ''}`} /> : null}
        {c.notas ? <Dato etiqueta="Notas" valor={c.notas} /> : null}
      </dl>
      <ResumenDelCuadro c={c} />
      <section aria-label="Líneas de la cotización" className="flex flex-col gap-2">
        <h2 className="font-titulo font-semibold text-texto">Líneas</h2>
        <Lista etiqueta="Líneas de la cotización" columnas={COLUMNAS_DE_LINEAS} filas={c.lineas} clave={(l) => String(l.posicion)} vacio={<EstadoVacio titulo="Sin líneas todavía" descripcion="Edita el borrador para agregarlas." icono="caja" />} />
        <GrupoDeCifras etiqueta="Totales de la cotización">
          <Cifra etiqueta="Subtotal" valor={soles(c.subtotalCentimos)} />
          <Cifra etiqueta={`IGV ${c.igvPorcentaje} %`} valor={soles(c.igvCentimos)} />
          <Cifra etiqueta="Total" valor={soles(c.totalCentimos)} ayuda={c.conOpciones ? 'Suma de las opciones: no es un total a cobrar.' : undefined} />
        </GrupoDeCifras>
      </section>
      {c.costoCentimos !== null || margen !== null ? (
        <GrupoDeCifras etiqueta="Costo y margen (solo para ti)">
          {c.costoCentimos !== null ? <Cifra etiqueta="Costo" valor={soles(c.costoCentimos)} /> : null}
          {margen !== null ? <Cifra etiqueta="Margen" valor={margen} ayuda={c.motivoMargenBajo ? `Margen bajo: ${c.motivoMargenBajo}` : undefined} /> : null}
        </GrupoDeCifras>
      ) : null}
      <section aria-label="Condiciones" className="flex flex-col gap-2">
        <h2 className="font-titulo font-semibold text-texto">Condiciones</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Validez" valor={c.condiciones.validezDias === null ? '' : `${c.condiciones.validezDias} días`} />
          <Dato etiqueta="Plazo de entrega" valor={c.condiciones.plazoEntrega} />
          <Dato etiqueta="Forma de pago" valor={c.condiciones.formaPago} />
          <Dato etiqueta="Tolerancia" valor={c.condiciones.tolerancia} />
          <Dato etiqueta="No incluye" valor={c.condiciones.noIncluye} />
        </dl>
      </section>
      <HistorialDeCotizacion historial={c.historial} />
      {hoja === 'editar' || visibles.has('editar') ? (
        <HojaDeCotizacion abierto={hoja === 'editar'} id={c.id} inicial={formularioDesdeCotizacion(c, (n) => centimosSchema.parse(n))} puedeVerCostos={permisos.costos} alCerrar={() => setHoja(null)} alGuardar={() => setHoja(null)} />
      ) : null}
      <HojaAceptar abierto={hoja === 'aceptar'} cotizacion={c} alCerrar={() => setHoja(null)} alAceptar={(e) => resolverAccion(aceptarCotizacion(argumentosDeAceptar(c.id, c.conOpciones, e)), 'Cotización aceptada.')} />
      <HojaMotivo abierto={hoja === 'rechazar'} titulo="Rechazar cotización" etiqueta="Motivo (opcional)" textoEnviar="Rechazar" obligatorio={false} alCerrar={() => setHoja(null)} alEnviar={(t) => resolverAccion(rechazarCotizacion(argumentosDeRechazo(c.id, t)), 'Cotización rechazada.')} />
      <HojaMotivo abierto={hoja === 'anular'} titulo="Anular cotización" etiqueta="Motivo de la anulación" textoEnviar="Continuar" obligatorio peligroso alCerrar={() => setHoja(null)} alEnviar={(t) => resolverAccion(anularCotizacion(argumentosDeAnulacion(c.id, t)), 'Cotización anulada.')} />
      <HojaEnlace abierto={hoja === 'enlace'} cotizacion={c} alCambiar={() => setEnlaceCambio(true)} alCerrar={() => { setHoja(null); if (enlaceCambio) { setEnlaceCambio(false); void refrescarCotizador(); } }} />
      <HojaMotivo abierto={hoja === 'margen'} titulo="Margen por debajo del mínimo" etiqueta="¿Por qué se emite así?" ayuda="El margen está por debajo del mínimo de tus Ajustes. Anota el motivo para poder emitirla." textoEnviar="Continuar" obligatorio alCerrar={() => setHoja(null)} alEnviar={emision.emitirConMotivo} />
      <HojaPreciosDeHoy abierto={hoja === 'precios'} avisos={emision.avisos} alAceptar={emision.aceptarPreciosDeHoy} alCerrar={() => setHoja(null)} />
    </div>
  );
}

export function PantallaFichaCotizacion() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'ficha', id], queryFn: async () => datosOError(await verCotizacion(id)) });
  if (consulta.isPending) return <><SeccionesDelCotizador /><Cargando etiqueta="Cargando cotización" /></>;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta cotización" descripcion={consulta.error.message} icono="caja" />;
  return <Contenido key={`${consulta.data.id}-${consulta.data.actualizadoEn}-${consulta.data.historial.length}`} c={consulta.data} />;
}

