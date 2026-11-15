import { rechazo, type Respuesta } from '@capaz/shared';

/** Lo que devuelve una llamada con confirmación: la respuesta, o que la persona cambió de idea. */
export type ResultadoConfirmado<S> = Respuesta<S> | { cancelada: true };

type Llamada = (confirmacion?: string) => Promise<Respuesta<unknown>>;

const MAXIMO_DE_VENCIMIENTOS = 2;

/**
 * Confirmación en dos pasos de una herramienta crítica. La primera llamada no ejecuta nada: devuelve un
 * resumen y un token. Si la persona acepta, se reenvía el token en `confirmacion`. Si el token venció se
 * vuelve a pedir uno nuevo (y a preguntar), hasta dos veces; después se devuelve el rechazo tal cual.
 */
export async function ejecutarConConfirmacion(
  llamada: Llamada,
  preguntar: (resumen: string, vencio: boolean) => Promise<boolean>,
): Promise<ResultadoConfirmado<unknown>> {
  let vencimientos = 0;
  let respuesta = await llamada();
  for (;;) {
    if (respuesta.ok || !('requiereConfirmacion' in respuesta)) return respuesta;
    const { resumen, token } = respuesta.requiereConfirmacion;
    if (!(await preguntar(resumen, vencimientos > 0))) return { cancelada: true };
    respuesta = await llamada(token);
    if (!respuesta.ok && 'error' in respuesta && respuesta.error.codigo === 'confirmacion_vencida') {
      if (++vencimientos > MAXIMO_DE_VENCIMIENTOS) {
        return rechazo('confirmacion_vencida', 'La confirmación venció varias veces. Vuelve a intentarlo.');
      }
      respuesta = await llamada();
    }
  }
}
