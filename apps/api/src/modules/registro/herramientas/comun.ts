import { rechazo, type ErrorDeRespuesta } from '@capaz/shared';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import type { Rechazada } from '../domain/regla.js';

// Lo común de las herramientas del módulo. El acceso al módulo, el permiso y el «solo lectura» los resuelve
// el ejecutor (R2): aquí solo va el alcance «propios» (R4), que depende de cada fila.

export const MODULO = 'registro';
export const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';

/** Con alcance «propios», el usuario dueño de las filas que se pueden ver y cambiar; `null` si ve todo. */
export const propietarioDe = (ctx: ContextoDeHerramienta): string | null => (alcanceDe(ctx, MODULO) === 'propios' ? ctx.usuarioId : null);

/** Los reportes suman lo de toda la empresa: con alcance «propios» no se entregan. */
export function exigirAlcanceTotal(ctx: ContextoDeHerramienta): { ok: false; error: ErrorDeRespuesta } | null {
  return alcanceDe(ctx, MODULO) === 'propios' ? rechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.') : null;
}

/** Una regla del dominio que no pasó, como respuesta de herramienta. */
export const rechazoDe = (r: Rechazada) => rechazo(r.codigo, r.mensaje);
