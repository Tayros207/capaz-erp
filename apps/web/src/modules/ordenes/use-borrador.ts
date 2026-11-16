import { useState } from 'react';
import type { PedidoCompletoDto } from '@capaz/shared';
import { editarPedido } from './api.ts';
import { argumentosDeEdicion, formularioDesde, mensajeDeRechazo, validarPedido, type ErroresDePedido, type FormularioDePedido } from './logica.ts';

/** El formulario de un borrador abierto en su ficha: qué cambió y cómo se guarda. */
export function useBorrador(pedido: PedidoCompletoDto, editable: boolean) {
  const [form, setForm] = useState<FormularioDePedido>(() => formularioDesde(pedido));
  const [errores, setErrores] = useState<ErroresDePedido>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const cambios = editable ? argumentosDeEdicion(pedido, form) : null;

  /** Guarda lo pendiente. Devuelve si quedó guardado (o no había nada que guardar). */
  async function guardar(): Promise<boolean> {
    if (!editable) return true;
    const e = validarPedido(form, pedido.fecha);
    setErrores(e);
    if (Object.keys(e).length > 0) return false;
    if (!cambios) return true;
    setAviso(undefined);
    const r = await editarPedido(cambios);
    if (r.ok && 'datos' in r) return true;
    if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    return false;
  }

  return { form, errores, aviso, hayCambios: cambios !== null, guardar, cambiar: (c: Partial<FormularioDePedido>) => setForm((f) => ({ ...f, ...c })) };
}
