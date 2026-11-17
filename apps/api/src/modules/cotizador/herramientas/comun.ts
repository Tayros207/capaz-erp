import { rechazo, type ErrorDeRespuesta } from '@capaz/shared';
import type { Rechazo } from '../domain/precios.js';

// Lo común de las herramientas del módulo. El acceso al módulo, el permiso y el «solo lectura» los resuelve
// el ejecutor (R2). El Cotizador no tiene alcance «propios»: la lista, los ajustes y la configuración son catálogos.

export const MODULO = 'cotizador';
export const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';

/** Una regla del dominio que no pasó, como respuesta de herramienta. */
export const rechazoDe = (r: Rechazo): { ok: false; error: ErrorDeRespuesta } => rechazo(r.codigo, r.mensaje);
