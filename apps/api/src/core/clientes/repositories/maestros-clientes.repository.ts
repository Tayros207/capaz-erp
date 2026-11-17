import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { clienteComercial, clienteContactos, clienteDirecciones } from '../../../db/esquema/core-maestros-ampliados.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Repositorio de la ficha comercial, contactos y direcciones de clientes y proveedores. Recibe la transacción de `conEmpresa`.

export type ClienteComercial = typeof clienteComercial.$inferSelect;
export type Contacto = typeof clienteContactos.$inferSelect;
export type Direccion = typeof clienteDirecciones.$inferSelect;
export type CambiosComerciales = Partial<Omit<ClienteComercial, 'tenantId' | 'clienteId' | 'creadoEn' | 'actualizadoEn' | 'actualizadoPor'>>;

export async function verComercial(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string): Promise<ClienteComercial | null> {
  const [f] = await tx.select().from(clienteComercial).where(and(eq(clienteComercial.tenantId, ctx.empresaId), eq(clienteComercial.clienteId, clienteId)));
  return f ?? null;
}

/** Crea la ficha con lo indicado (el resto, por defecto) o actualiza solo lo indicado. */
export async function guardarComercial(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string, cambios: CambiosComerciales): Promise<ClienteComercial> {
  const [f] = await tx
    .insert(clienteComercial)
    .values({ ...cambios, tenantId: ctx.empresaId, clienteId, actualizadoPor: ctx.usuarioId })
    .onConflictDoUpdate({
      target: [clienteComercial.tenantId, clienteComercial.clienteId],
      set: { ...cambios, actualizadoPor: ctx.usuarioId, actualizadoEn: sql`now()` },
    })
    .returning();
  return f!;
}

export async function listarContactos(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string): Promise<Contacto[]> {
  return tx
    .select()
    .from(clienteContactos)
    .where(and(eq(clienteContactos.tenantId, ctx.empresaId), eq(clienteContactos.clienteId, clienteId)))
    .orderBy(desc(clienteContactos.esPrincipal), asc(clienteContactos.nombre), asc(clienteContactos.id));
}

type DatosDeContacto = Pick<Contacto, 'nombre' | 'cargo' | 'telefono' | 'correo' | 'notas'> & { esPrincipal: boolean };

/** Si el contacto pasa a principal, el principal anterior deja de serlo (misma transacción). */
export async function guardarContacto(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string, id: string | undefined, d: DatosDeContacto): Promise<Contacto | null> {
  if (d.esPrincipal) {
    await tx
      .update(clienteContactos)
      .set({ esPrincipal: false, actualizadoEn: sql`now()` })
      .where(and(eq(clienteContactos.tenantId, ctx.empresaId), eq(clienteContactos.clienteId, clienteId), id ? ne(clienteContactos.id, id) : sql`true`));
  }
  if (!id) {
    const [f] = await tx.insert(clienteContactos).values({ ...d, tenantId: ctx.empresaId, clienteId, creadoPor: ctx.usuarioId }).returning();
    return f!;
  }
  const [f] = await tx
    .update(clienteContactos)
    .set({ ...d, actualizadoEn: sql`now()` })
    .where(and(eq(clienteContactos.tenantId, ctx.empresaId), eq(clienteContactos.clienteId, clienteId), eq(clienteContactos.id, id)))
    .returning();
  return f ?? null;
}

export async function eliminarContacto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const r = await tx.delete(clienteContactos).where(and(eq(clienteContactos.tenantId, ctx.empresaId), eq(clienteContactos.id, id))).returning({ id: clienteContactos.id });
  return r.length > 0;
}

export async function listarDirecciones(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string): Promise<Direccion[]> {
  return tx
    .select()
    .from(clienteDirecciones)
    .where(and(eq(clienteDirecciones.tenantId, ctx.empresaId), eq(clienteDirecciones.clienteId, clienteId)))
    .orderBy(asc(clienteDirecciones.tipo), desc(clienteDirecciones.esPrincipal), asc(clienteDirecciones.id));
}

type DatosDeDireccion = Pick<Direccion, 'tipo' | 'direccion' | 'ciudad' | 'departamento' | 'referencia'> & { esPrincipal: boolean };

/** Una sola principal por cliente y tipo: marcar una desmarca la anterior del mismo tipo. */
export async function guardarDireccion(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string, id: string | undefined, d: DatosDeDireccion): Promise<Direccion | null> {
  if (d.esPrincipal) {
    await tx
      .update(clienteDirecciones)
      .set({ esPrincipal: false, actualizadoEn: sql`now()` })
      .where(
        and(
          eq(clienteDirecciones.tenantId, ctx.empresaId),
          eq(clienteDirecciones.clienteId, clienteId),
          eq(clienteDirecciones.tipo, d.tipo),
          id ? ne(clienteDirecciones.id, id) : sql`true`,
        ),
      );
  }
  if (!id) {
    const [f] = await tx.insert(clienteDirecciones).values({ ...d, tenantId: ctx.empresaId, clienteId, creadoPor: ctx.usuarioId }).returning();
    return f!;
  }
  const [f] = await tx
    .update(clienteDirecciones)
    .set({ ...d, actualizadoEn: sql`now()` })
    .where(and(eq(clienteDirecciones.tenantId, ctx.empresaId), eq(clienteDirecciones.clienteId, clienteId), eq(clienteDirecciones.id, id)))
    .returning();
  return f ?? null;
}

export async function eliminarDireccion(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const r = await tx.delete(clienteDirecciones).where(and(eq(clienteDirecciones.tenantId, ctx.empresaId), eq(clienteDirecciones.id, id))).returning({ id: clienteDirecciones.id });
  return r.length > 0;
}
