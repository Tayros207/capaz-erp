import { rechazo, type Respuesta } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { EscritorDeAuditoria } from '../auditoria/escritor.js';
import { hashCanonico } from '../herramientas/confirmacion.js';
import { OPCIONES_EN_ESPANOL, mensajeDeZod } from '../herramientas/errores-de-zod.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';

/**
 * Llama a una herramienta de alta (`clientes_crear`, `productos_crear`) DENTRO de la transacción de la
 * importación, con el contexto de quien importa: mismas comprobaciones de módulo y permiso, mismo esquema
 * de entrada y la misma auditoría por fila que haría `ejecutar()`.
 *
 * Por qué no `ejecutarDentro()`: abre un punto de guardado y `emitir()` exige la transacción raíz, así que
 * toda herramienta que emite un evento (las dos de alta) falla ahí con «error_interno». Está pedido como
 * solicitud de cambio; cuando se corrija, este archivo se reemplaza por una llamada a `ejecutarDentro`.
 */
export class Invocador {
  constructor(
    private readonly registro: RegistroDeHerramientas,
    private readonly escritor: EscritorDeAuditoria,
  ) {}

  async invocar(tx: Transaccion, ctx: ContextoDeHerramienta, nombre: string, argsCrudos: unknown): Promise<Respuesta<unknown>> {
    const inicio = performance.now();
    const h = this.registro.obtener(nombre);
    const hashArgs = hashCanonico(argsCrudos);
    const terminar = async (r: Respuesta<unknown>, datos?: unknown): Promise<Respuesta<unknown>> => {
      await this.escritor.registrar(tx, {
        ctx,
        modulo: h?.modulo ?? 'desconocido',
        herramienta: nombre,
        resultado: r.ok ? 'ok' : 'rechazada',
        codigo: r.ok ? null : 'error' in r ? r.error.codigo : null,
        hashArgs,
        datos: h && r.ok ? h.auditar?.(datos, r.datos) : undefined,
        duracionMs: performance.now() - inicio,
      });
      return r;
    };
    if (!h) return terminar(rechazo('herramienta_desconocida', `No existe la herramienta «${nombre}».`));
    if (!ctx.modulos.some((m) => m.codigo === h.modulo && m.puedeEntrar)) return terminar(rechazo('modulo_no_disponible', 'El módulo no está disponible.'));
    if (h.permiso !== null && !ctx.permisos.includes(h.permiso)) return terminar(rechazo('sin_permiso', `No tienes permiso para usar «${nombre}».`));
    const parseo = h.entrada.safeParse(argsCrudos, OPCIONES_EN_ESPANOL);
    if (!parseo.success) return terminar(rechazo('argumentos_invalidos', mensajeDeZod(parseo.error)));
    const r = await h.ejecutar(parseo.data, ctx, tx);
    if ('requiereConfirmacion' in r) return terminar(rechazo('error_interno', 'Una herramienta de alta no puede pedir confirmación.'));
    return terminar(r, parseo.data);
  }
}
