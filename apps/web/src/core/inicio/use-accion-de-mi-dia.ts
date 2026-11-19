import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MiDiaDto, NombreDeHerramienta, TarjetaDeMiDia } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { avisoDeAccion, sinTarjeta } from './mi-dia-logica.ts';

export const CLAVE_MI_DIA = ['inicio', 'mi-dia'] as const;

type Accion = TarjetaDeMiDia['acciones'][number];

/** Ejecuta la herramienta de la acción con `llamar` (el servidor vuelve a validar permisos); una crítica pasa por su confirmación. */
async function ejecutar(accion: Accion): Promise<void> {
  const nombre = accion.herramienta as NombreDeHerramienta;
  const r = await llamar(nombre, accion.args as never);
  if (r.ok) return;
  if ('requiereConfirmacion' in r) {
    const c = await llamarConfirmando(nombre, accion.args as never, { titulo: accion.etiqueta });
    if ('cancelada' in c && c.cancelada) throw new Cancelada();
    if (!('ok' in c) || !c.ok) throw new Error(('error' in c && c.error?.mensaje) || 'No se pudo completar.');
    return;
  }
  throw new Error('error' in r ? r.error.mensaje : 'No se pudo completar.');
}
class Cancelada extends Error {}

/**
 * La acción de un clic de una tarjeta: la tarjeta sale de la lista al instante (optimista), y si el servidor la rechaza
 * vuelve con un aviso; si sale bien, avisa y recarga el panel para ver el estado real.
 */
export function useAccionDeMiDia(tarjeta: TarjetaDeMiDia) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ejecutar,
    onMutate: async (accion: Accion) => {
      await cliente.cancelQueries({ queryKey: CLAVE_MI_DIA });
      const antes = cliente.getQueryData<MiDiaDto>(CLAVE_MI_DIA);
      if (antes) cliente.setQueryData<MiDiaDto>(CLAVE_MI_DIA, sinTarjeta(antes, tarjeta.clave));
      return { antes, accion };
    },
    onError: (e, _accion, contexto) => {
      if (contexto?.antes) cliente.setQueryData(CLAVE_MI_DIA, contexto.antes);
      if (!(e instanceof Cancelada)) notificar(e instanceof Error ? e.message : 'No se pudo completar la acción.', 'error');
    },
    onSuccess: (_d, accion) => notificar(avisoDeAccion(accion.etiqueta, tarjeta), 'exito'),
    onSettled: () => cliente.invalidateQueries({ queryKey: ['inicio'] }),
  });
}
