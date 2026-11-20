import { MAXIMO_DE_PROPUESTAS_POR_CAPTURA, rechazo } from '@capaz/shared';
import { datosDeHerramienta } from '../borradores/catalogo.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import type { InterpreteDeCaptura, PropuestaInterpretada } from './tipos.js';

/**
 * Comprueba, antes de guardar nada, que la persona podría aprobar cada propuesta. Es todo o nada.
 * Una herramienta desconocida o de un módulo que el intérprete no declara es un error de programación del intérprete.
 * Las de otros módulos declarados (`tambienPropone`) exigen además que la persona pueda entrar y escribir en ellos.
 */
export function revisarPropuestas(
  propuestas: readonly PropuestaInterpretada[],
  interprete: Pick<InterpreteDeCaptura, 'modulo' | 'tambienPropone'>,
  ctx: Pick<ContextoDeHerramienta, 'permisos' | 'modulos'>,
) {
  const { modulo } = interprete;
  if (propuestas.length > MAXIMO_DE_PROPUESTAS_POR_CAPTURA) {
    throw new Error(`El intérprete de «${modulo}» devolvió ${propuestas.length} propuestas: el máximo es ${MAXIMO_DE_PROPUESTAS_POR_CAPTURA}.`);
  }
  const permitidos = [modulo, ...(interprete.tambienPropone ?? [])];
  for (const p of propuestas) {
    const d = datosDeHerramienta(p.herramienta);
    if (!d || !permitidos.includes(d.modulo)) throw new Error(`El intérprete de «${modulo}» propuso «${p.herramienta}», que no es de ese módulo.`);
    if (d.modulo !== modulo) {
      const acceso = ctx.modulos.find((m) => m.codigo === d.modulo);
      if (!acceso?.puedeEntrar) return rechazo('modulo_no_disponible', 'Lo que dictaste se registra en un módulo que no tienes disponible.');
      if (!acceso.puedeEscribir) return rechazo('modulo_solo_lectura', 'Lo que dictaste se registra en un módulo en el que solo puedes leer.');
    }
    if (d.permiso !== null && !ctx.permisos.includes(d.permiso)) return rechazo('sin_permiso', 'No tienes permiso para registrar eso.');
  }
  return null;
}
