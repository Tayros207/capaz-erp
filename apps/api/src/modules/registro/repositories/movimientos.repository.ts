import { and, asc, count, desc, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { registroCategorias, registroCuentas, registroMovimientos } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorFecha, type CursorPorFecha } from '../domain/cursor.js';

// Repositorio de movimientos de dinero. Un movimiento no se edita ni se borra: se anula (la base solo deja
// cambiar las columnas de anulación). `propietario`: con alcance «propios», el usuario dueño de las filas.

export type Movimiento = typeof registroMovimientos.$inferSelect;
export type MovimientoConNombres = Movimiento & { cuentaNombre: string; categoriaNombre: string | null; contactoNombre: string | null };

export type DatosDeMovimiento = {
  numero: number;
  anio: number;
  tipo: 'ingreso' | 'egreso';
  fecha: string;
  montoCentimos: number;
  cuentaId: string;
  categoriaId: string | null;
  contactoId: string | null;
  medioDePago: string;
  descripcion: string | null;
  deudaId: string | null;
  sucursalId: string | null;
  origen: string;
  origenRef: string | null;
};

export type FiltrosDeMovimientos = {
  limite: number;
  cursor: CursorPorFecha | null;
  desde?: string;
  hasta?: string;
  tipo?: string;
  cuentaId?: string;
  categoriaId?: string;
  contactoId?: string;
  deudaId?: string;
  estado: 'activos' | 'anulados' | 'todos';
};

const m = registroMovimientos;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(m.tenantId, ctx.empresaId);
const delPropietario = (propietario: string | null): SQL | undefined => (propietario === null ? undefined : eq(m.creadoPor, propietario));

/** El movimiento con los nombres de su cuenta, categoría y contacto (uniones siempre dentro de la misma empresa). */
function conNombres(tx: Transaccion) {
  return tx
    .select({ fila: m, cuentaNombre: registroCuentas.nombre, categoriaNombre: registroCategorias.nombre, contactoNombre: clientes.nombre })
    .from(m)
    .innerJoin(registroCuentas, and(eq(registroCuentas.tenantId, m.tenantId), eq(registroCuentas.id, m.cuentaId)))
    .leftJoin(registroCategorias, and(eq(registroCategorias.tenantId, m.tenantId), eq(registroCategorias.id, m.categoriaId)))
    .leftJoin(clientes, and(eq(clientes.tenantId, m.tenantId), eq(clientes.id, m.contactoId)));
}
type FilaConNombres = { fila: Movimiento; cuentaNombre: string; categoriaNombre: string | null; contactoNombre: string | null };
const aplanar = (f: FilaConNombres): MovimientoConNombres => ({ ...f.fila, cuentaNombre: f.cuentaNombre, categoriaNombre: f.categoriaNombre, contactoNombre: f.contactoNombre });

export async function insertarMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeMovimiento): Promise<string> {
  const [fila] = await tx
    .insert(m)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .returning({ id: m.id });
  if (!fila) throw new Error('No se pudo guardar el movimiento.');
  return fila.id;
}

export async function verMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propietario: string | null): Promise<MovimientoConNombres | null> {
  const [fila] = await conNombres(tx).where(and(deEmpresa(ctx), eq(m.id, id), delPropietario(propietario)));
  return fila ? aplanar(fila) : null;
}

/** Orden `(fecha, id)` descendente. `limite` ya viene validado (1 a 100). */
export async function listarMovimientos(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  f: FiltrosDeMovimientos,
  propietario: string | null,
): Promise<{ items: MovimientoConNombres[]; siguiente: string | null }> {
  const donde: (SQL | undefined)[] = [
    deEmpresa(ctx),
    delPropietario(propietario),
    f.desde ? gte(m.fecha, f.desde) : undefined,
    f.hasta ? lte(m.fecha, f.hasta) : undefined,
    f.tipo ? eq(m.tipo, f.tipo) : undefined,
    f.cuentaId ? eq(m.cuentaId, f.cuentaId) : undefined,
    f.categoriaId ? eq(m.categoriaId, f.categoriaId) : undefined,
    f.contactoId ? eq(m.contactoId, f.contactoId) : undefined,
    f.deudaId ? eq(m.deudaId, f.deudaId) : undefined,
    f.estado === 'activos' ? eq(m.estado, 'activo') : f.estado === 'anulados' ? eq(m.estado, 'anulado') : undefined,
    f.cursor ? sql`(${m.fecha}, ${m.id}) < (${f.cursor.fecha}::date, ${f.cursor.id}::uuid)` : undefined,
  ];
  const filas = await conNombres(tx)
    .where(and(...donde))
    .orderBy(desc(m.fecha), desc(m.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite).map(aplanar);
  const ultima = pagina.at(-1);
  return { items: pagina, siguiente: filas.length > f.limite && ultima ? codificarCursorPorFecha({ fecha: ultima.fecha, id: ultima.id }) : null };
}

/** Los abonos de una deuda (vivos y anulados), del más antiguo al más reciente. */
export async function abonosDeDeuda(tx: Transaccion, ctx: ContextoDeEmpresa, deudaId: string): Promise<MovimientoConNombres[]> {
  const filas = await conNombres(tx)
    .where(and(deEmpresa(ctx), eq(m.deudaId, deudaId)))
    .orderBy(asc(m.fecha), asc(m.id));
  return filas.map(aplanar);
}

export async function contarAbonosVivos(tx: Transaccion, ctx: ContextoDeEmpresa, deudaId: string): Promise<number> {
  const [fila] = await tx
    .select({ n: count() })
    .from(m)
    .where(and(deEmpresa(ctx), eq(m.deudaId, deudaId), eq(m.estado, 'activo')));
  return fila?.n ?? 0;
}

/** Toma la fila con `for update` para que dos anulaciones a la vez se turnen. `null` si no existe o no es suya. */
export async function bloquearMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propietario: string | null): Promise<Movimiento | null> {
  const [fila] = await tx
    .select()
    .from(m)
    .where(and(deEmpresa(ctx), eq(m.id, id), delPropietario(propietario)))
    .for('update');
  return fila ?? null;
}

/** Marca como anulado un movimiento activo. `false` si ya no estaba activo. */
export async function anularMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, motivo: string): Promise<boolean> {
  const filas = await tx
    .update(m)
    .set({ estado: 'anulado', anuladoEn: sql`now()`, anuladoPor: ctx.usuarioId, motivoAnulacion: motivo })
    .where(and(deEmpresa(ctx), eq(m.id, id), eq(m.estado, 'activo')))
    .returning({ id: m.id });
  return filas.length === 1;
}

/** El contacto existe en esta empresa y no fue fusionado en otro. */
export async function existeContacto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, id), isNull(clientes.fusionadoEn)));
  return fila !== undefined;
}
