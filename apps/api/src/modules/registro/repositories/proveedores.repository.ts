import { and, eq } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { clienteComercial } from '../../../db/esquema/core-maestros-ampliados.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Lee la ficha comercial que guarda el núcleo (`core.cliente_comercial`); registro no escribe en ella.

/**
 * Los días de plazo que el proveedor da para pagar, o `null` si no tiene ficha comercial.
 *
 * LIMITACIÓN: la ficha comercial no tiene un campo propio del plazo de un proveedor; `condicion_pago_dias` es la condición
 * de pago de la ficha del contacto (la que se da como cliente). Para no aplicar el plazo que la empresa le da a un cliente
 * a una compra, solo se usa en contactos de tipo `proveedor`: un contacto `ambos` queda sin vencimiento hasta que exista un
 * campo de plazo de proveedor.
 */
export async function plazoDePagoDeProveedor(tx: Transaccion, ctx: ContextoDeEmpresa, proveedorId: string): Promise<number | null> {
  const [f] = await tx
    .select({ dias: clienteComercial.condicionPagoDias })
    .from(clienteComercial)
    .innerJoin(clientes, and(eq(clientes.tenantId, clienteComercial.tenantId), eq(clientes.id, clienteComercial.clienteId)))
    .where(and(eq(clienteComercial.tenantId, ctx.empresaId), eq(clienteComercial.clienteId, proveedorId), eq(clientes.tipo, 'proveedor')));
  return f?.dias ?? null;
}
