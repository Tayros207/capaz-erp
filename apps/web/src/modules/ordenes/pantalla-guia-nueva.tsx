import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import type { PreparacionDeGuiaDto } from '@capaz/shared';
import { HojaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { usePermisosDePedidos } from './acciones.ts';
import { emitir } from './acciones-guias.ts';
import { argumentosDeEmision, hayErrores, leerRutaDeGuiaNueva, validarGuia, vistaPreviaDeGuia, type Armado } from './armado-de-guia.ts';
import { CuerpoDeGuia } from './cuerpo-de-guia.tsx';
import { FormularioDeTraslado } from './formulario-de-traslado.tsx';
import { AVISO_DE_GUIA, formatoDeGuia, tituloDeGuia } from './guias.ts';
import { AgregarPedido, LineasLibres, PedidosDeLaGuia } from './lineas-de-guia.tsx';
import { Cargando } from './marco.tsx';
import { useArmadoDeGuia } from './use-armado-de-guia.ts';

function Destinatario({ cliente }: { cliente: PreparacionDeGuiaDto['cliente'] }) {
  return (
    <p className="text-texto">
      <span className="text-sm text-texto-suave">Destinatario: </span>
      <span className="font-medium">{cliente.nombre}</span>
      {cliente.documento ? <span className="text-sm text-texto-suave">{` · ${cliente.documento}`}</span> : null}
    </p>
  );
}

function Armador({ origen }: { origen: ReturnType<typeof leerRutaDeGuiaNueva> }) {
  const navegar = useNavigate();
  const a = useArmadoDeGuia(origen);
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const { prep } = a;
  if (a.preparacion.isError) return <EstadoVacio titulo="No pudimos preparar la guía" descripcion={a.preparacion.error.message} icono="caja" />;
  if (!prep) return <Cargando etiqueta="Preparando la guía" />;

  const armado: Armado = { selecciones: a.selecciones, libres: a.libres, traslado: a.traslado };
  const errores = validarGuia(prep, armado);
  const visibles = intentado ? errores : { traslado: {}, lineas: {}, libres: {} };

  async function emitirGuia() {
    setIntentado(true);
    if (!prep || hayErrores(errores) || enviando) return;
    setEnviando(true);
    const guia = await emitir(argumentosDeEmision(prep, armado));
    setEnviando(false);
    if (guia) void navegar(`/m/ordenes/guias/${guia.id}`, { replace: true });
  }

  const previa = vistaPreviaDeGuia(prep, armado, a.hoy);
  return (
    <div className="flex flex-col gap-4">
      <div className="no-imprimir flex flex-col gap-4">
        <p role="note" className="rounded-md border border-borde bg-superficie p-3 text-sm text-texto-suave">{`${AVISO_DE_GUIA}. Se guarda con un número correlativo y se puede reimprimir.`}</p>
        <Destinatario cliente={prep.cliente} />
        <PedidosDeLaGuia pedidos={prep.pedidos} selecciones={a.selecciones} errores={visibles.lineas} alCambiar={a.marcar} alQuitar={a.pedidos.quitar} />
        <AgregarPedido candidatos={prep.candidatos} alAgregar={a.pedidos.agregar} />
        <LineasLibres libres={a.libres} errores={visibles.libres} alCambiar={a.cambiarLibre} alQuitar={a.quitarLibre} alAgregar={a.agregarLibre} />
        <FormularioDeTraslado valor={a.traslado} errores={visibles.traslado} alCambiar={a.setTraslado} />
        {visibles.general ? <p role="alert" className="text-sm font-medium text-peligro">{visibles.general}</p> : null}
        <div className="flex justify-end"><Boton variante="primario" tamano="grande" cargando={enviando} onClick={() => void emitirGuia()}>Emitir guía</Boton></div>
        <h2 className="font-titulo font-semibold text-texto">Vista previa</h2>
      </div>
      <VistaPreviaDeHoja>
        <HojaImprimible titulo={tituloDeGuia(previa)} empresa={a.empresa} aviso={AVISO_DE_GUIA} formato={formatoDeGuia(previa.lineas.length)}>
          <CuerpoDeGuia guia={previa} />
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </div>
  );
}

/** `/m/ordenes/guias/nueva?pedidos=a,b` o `?cliente=x`: arma una guía con varios pedidos del mismo cliente y líneas libres. */
export function PantallaNuevaGuia() {
  const { editar } = usePermisosDePedidos();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const origen = leerRutaDeGuiaNueva(params);
  const sinOrigen = origen.pedidoIds.length === 0 && !origen.clienteId;
  const volver = <Boton onClick={() => void navegar('/m/ordenes')}>Volver a Pedidos</Boton>;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Nueva guía de remisión" migas={[{ texto: 'Pedidos', a: '/m/ordenes' }, { texto: 'Guías', a: '/m/ordenes/guias' }, { texto: 'Nueva' }]} />
      {!editar ? (
        <EstadoVacio titulo="No puedes emitir guías" descripcion="Pídele a quien administra tu empresa el permiso para editar pedidos." icono="caja" accion={volver} />
      ) : sinOrigen ? (
        <EstadoVacio titulo="Elige qué enviar" descripcion="Abre la guía desde un pedido listo, desde la lista de pedidos o eligiendo un cliente en Guías." icono="caja" accion={volver} />
      ) : (
        // `key` reinicia el armado si cambia la ruta (otros pedidos o cliente).
        <Armador key={`${origen.pedidoIds.join(',')}|${origen.clienteId}`} origen={origen} />
      )}
    </div>
  );
}

/** La ruta de la fase 1 (`/m/ordenes/:id/guia-de-remision`) lleva al armado de la guía con ese pedido. */
export function RedirigirAGuiaNueva() {
  const { id = '' } = useParams();
  return <Navigate to={`/m/ordenes/guias/nueva?pedidos=${encodeURIComponent(id)}`} replace />;
}
