import { llamar } from '../../shared/api/herramientas.ts';
import { notificar } from '../../shared/ui/notificar.ts';

// «Solicitar» un módulo no contratado: llama a la herramienta `modulo_solicitar`.
// El menú y las tarjetas solo conocen esta función.
export async function solicitarModulo(codigo: string, nombre: string): Promise<void> {
  const r = await llamar('modulo_solicitar', { modulo: codigo });
  if (r.ok && 'datos' in r) {
    notificar(
      r.datos.yaSolicitado ? `Ya habías solicitado «${nombre}».` : `Solicitaste «${nombre}». Te avisaremos.`,
      r.datos.yaSolicitado ? 'info' : 'exito',
    );
  } else if ('error' in r) {
    notificar(r.error.mensaje, 'error');
  }
}
