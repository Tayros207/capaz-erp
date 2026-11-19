import { useRef, useState } from 'react';
import type { PedidoCompletoDto, VentaCorregidaDto } from '@capaz/shared';
import { argumentosDeCorreccion, formularioDeCorreccion, hayErrores, validarCorreccion, type ErroresDeCorreccion, type FormularioDeCorreccion } from './correccion.ts';
import { corregirVenta } from './api.ts';
import { mensajeDeRechazo } from './logica.ts';

/** `editar` → `calculando` (el servidor arma el resumen) → `listo` (la persona decide) → `guardando`; `error` si el servidor rechaza. */
export type FaseDeCorreccion = 'editar' | 'calculando' | 'listo' | 'guardando' | 'error';

export type ErrorDeServidor = { codigo: string; mensaje: string };

/**
 * El estado de la hoja «Corregir pedido»: formulario, validación y los dos pasos hacia el servidor con UNA sola
 * confirmación (el resumen llega, la persona pulsa «Guardar versión 2» y esa es la confirmación).
 */
export function useCorreccion(pedido: PedidoCompletoDto, alGuardar: (r: VentaCorregidaDto) => void) {
  const [form, setForm] = useState<FormularioDeCorreccion>(() => formularioDeCorreccion(pedido));
  const [errores, setErrores] = useState<ErroresDeCorreccion>({});
  const [fase, setFase] = useState<FaseDeCorreccion>('editar');
  const [resumen, setResumen] = useState('');
  const [error, setError] = useState<ErrorDeServidor | null>(null);
  const decision = useRef<((acepta: boolean) => void) | null>(null);
  // El estado no basta contra el doble clic: dos clics seguidos ven el mismo render. La bandera sí.
  const bloqueo = useRef(false);

  const cambiar = (c: Partial<FormularioDeCorreccion>) => {
    setForm((f) => ({ ...f, ...c }));
    setErrores({});
  };

  async function revisar() {
    if (bloqueo.current) return;
    const e = validarCorreccion(pedido, form);
    setErrores(e);
    if (hayErrores(e)) return;
    bloqueo.current = true;
    setError(null);
    setFase('calculando');
    try {
      const r = await corregirVenta(argumentosDeCorreccion(pedido, form), (texto) => {
        setResumen(texto);
        setFase('listo');
        return new Promise<boolean>((resolver) => { decision.current = resolver; });
      });
      decision.current = null;
      if ('cancelada' in r) return setFase('editar');
      if (r.ok && 'datos' in r) return alGuardar(r.datos);
      const e2 = 'error' in r ? r.error : { codigo: 'error', mensaje: 'No se pudo guardar la corrección.' };
      setError({ codigo: e2.codigo, mensaje: mensajeDeRechazo(e2.codigo, e2.mensaje) });
      setFase('error');
    } finally {
      bloqueo.current = false;
    }
  }

  const guardar = () => {
    if (fase !== 'listo' || !decision.current) return;
    setFase('guardando');
    decision.current(true);
  };

  /** Vuelve a editar: si el resumen estaba esperando, se cancela sin guardar nada. */
  const volver = () => {
    if (decision.current) decision.current(false);
    else setFase('editar');
  };

  return { form, errores, fase, resumen, error, cambiar, revisar, guardar, volver };
}
