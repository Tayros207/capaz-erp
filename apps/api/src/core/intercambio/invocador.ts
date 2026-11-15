import type { Respuesta } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';

/**
 * Llama a una herramienta de alta (`clientes_crear`, `productos_crear`) DENTRO de la transacción de la
 * importación, con el contexto de quien importa: pasa por el ejecutor (módulo, permiso, esquema,
 * auditoría por fila) mediante `ejecutarDentro`.
 */
export class Invocador {
  constructor(private readonly ejecutor: EjecutorDeHerramientas) {}

  invocar(tx: Transaccion, ctx: ContextoDeHerramienta, nombre: string, args: unknown): Promise<Respuesta<unknown>> {
    return this.ejecutor.ejecutarDentro(tx, nombre, args, { ctx });
  }
}
