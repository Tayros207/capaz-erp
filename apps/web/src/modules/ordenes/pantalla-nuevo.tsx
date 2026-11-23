import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { IGV_POR_DEFECTO, type PedidoCompletoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { AvisoDeMontoMinimo } from '../../shared/ui/aviso-de-monto-minimo.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { enviarPorWhatsApp } from './acciones-documentos.ts';
import { usePermisosDePedidos } from './acciones.ts';
import { verPedido } from './api.ts';
import { AvisoDeConfirmacion } from './aviso-de-confirmacion.tsx';
import { BloqueDePago } from './bloque-pago.tsx';
import { CLAVE_PEDIDOS } from './claves.ts';
import { TITULO_DE_DOCUMENTO } from './documentos.ts';
import { FormularioPedido } from './formulario-pedido.tsx';
import { LineasDePedido } from './lineas-de-pedido.tsx';
import { formatearDia, formularioDesde } from './logica.ts';
import { Cargando } from './marco.tsx';
import { useHojaDePedido, type Confirmado } from './use-hoja-de-pedido.ts';

const MIGAS = [{ texto: 'Pedidos', a: '/m/ordenes' }, { texto: 'Nuevo pedido' }];

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

function Confirmada({ r, alNuevo }: { r: Confirmado; alNuevo: () => void }) {
  const navegar = useNavigate();
  const consulta = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'ficha', r.id], queryFn: async (): Promise<PedidoCompletoDto> => datosOError(await verPedido(r.id)) });
  const parcial = r.cobro !== null && r.cobro.estado !== 'completo';
  const deuda = r.cobro && 'deuda' in r.cobro ? r.cobro.deuda : null;
  const p = consulta.data;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={`Pedido ${r.codigo}`}
        migas={MIGAS}
        accionPrincipal={<Boton variante="primario" onClick={() => void navegar(`/m/ordenes/${r.id}/nota`)}>{`Imprimir ${TITULO_DE_DOCUMENTO.nota.toLowerCase()}`}</Boton>}
        accionesSecundarias={
          <>
            <Boton disabled={!p} onClick={() => p && void enviarPorWhatsApp(p)}>Enviar por WhatsApp</Boton>
            <Boton onClick={() => void navegar(`/m/ordenes/${r.id}`)}>Ver pedido</Boton>
            <Boton onClick={alNuevo}>Nuevo pedido</Boton>
          </>
        }
      />
      <AvisoDeConfirmacion tono={parcial ? 'alerta' : 'exito'} mensaje={r.cobro?.mensaje ?? `Pedido ${r.codigo} confirmado.`} deuda={deuda} />
      {consulta.isPending ? <Cargando etiqueta="Cargando el pedido confirmado" /> : null}
      {consulta.isError ? <p role="alert" className="text-sm font-medium text-peligro">No se pudo cargar el detalle: {consulta.error.message}</p> : null}
      {p ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Cliente" valor={p.clienteNombre} />
            <Dato etiqueta="Fecha de entrega" valor={formatearDia(p.entregaEl)} />
            <Dato etiqueta="Notas" valor={p.notas ?? ''} />
          </dl>
          <LineasDePedido lineas={formularioDesde(p).lineas} igvPorcentaje={p.igvPorcentaje} />
        </>
      ) : null}
    </div>
  );
}

/** Pedido en una sola hoja: cliente, detalle en filas, pago y confirmación; tras confirmar queda en lectura con sus acciones. */
export function PantallaNuevoPedido() {
  const navegar = useNavigate();
  const { editar } = usePermisosDePedidos();
  const h = useHojaDePedido();

  if (!editar) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Nuevo pedido" migas={MIGAS} />
        <EstadoVacio titulo="Tu acceso a Pedidos es de solo lectura" descripcion="Pide a quien administra tu empresa que te dé acceso completo." icono="aviso" />
      </div>
    );
  }
  if (h.confirmado) return <Confirmada r={h.confirmado} alNuevo={h.nuevaHoja} />;
  return (
    // Sin botón de envío dentro del formulario: Enter en un campo nunca confirma el pedido sin querer.
    <form noValidate className="flex flex-col gap-6" onSubmit={(ev) => ev.preventDefault()}>
      <EncabezadoDePagina titulo="Nuevo pedido" migas={MIGAS} />
      <FormularioPedido valor={h.form} errores={h.errores} igvPorcentaje={IGV_POR_DEFECTO} fecha={h.hoy} alCambiar={h.cambiar} />
      {h.pago.visible ? (
        <BloqueDePago habilitado={h.pago.habilitado} totalCentimos={h.totalCentimos} hoy={h.hoy} pago={h.pago.pago} errores={h.pago.errores} cuentas={h.pago.cuentas} cargandoCuentas={h.pago.cargandoCuentas} alCambiar={h.pago.cambiar} />
      ) : null}
      <AvisoDeMontoMinimo totalCentimos={h.totalCentimos} />
      {h.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{h.aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" disabled={h.enviando} onClick={() => void navegar('/m/ordenes')}>Cancelar</Boton>
        <Boton disabled={h.enviando} onClick={() => void h.guardarBorrador()}>Guardar borrador</Boton>
        <Boton variante="primario" cargando={h.enviando} onClick={() => void h.confirmar()}>{h.pago.textoDeConfirmar}</Boton>
      </div>
    </form>
  );
}
