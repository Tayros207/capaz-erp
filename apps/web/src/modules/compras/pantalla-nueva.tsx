import { useState } from 'react';
import { useNavigate } from 'react-router';
import { IGV_DE_COMPRA_POR_DEFECTO } from '@capaz/shared';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarCompras, usePermisosDeCompras } from './acciones.ts';
import { crearCompra } from './api.ts';
import { FormularioCompra } from './formulario-compra.tsx';
import { FORMULARIO_VACIO, argumentosDeCreacion, diaEnZona, mensajeDeRechazo, validarCompra, type ErroresDeCompra, type FormularioDeCompra } from './logica.ts';

/** El formulario de alta y su guardado: crea el borrador y abre su ficha. */
function useNuevaCompra() {
  const navegar = useNavigate();
  const [form, setForm] = useState<FormularioDeCompra>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresDeCompra>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [hoy] = useState(() => diaEnZona(new Date(), ZONA_POR_DEFECTO));

  async function guardar() {
    const e = validarCompra(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setAviso(undefined);
    const r = await crearCompra(argumentosDeCreacion(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      await refrescarCompras();
      notificar('Borrador guardado. Revísalo y envíalo al proveedor para darle número.', 'exito');
      void navegar(`/m/compras/${r.datos.id}`, { replace: true });
    } else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return { form, errores, aviso, guardando, hoy, guardar, cambiar: (c: Partial<FormularioDeCompra>) => setForm((f) => ({ ...f, ...c })) };
}

/** Alta de una orden de compra: se guarda como borrador y se abre su ficha, donde se envía. */
export function PantallaNuevaCompra() {
  const navegar = useNavigate();
  const { editar } = usePermisosDeCompras();
  const n = useNuevaCompra();
  const migas = [{ texto: 'Órdenes de compra', a: '/m/compras' }, { texto: 'Nueva orden' }];
  if (!editar) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Nueva orden de compra" migas={migas} />
        <EstadoVacio titulo="Tu acceso a Compras es de solo lectura" descripcion="Pide a quien administra tu empresa que te dé acceso completo." icono="aviso" />
      </div>
    );
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void n.guardar();
      }}
    >
      <EncabezadoDePagina titulo="Nueva orden de compra" migas={migas} />
      <FormularioCompra valor={n.form} errores={n.errores} igvPorcentaje={IGV_DE_COMPRA_POR_DEFECTO} fecha={n.hoy} alCambiar={n.cambiar} />
      {n.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{n.aviso}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={() => void navegar('/m/compras')}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={n.guardando}>Guardar borrador</Boton>
      </div>
    </form>
  );
}
