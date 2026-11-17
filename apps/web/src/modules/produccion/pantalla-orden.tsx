import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatearSoles, type LineaDeOrdenDto, type OrdenDeProduccionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { resolverAccion, usePermisosDeProduccion } from './acciones.ts';
import { anularOrden, cambiarEstado, cobrarOrden, verOrden } from './api.ts';
import { CLAVE_PRODUCCION } from './claves.ts';
import { HojaDeAnular } from './hoja-anular.tsx';
import { HojaDeOrden } from './hoja-orden.tsx';
import { accionesDeOrden, avanceDe, ETIQUETA_DE_ESTADO, ETIQUETA_DE_PAGO, hoyLocal, textoDeEntrega, TONO_DE_ESTADO } from './logica.ts';
import { Cargando } from './marco.tsx';

const detalleDeMaquina = (l: LineaDeOrdenDto) => [l.material, l.medida, l.colores, l.acabado].filter(Boolean).join(' · ');

const LINEAS: Array<Columna<LineaDeOrdenDto>> = [
  { id: 'trabajo', titulo: 'Trabajo', principal: true, celda: (l) => <span className="flex flex-col"><span className="font-medium text-texto">{l.descripcion}</span>{detalleDeMaquina(l) ? <span className="text-sm text-texto-suave">{detalleDeMaquina(l)}</span> : null}</span> },
  { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (l) => `${formatearCantidad(l.cantidadMilesimas)} ${l.unidad}` },
  { id: 'valor', titulo: 'Valor unitario', alinear: 'derecha', celda: (l) => <span className="tabular-nums">S/ {(l.precioUnitarioMilesimas / 1000).toFixed(3).replace(/0$/, '')}</span> },
  { id: 'subtotal', titulo: 'Subtotal', alinear: 'derecha', celda: (l) => <span className="tabular-nums">{formatearSoles(l.subtotalCentimos)}</span> },
];

function Contenido({ o }: { o: OrdenDeProduccionCompletaDto }) {
  const { editar, anular } = usePermisosDeProduccion();
  const [hoy] = useState(hoyLocal);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const acciones = accionesDeOrden(o);
  const avance = avanceDe(o.estado);

  async function avanzar() {
    if (!avance) return;
    if (avance.confirma && !(await confirmar('Marcar como entregada', '¿El cliente ya se llevó este trabajo? Después de entregarlo ya no vas a poder corregirlo.', { textoConfirmar: 'Sí, ya se lo llevó' }))) return;
    await resolverAccion(cambiarEstado({ id: o.id, estado: avance.a }), avance.a === 'entregado' ? 'Orden entregada. Finanzas propone cobrar lo que falta.' : `La orden pasó a «${ETIQUETA_DE_ESTADO[avance.a].toLowerCase()}».`);
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={`Orden ${o.codigo}`}
        migas={[{ texto: 'Órdenes de trabajo', a: '/m/produccion' }, { texto: o.codigo }]}
        accionPrincipal={avance && editar ? <Boton variante="primario" onClick={() => void avanzar()}>{avance.texto}</Boton> : undefined}
        accionesSecundarias={
          <>
            <Insignia tono={TONO_DE_ESTADO[o.estado]}>{ETIQUETA_DE_ESTADO[o.estado]}</Insignia>
            {editar && acciones.cobrar ? <Boton onClick={() => void resolverAccion(cobrarOrden(o.id), 'Pedimos a Finanzas cobrar lo que falta: confírmalo en la bandeja.')}>Anotar que ya me pagó</Boton> : null}
            {editar && acciones.editar ? <Boton onClick={() => setCorrigiendo(true)}>Corregir</Boton> : null}
            {anular && acciones.anular ? <Boton variante="peligro" onClick={() => setAnulando(true)}>Anular</Boton> : null}
          </>
        }
      />
      <GrupoDeCifras etiqueta="Cuenta de la orden">
        <Cifra etiqueta="Valor del trabajo" valor={formatearSoles(o.totalCentimos)} />
        <Cifra etiqueta="A cuenta" valor={formatearSoles(o.adelantoCentimos)} tono={o.adelantoCentimos > 0 ? 'exito' : 'neutro'} ayuda={ETIQUETA_DE_PAGO[o.estadoDePago]} />
        <Cifra etiqueta="Falta cancelar" valor={formatearSoles(o.saldoCentimos)} tono={o.saldoCentimos > 0 && o.estado !== 'anulada' ? 'aviso' : 'exito'} />
      </GrupoDeCifras>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5"><dt className="text-sm text-texto-suave">Cliente</dt><dd className="font-medium text-texto"><Link className="underline-offset-2 hover:underline" to={`/clientes/${o.clienteId}`}>{o.clienteNombre}</Link></dd></div>
        <div className="flex flex-col gap-0.5"><dt className="text-sm text-texto-suave">Entrega</dt><dd className={`font-medium ${o.atrasada ? 'text-peligro' : 'text-texto'}`}>{textoDeEntrega(o, hoy)}</dd></div>
        {o.notas ? <div className="flex flex-col gap-0.5 sm:col-span-2"><dt className="text-sm text-texto-suave">Nota para el taller</dt><dd className="text-texto">{o.notas}</dd></div> : null}
        {o.motivoAnulacion ? <div className="flex flex-col gap-0.5 sm:col-span-2"><dt className="text-sm text-texto-suave">Motivo de la anulación</dt><dd className="text-texto">{o.motivoAnulacion}{o.destinoAdelanto ? ` · adelanto ${o.destinoAdelanto === 'devuelto' ? 'devuelto' : 'retenido'}` : ''}</dd></div> : null}
      </dl>
      <Lista etiqueta="Trabajos de la orden" columnas={LINEAS} filas={o.lineas} clave={(l) => String(l.posicion)} vacio={<EstadoVacio titulo="Sin trabajos" icono="caja" />} />
      <section aria-label="Historial de la orden" className="flex flex-col gap-2">
        <h2 className="font-titulo font-semibold text-texto">Historial</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {o.historial.map((h, i) => (
            <li key={i} className="flex flex-wrap gap-x-2 text-texto-suave">
              <span className="tabular-nums">{formatearFechaHora(h.creadoEn)}</span>
              <span className="text-texto">{h.tipo === 'creada' ? 'Orden creada' : h.tipo === 'editada' ? 'Orden corregida' : h.tipo === 'cobro' ? 'Se pidió cobrar el saldo' : h.tipo === 'anulada' ? 'Orden anulada' : `Pasó a ${ETIQUETA_DE_ESTADO[h.estadoNuevo].toLowerCase()}`}</span>
              {h.tipo !== 'editada' && h.tipo !== 'cobro' && h.nota ? <span>· {h.nota}</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <HojaDeOrden abierto={corrigiendo} orden={o} alCerrar={() => setCorrigiendo(false)} />
      <HojaDeAnular
        abierto={anulando}
        codigo={o.codigo}
        adelantoCentimos={o.adelantoCentimos}
        alCerrar={() => setAnulando(false)}
        alEnviar={(motivo, destino) => resolverAccion(anularOrden({ id: o.id, motivo, ...(destino && { destinoAdelanto: destino }) }), `Orden ${o.codigo} anulada.`)}
      />
    </div>
  );
}

/** Ficha de una orden de trabajo: lo que se cobra, lo que falta, sus trabajos, su historial y su botón de avance. */
export function PantallaOrden() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_PRODUCCION, 'orden', id], queryFn: async () => datosOError(await verOrden(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando la orden" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta orden" descripcion={consulta.error.message} icono="caja" />;
  return <Contenido o={consulta.data} />;
}
