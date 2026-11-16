import { useState } from 'react';
import type { CompraCompletaDto } from '@capaz/shared';
import { editarCompra } from './api.ts';
import { argumentosDeEdicion, formularioDesde, mensajeDeRechazo, validarCompra, type ErroresDeCompra, type FormularioDeCompra } from './logica.ts';

/** El formulario de un borrador abierto en su ficha: qué cambió y cómo se guarda. */
export function useBorrador(compra: CompraCompletaDto, editable: boolean) {
  const [form, setForm] = useState<FormularioDeCompra>(() => formularioDesde(compra));
  const [errores, setErrores] = useState<ErroresDeCompra>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const cambios = editable ? argumentosDeEdicion(compra, form) : null;

  /** Guarda lo pendiente. Devuelve si quedó guardado (o no había nada que guardar). */
  async function guardar(): Promise<boolean> {
    if (!editable) return true;
    const e = validarCompra(form, compra.fecha);
    setErrores(e);
    if (Object.keys(e).length > 0) return false;
    if (!cambios) return true;
    setAviso(undefined);
    const r = await editarCompra(cambios);
    if (r.ok && 'datos' in r) return true;
    if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    return false;
  }

  return { form, errores, aviso, hayCambios: cambios !== null, guardar, cambiar: (c: Partial<FormularioDeCompra>) => setForm((f) => ({ ...f, ...c })) };
}
