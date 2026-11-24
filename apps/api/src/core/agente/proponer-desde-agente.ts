import { exito, type NombreDeHerramienta, type Respuesta } from '@capaz/shared';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { proponerBorrador } from '../borradores/proponer.js';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import type { ProponerDelBucle } from './tipos-del-turno.js';

// Lo que el asistente no ejecuta él mismo (lo que decide una persona, lo crítico, el dinero fuera de las guardas) queda como
// BORRADOR en la Bandeja, con origen «agente». Es el mismo camino que usan las reglas y el dictado: la persona lo aprueba con un
// clic y la herramienta se ejecuta entonces, con los permisos de quien aprueba. El resumen lo redacta el servidor, no el modelo.

export const NOTA_DE_BORRADOR = 'Quedó como borrador en la Bandeja. Una persona debe aprobarlo: todavía NO está hecho. Díselo así.';

type Dependencias = { ejecutor: Pick<EjecutorDeHerramientas, 'validar'>; db: Pick<DatabaseService, 'conEmpresa'>; conversacionId: string; turnoId: string };

export function crearProponerDesdeAgente({ ejecutor, db, conversacionId, turnoId }: Dependencias): ProponerDelBucle {
  return async (nombre: string, args: unknown, ctx: ContextoDeHerramienta): Promise<Respuesta<unknown>> => {
    // Lo que ya no podría ejecutarse (sin permiso, módulo cerrado, argumentos mal formados) no se propone: el error vuelve al modelo.
    const v = ejecutor.validar(nombre, args, ctx);
    if (!v.ok) return v.respuesta;
    const resumen = v.herramienta.ayuda.titulo;
    const { id } = await db.conEmpresa({ empresaId: ctx.empresaId, usuarioId: ctx.usuarioId }, (tx) =>
      proponerBorrador(tx, { herramienta: nombre as NombreDeHerramienta, args: v.datos, resumen, origen: 'agente', origenRef: `agente:${conversacionId}:${turnoId}`, propuestoPor: ctx.usuarioId }),
    );
    return exito({ propuesto: true, nota: NOTA_DE_BORRADOR, borradores: [{ id, herramienta: nombre, resumen, args: v.datos, sugerencias: [] }] });
  };
}
