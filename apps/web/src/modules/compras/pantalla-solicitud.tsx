import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Respuesta, SolicitudDeCompraDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { refrescarCompras, usePermisosDeCompras } from './acciones.ts';
import { anularSolicitud, enviarSolicitud, resolverSolicitud, verSolicitud } from './api-operaciones.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { HojaDeConversion } from './hoja-convertir.tsx';
import { HojaDeDecision } from './hoja-decision.tsx';
import { accionesDeSolicitud, ETIQUETA_DE_SOLICITUD, TONO_DE_SOLICITUD } from './logica-operaciones.ts';
import { mensajeDeRechazo } from './logica.ts';
import { Cargando, Dato } from './marco.tsx';

const LINEAS: Array<Columna<SolicitudDeCompraDto['lineas'][number]>> = [
  { id: 'n', titulo: '#', celda: (l) => String(l.posicion) },
  { id: 'descripcion', titulo: 'Descripción', principal: true, celda: (l) => l.descripcion },
  { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (l) => `${formatearCantidad(l.cantidadMilesimas)} ${l.unidad}` },
];

/** Aplica una llamada: si salió bien avisa y refresca; si no, muestra el mensaje del servidor. */
async function aplicar(llamada: Promise<Respuesta<unknown>>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarCompras();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

type Hoja = 'rechazar' | 'anular' | 'convertir' | null;

function Contenido({ s }: { s: SolicitudDeCompraDto }) {
  const navegar = useNavigate();
  const { editar, aprobar } = usePermisosDeCompras();
  const [hoja, setHoja] = useState<Hoja>(null);
  const a = accionesDeSolicitud(s.estado);
  const principal =
    a.enviar && editar ? <Boton variante="primario" onClick={() => void aplicar(enviarSolicitud(s.id), 'Solicitud enviada a aprobación.')}>Enviar a aprobación</Boton>
    : a.resolver && aprobar ? <Boton variante="primario" onClick={() => void aplicar(resolverSolicitud({ id: s.id, decision: 'aprobar' }), 'Solicitud aprobada.')}>Aprobar</Boton>
    : a.convertir && editar ? <Boton variante="primario" onClick={() => setHoja('convertir')}>Convertir en orden</Boton>
    : undefined;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={`Solicitud ${s.codigo ?? '(borrador)'}`}
        migas={[{ texto: 'Solicitudes de compra', a: '/m/compras/solicitudes' }, { texto: s.codigo ?? 'Borrador' }]}
        accionPrincipal={principal}
        accionesSecundarias={
          <>
            <Insignia tono={TONO_DE_SOLICITUD[s.estado]}>{ETIQUETA_DE_SOLICITUD[s.estado]}</Insignia>
            {a.resolver && aprobar ? <Boton onClick={() => setHoja('rechazar')}>Rechazar</Boton> : null}
            {a.anular && editar ? <Boton variante="peligro" onClick={() => setHoja('anular')}>Anular</Boton> : null}
          </>
        }
      />
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Área" valor={s.area ?? ''} />
        <Dato etiqueta="Necesaria para" valor={s.necesariaEl ?? ''} />
        <Dato etiqueta="Fecha" valor={s.fecha} />
        <Dato etiqueta="Motivo" valor={s.motivo ?? ''} />
        <Dato etiqueta="Resuelta" valor={s.resueltoEn ? formatearFechaHora(s.resueltoEn) : ''} />
        <Dato etiqueta="Motivo de la resolución" valor={s.motivoResolucion ?? ''} />
      </dl>
      {s.ordenId ? <div><Boton onClick={() => void navegar(`/m/compras/${s.ordenId}`)}>Ver la orden de compra</Boton></div> : null}
      <Lista etiqueta="Líneas de la solicitud" columnas={LINEAS} filas={s.lineas} clave={(l) => String(l.posicion)} vacio={<EstadoVacio titulo="Sin líneas" icono="caja" />} />
      <HojaDeDecision abierto={hoja === 'rechazar'} titulo="Rechazar solicitud" etiqueta="Motivo del rechazo" textoBoton="Rechazar" peligro alCerrar={() => setHoja(null)} alEnviar={(motivo) => aplicar(resolverSolicitud({ id: s.id, decision: 'rechazar', motivo }), 'Solicitud rechazada.')} />
      <HojaDeDecision abierto={hoja === 'anular'} titulo="Anular solicitud" etiqueta="Motivo de la anulación" textoBoton="Anular solicitud" peligro alCerrar={() => setHoja(null)} alEnviar={(motivo) => aplicar(anularSolicitud({ id: s.id, motivo }), 'Solicitud anulada.')} />
      <HojaDeConversion abierto={hoja === 'convertir'} solicitud={s} alCerrar={() => setHoja(null)} alConvertir={(ordenId) => void navegar(`/m/compras/${ordenId}`)} />
    </div>
  );
}

/** Ficha de una solicitud de compra: sus líneas y las acciones que su estado permite. */
export function PantallaSolicitud() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_COMPRAS, 'solicitud', id], queryFn: async () => datosOError(await verSolicitud(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando solicitud de compra" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta solicitud" descripcion={consulta.error.message} icono="caja" />;
  return <Contenido s={consulta.data} />;
}
