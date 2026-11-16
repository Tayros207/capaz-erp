import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { CompraCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { BarraDeEstado } from '../../shared/ui/datos/barra-de-estado.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { cancelar, enviar, refrescarCompras, usePermisosDeCompras } from './acciones.ts';
import { verCompra } from './api.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { FichaLectura, Recepciones } from './ficha-lectura.tsx';
import { FormularioCompra } from './formulario-compra.tsx';
import { HojaMotivo } from './hoja-motivo.tsx';
import { PASOS_DE_COMPRA, pasoActual, sePuedeCancelar, siguientePaso } from './logica.ts';
import { Cargando, InsigniasDeCompra } from './marco.tsx';
import { useBorrador } from './use-borrador.ts';

/** Guardar el borrador, enviarlo o abrir la recepción, con un solo indicador de ocupado. */
function usePasos(compra: CompraCompletaDto, editar: boolean) {
  const navegar = useNavigate();
  const borrador = useBorrador(compra, compra.estado === 'borrador' && editar);
  const [ocupado, setOcupado] = useState(false);
  const principal = editar ? siguientePaso(compra.estado) : null;

  async function conOcupado(fn: () => Promise<void>) {
    setOcupado(true);
    await fn();
    setOcupado(false);
  }
  const guardarCambios = () =>
    conOcupado(async () => {
      if (!(await borrador.guardar())) return;
      notificar('Borrador guardado.', 'exito');
      await refrescarCompras();
    });
  // Enviar guarda antes lo que esté sin guardar: se envía lo que se ve. Recibir abre su pantalla.
  const darPaso = () =>
    conOcupado(async () => {
      if (principal?.tipo === 'recibir') return void navegar(`/m/compras/${compra.id}/recibir`);
      if (!(await borrador.guardar())) return;
      if (!(await enviar(compra.id))) await refrescarCompras();
    });
  return { borrador, ocupado, principal, guardarCambios, darPaso };
}

function Contenido({ compra }: { compra: CompraCompletaDto }) {
  const permisos = usePermisosDeCompras();
  const editable = compra.estado === 'borrador' && permisos.editar;
  const { borrador, ocupado, principal, guardarCambios, darPaso } = usePasos(compra, permisos.editar);
  const [cancelando, setCancelando] = useState(false);

  const acciones: AccionDeMenu[] =
    permisos.cancelar && sePuedeCancelar(compra.estado, compra.recepciones.length) ? [{ etiqueta: 'Cancelar orden', peligro: true, onSeleccionar: () => setCancelando(true) }] : [];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={compra.numero === null ? `Orden a ${compra.proveedorNombre}` : compra.codigo}
        migas={[{ texto: 'Órdenes de compra', a: '/m/compras' }, { texto: compra.codigo }]}
        accionPrincipal={principal ? <Boton variante="primario" cargando={ocupado} onClick={() => void darPaso()}>{principal.texto}</Boton> : undefined}
        accionesSecundarias={
          <>
            <InsigniasDeCompra compra={compra} />
            {editable ? <Boton cargando={ocupado} disabled={!borrador.hayCambios} onClick={() => void guardarCambios()}>Guardar cambios</Boton> : null}
            {acciones.length > 0 ? <MenuDeAcciones etiqueta="Más acciones de la orden" acciones={acciones} /> : null}
          </>
        }
      />
      {compra.estado === 'cancelada' ? null : <BarraDeEstado pasos={PASOS_DE_COMPRA} actual={pasoActual(compra.estado)} etiqueta="Estado de la orden de compra" />}
      {borrador.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{borrador.aviso}</p> : null}
      {editable ? (
        <FormularioCompra valor={borrador.form} errores={borrador.errores} igvPorcentaje={compra.igvPorcentaje} fecha={compra.fecha} alCambiar={borrador.cambiar} />
      ) : (
        <FichaLectura c={compra} />
      )}
      {compra.estado === 'borrador' ? null : <Recepciones c={compra} />}
      <HojaMotivo abierto={cancelando} alEnviar={(m) => cancelar(compra.id, m)} alCerrar={() => setCancelando(false)} />
    </div>
  );
}

export function PantallaFichaCompra() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_COMPRAS, 'ficha', id], queryFn: async () => datosOError(await verCompra(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando orden de compra" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta orden de compra" descripcion={consulta.error.message} icono="caja" />;
  // `key` reinicia el formulario cuando el servidor devuelve una versión nueva de la orden.
  return <Contenido key={`${consulta.data.id}-${consulta.data.actualizadoEn}`} compra={consulta.data} />;
}
