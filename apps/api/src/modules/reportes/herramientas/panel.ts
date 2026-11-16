import { exito, type BloqueDelPanelDto, type PanelDto, type Respuesta } from '@capaz/shared';
import type { EjecutorDeHerramientas } from '../../../core/herramientas/ejecutor.js';
import type { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { bloqueDe, ordenarModulos } from '../domain/composicion.js';

const SUFIJO = '_resumen';

/** Los resúmenes registrados de otros módulos, descubiertos por nombre (`<codigo>_resumen`): nada se importa de `modules/*`. */
function resumenesDisponibles(registro: RegistroDeHerramientas, ctx: ContextoDeHerramienta) {
  return registro
    .todas()
    .filter((h) => h.nombre === `${h.modulo}${SUFIJO}` && h.modulo !== 'reportes' && h.modulo !== 'core')
    .flatMap((h) => {
      const acceso = ctx.modulos.find((m) => m.codigo === h.modulo);
      // Quien no puede entrar al módulo o no tiene el permiso del resumen no ve ese bloque (ni queda rastro de un rechazo).
      if (!acceso?.puedeEntrar || (h.permiso !== null && !ctx.permisos.includes(h.permiso))) return [];
      return [{ nombre: h.nombre, modulo: h.modulo, soloLectura: !acceso.puedeEscribir }];
    });
}

/**
 * Llama a cada `<codigo>_resumen` accesible con `ejecutarDentro` (mismos permisos, alcance y auditoría que si la
 * persona lo pidiera a mano). Un resumen que responde con error (p. ej. alcance «propios») simplemente no aparece.
 */
export async function componerPanel(
  ejecutor: EjecutorDeHerramientas,
  registro: RegistroDeHerramientas,
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  periodo: { desde: string; hasta: string },
): Promise<Respuesta<PanelDto>> {
  const bloques: BloqueDelPanelDto[] = [];
  for (const r of resumenesDisponibles(registro, ctx)) {
    const respuesta = await ejecutor.ejecutarDentro(tx, r.nombre, periodo, { ctx });
    if (respuesta.ok && 'datos' in respuesta) bloques.push(bloqueDe(r.modulo, respuesta.datos, r.soloLectura));
  }
  return exito({ ...periodo, bloques: ordenarModulos(bloques) });
}
