import { useState } from 'react';
import { useNavigate } from 'react-router';
import { IGV_POR_DEFECTO } from '@capaz/shared';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarPedidos, usePermisosDePedidos } from './acciones.ts';
import { crearPedido } from './api.ts';
import { FormularioPedido } from './formulario-pedido.tsx';
import { FORMULARIO_VACIO, argumentosDeCreacion, diaEnZona, mensajeDeRechazo, validarPedido, type ErroresDePedido, type FormularioDePedido } from './logica.ts';

/** Alta de un pedido: se guarda como borrador y se abre su ficha, donde se confirma. */
export function PantallaNuevoPedido() {
  const navegar = useNavigate();
  const { editar } = usePermisosDePedidos();
  const [form, setForm] = useState<FormularioDePedido>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresDePedido>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [hoy] = useState(() => diaEnZona(new Date(), ZONA_POR_DEFECTO));

  async function guardar() {
    const e = validarPedido(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setAviso(undefined);
    const r = await crearPedido(argumentosDeCreacion(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      await refrescarPedidos();
      notificar('Borrador guardado. Revísalo y confírmalo para darle número.', 'exito');
      void navegar(`/m/ordenes/${r.datos.id}`, { replace: true });
    } else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  const migas = [{ texto: 'Pedidos', a: '/m/ordenes' }, { texto: 'Nuevo pedido' }];
  if (!editar) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Nuevo pedido" migas={migas} />
        <EstadoVacio titulo="Tu acceso a Pedidos es de solo lectura" descripcion="Pide a quien administra tu empresa que te dé acceso completo." icono="aviso" />
      </div>
    );
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void guardar();
      }}
    >
      <EncabezadoDePagina titulo="Nuevo pedido" migas={migas} />
      <FormularioPedido valor={form} errores={errores} igvPorcentaje={IGV_POR_DEFECTO} fecha={hoy} alCambiar={(c) => setForm((f) => ({ ...f, ...c }))} />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={() => void navegar('/m/ordenes')}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Guardar borrador</Boton>
      </div>
    </form>
  );
}
