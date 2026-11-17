import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { centimosSchema, type CotizacionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { resolverAccion } from './acciones.ts';
import { enviarPorWhatsApp, usePermisosDeCotizaciones } from './acciones-cotizacion.ts';
import { aceptarCotizacion, anularCotizacion, duplicarCotizacion, emitirCotizacion, marcarEnviada, nuevaVersion, rechazarCotizacion, verCotizacion } from './api-cotizaciones.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { formatearDia } from './documento-cotizacion.ts';
import { HojaAceptar } from './hoja-aceptar.tsx';
import { HojaDeCotizacion } from './hoja-cotizacion.tsx';
import { HojaMotivo } from './hoja-motivo.tsx';
import { InsigniaDeCotizacion } from './insignia-cotizacion.tsx';
import { mensajeDeRechazo, soles } from './logica.ts';
import {
  accionesVisibles, argumentosDeAceptar, argumentosDeAnulacion, argumentosDeEmision, argumentosDeRechazo, formularioDesdeCotizacion,
  pideMotivoDeMargen, rutaDeDocumento, rutaDeFicha, sePuedeImprimir, textoDeAceptadas, textoDeEvento, textoDeMargen,
} from './logica-cotizaciones.ts';
import { Cargando, SeccionesDelCotizador } from './marco.tsx';
import { notificar } from '../../shared/ui/notificar.ts';

type Linea = CotizacionCompletaDto['lineas'][number];
const COLUMNAS: Array<Columna<Linea>> = [
  { id: 'descripcion', titulo: 'Descripción', principal: true, celda: (l) => `${l.posicion + 1}. ${l.descripcion}` },
  { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (l) => formatearCantidad(l.cantidadMilesimas, l.unidad) },
  { id: 'precio', titulo: 'Cada una (sin IGV)', alinear: 'derecha', celda: (l) => `S/ ${milesimasATexto(l.precioUnitarioMilesimas)}` },
  { id: 'importe', titulo: 'Importe', alinear: 'derecha', celda: (l) => soles(l.importeCentimos) },
  { id: 'total', titulo: 'Total con IGV', alinear: 'derecha', celda: (l) => soles(l.totalCentimos) },
];

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

type Hoja = 'editar' | 'aceptar' | 'rechazar' | 'anular' | 'margen' | null;

function Contenido({ c }: { c: CotizacionCompletaDto }) {
  const navegar = useNavigate();
  const permisos = usePermisosDeCotizaciones();
  const [hoja, setHoja] = useState<Hoja>(null);
  const [ocupado, setOcupado] = useState(false);
  const visibles = new Set(accionesVisibles(c.estado, permisos));
  const margen = textoDeMargen(c.margenPct);

  async function conOcupado(fn: () => Promise<unknown>) {
    setOcupado(true);
    await fn();
    setOcupado(false);
  }
  const emitir = (motivo?: string) =>
    conOcupado(async () => {
      const r = await emitirCotizacion(argumentosDeEmision(c.id, motivo));
      if ('error' in r && !motivo && pideMotivoDeMargen(r.error.codigo, r.error.mensaje)) {
        setHoja('margen');
        return;
      }
      await resolverAccion(Promise.resolve(r), 'Cotización emitida.');
    });
  const emitirConMotivo = async (motivo: string) => {
    const r = await emitirCotizacion(argumentosDeEmision(c.id, motivo));
    if ('error' in r) { notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error'); return false; }
    return resolverAccion(Promise.resolve(r), 'Cotización emitida.');
  };
  const simple = (llamada: () => ReturnType<typeof marcarEnviada>, ok: string, irA?: (id: string) => string) =>
    conOcupado(async () => {
      const r = await llamada();
      const hecho = await resolverAccion(r, ok);
      if (hecho && irA && r.ok && 'datos' in r) void navegar(irA(r.datos.id));
    });

  const acciones: AccionDeMenu[] = [
    ...(sePuedeImprimir(c.estado) ? [{ etiqueta: 'Imprimir cotización', onSeleccionar: () => void navegar(rutaDeDocumento(c.id)) }, { etiqueta: 'Enviar por WhatsApp', onSeleccionar: () => void enviarPorWhatsApp(c) }] : []),
    ...(visibles.has('enviar') ? [{ etiqueta: 'Marcar como enviada', onSeleccionar: () => void simple(() => marcarEnviada(c.id), 'Marcada como enviada.') }] : []),
    ...(visibles.has('rechazar') ? [{ etiqueta: 'Rechazar', onSeleccionar: () => setHoja('rechazar') }] : []),
    ...(visibles.has('nueva_version') ? [{ etiqueta: 'Nueva versión', onSeleccionar: () => void simple(() => nuevaVersion(c.id), 'Nueva versión creada como borrador.') }] : []),
    ...(visibles.has('duplicar') ? [{ etiqueta: 'Duplicar', onSeleccionar: () => void simple(() => duplicarCotizacion(c.id), 'Cotización duplicada como borrador.', rutaDeFicha) }] : []),
    ...(visibles.has('anular') ? [{ etiqueta: 'Anular', peligro: true, onSeleccionar: () => setHoja('anular') }] : []),
  ];
  const principal = visibles.has('emitir') ? (
    <Boton variante="primario" cargando={ocupado} onClick={() => void emitir()}>Emitir</Boton>
  ) : visibles.has('aceptar') ? (
    <Boton variante="primario" onClick={() => setHoja('aceptar')}>Aceptar</Boton>
  ) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={c.titulo}
        migas={[{ texto: 'Cotizaciones', a: '/m/cotizador/cotizaciones' }, { texto: c.codigo }]}
        accionPrincipal={principal}
        accionesSecundarias={
          <>
            <InsigniaDeCotizacion estado={c.estado} />
            {visibles.has('editar') ? <Boton onClick={() => setHoja('editar')}>Editar</Boton> : null}
            {acciones.length > 0 ? <MenuDeAcciones etiqueta="Más acciones de la cotización" acciones={acciones} /> : null}
          </>
        }
      />
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Cliente" valor={c.clienteNombre ?? 'Sin cliente todavía'} />
        <Dato etiqueta="Código" valor={`${c.codigo} · versión ${c.version}${c.versionActual !== c.version ? ` (vigente: ${c.versionActual})` : ''}`} />
        <Dato etiqueta="Válida hasta" valor={formatearDia(c.validaHasta)} />
        <Dato etiqueta="Líneas" valor={c.conOpciones ? 'Opciones para elegir (no se suman)' : 'Un solo trabajo (se suman)'} />
        {c.aceptadaEn ? <Dato etiqueta="Aceptada" valor={`${formatearFechaHora(c.aceptadaEn)} · ${textoDeAceptadas(c.lineasAceptadas, c.lineas.length)} · ${c.totalAceptadoCentimos === null ? '' : soles(c.totalAceptadoCentimos)}`} /> : null}
        {c.motivoRechazo ? <Dato etiqueta="Motivo del rechazo" valor={c.motivoRechazo} /> : null}
        {c.anuladoEn ? <Dato etiqueta="Anulada" valor={`${formatearFechaHora(c.anuladoEn)} · ${c.motivoAnulacion ?? ''}`} /> : null}
        {c.notas ? <Dato etiqueta="Notas" valor={c.notas} /> : null}
      </dl>
      <section aria-label="Líneas de la cotización" className="flex flex-col gap-2">
        <h2 className="font-titulo font-semibold text-texto">Líneas</h2>
        <Lista etiqueta="Líneas de la cotización" columnas={COLUMNAS} filas={c.lineas} clave={(l) => String(l.posicion)} vacio={<EstadoVacio titulo="Sin líneas todavía" descripcion="Edita el borrador para agregarlas." icono="caja" />} />
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
      <section aria-label="Historial de la cotización" className="flex flex-col gap-2">
        <h2 className="font-titulo font-semibold text-texto">Historial</h2>
        <ol className="flex flex-col gap-2">
          {c.historial.map((e, i) => (
            <li key={`${e.creadoEn}-${i}`} className="flex flex-col gap-0.5">
              <span className="break-words text-texto">{textoDeEvento(e)}</span>
              <span className="text-sm text-texto-suave">{formatearFechaHora(e.creadoEn)}</span>
            </li>
          ))}
        </ol>
      </section>
      {hoja === 'editar' || visibles.has('editar') ? (
        <HojaDeCotizacion abierto={hoja === 'editar'} id={c.id} inicial={formularioDesdeCotizacion(c, (n) => centimosSchema.parse(n))} puedeVerCostos={permisos.costos} alCerrar={() => setHoja(null)} alGuardar={() => setHoja(null)} />
      ) : null}
      <HojaAceptar abierto={hoja === 'aceptar'} cotizacion={c} alCerrar={() => setHoja(null)} alAceptar={(e) => resolverAccion(aceptarCotizacion(argumentosDeAceptar(c.id, c.conOpciones, e)), 'Cotización aceptada.')} />
      <HojaMotivo abierto={hoja === 'rechazar'} titulo="Rechazar cotización" etiqueta="Motivo (opcional)" textoEnviar="Rechazar" obligatorio={false} alCerrar={() => setHoja(null)} alEnviar={(t) => resolverAccion(rechazarCotizacion(argumentosDeRechazo(c.id, t)), 'Cotización rechazada.')} />
      <HojaMotivo abierto={hoja === 'anular'} titulo="Anular cotización" etiqueta="Motivo de la anulación" textoEnviar="Continuar" obligatorio peligroso alCerrar={() => setHoja(null)} alEnviar={(t) => resolverAccion(anularCotizacion(argumentosDeAnulacion(c.id, t)), 'Cotización anulada.')} />
      <HojaMotivo abierto={hoja === 'margen'} titulo="Margen por debajo del mínimo" etiqueta="¿Por qué se emite así?" ayuda="El margen está por debajo del mínimo de tus Ajustes. Anota el motivo para poder emitirla." textoEnviar="Continuar" obligatorio alCerrar={() => setHoja(null)} alEnviar={emitirConMotivo} />
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

