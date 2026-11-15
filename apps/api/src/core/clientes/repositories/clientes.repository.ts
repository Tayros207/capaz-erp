import { and, asc, getTableColumns, eq, gt, ilike, isNull, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { DatosDeCliente } from '../domain/cliente.js';
import { codificarCursor, decodificarCursor } from '../domain/cursor.js';

// Repositorio de clientes: recibe la transacción de `conEmpresa` (RLS aísla; el `where` por empresa es defensa en profundidad).

export type Cliente = typeof clientes.$inferSelect;
export type Pagina<T> = { items: T[]; siguiente: string | null };
export type EstadoDeListado = 'activos' | 'archivados' | 'todos';

export type ResultadoDeCrear =
  | { creado: true; cliente: Cliente }
  | { creado: false; conflicto: 'nombre' | 'documento'; existente: Cliente };

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(clientes.tenantId, ctx.empresaId);

export async function crearCliente(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeCliente): Promise<ResultadoDeCrear> {
  const [fila] = await tx
    .insert(clientes)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  if (fila) return { creado: true, cliente: fila };
  const porNombre = await tx
    .select()
    .from(clientes)
    .where(and(deEmpresa(ctx), eq(clientes.nombreNormalizado, datos.nombreNormalizado), isNull(clientes.fusionadoEn)));
  if (porNombre[0]) return { creado: false, conflicto: 'nombre', existente: porNombre[0] };
  const porDocumento = await tx
    .select()
    .from(clientes)
    .where(and(deEmpresa(ctx), eq(clientes.documentoTipo, datos.documentoTipo!), eq(clientes.documentoNumero, datos.documentoNumero!), isNull(clientes.fusionadoEn)));
  if (!porDocumento[0]) throw new Error('Conflicto de unicidad de clientes sin fila que lo explique.');
  return { creado: false, conflicto: 'documento', existente: porDocumento[0] };
}

export async function verCliente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Cliente | null> {
  const [fila] = await tx.select().from(clientes).where(and(deEmpresa(ctx), eq(clientes.id, id)));
  return fila ?? null;
}

/** Reemplaza los datos editables. `null` si no existe. Un choque de nombre o documento lo devuelve como conflicto. */
export async function editarCliente(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  id: string,
  datos: DatosDeCliente,
): Promise<{ cliente: Cliente } | { conflicto: 'nombre' | 'documento'; existente: Cliente } | null> {
  const actual = await verCliente(tx, ctx, id);
  if (!actual) return null;
  const choque = await buscarChoque(tx, ctx, datos, id);
  if (choque) return choque;
  const [fila] = await tx
    .update(clientes)
    .set({ ...datos, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(clientes.id, id)))
    .returning();
  return { cliente: fila! };
}

async function buscarChoque(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeCliente, propio: string) {
  const sinMi = and(deEmpresa(ctx), isNull(clientes.fusionadoEn), sql`${clientes.id} <> ${propio}`);
  const [porNombre] = await tx.select().from(clientes).where(and(sinMi, eq(clientes.nombreNormalizado, datos.nombreNormalizado)));
  if (porNombre) return { conflicto: 'nombre' as const, existente: porNombre };
  if (!datos.documentoNumero) return null;
  const [porDoc] = await tx
    .select()
    .from(clientes)
    .where(and(sinMi, eq(clientes.documentoTipo, datos.documentoTipo!), eq(clientes.documentoNumero, datos.documentoNumero)));
  return porDoc ? { conflicto: 'documento' as const, existente: porDoc } : null;
}

/** Listado por nombre con cursor. Los fusionados no se listan. `limite` ya viene validado (1 a 100). */
export async function listarClientes(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  opciones: { limite: number; cursor?: string; estado?: EstadoDeListado },
): Promise<Pagina<Cliente> | 'cursor_invalido'> {
  const filtros: SQL[] = [deEmpresa(ctx), isNull(clientes.fusionadoEn)];
  const estado = opciones.estado ?? 'activos';
  if (estado === 'activos') filtros.push(isNull(clientes.archivadoEn));
  if (estado === 'archivados') filtros.push(isNotNull(clientes.archivadoEn));
  if (opciones.cursor) {
    const pos = decodificarCursor(opciones.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(gt(clientes.nombreNormalizado, pos.nombre), and(eq(clientes.nombreNormalizado, pos.nombre), gt(clientes.id, pos.id)))!);
  }
  const filas = await tx
    .select()
    .from(clientes)
    .where(and(...filtros))
    .orderBy(asc(clientes.nombreNormalizado), asc(clientes.id))
    .limit(opciones.limite + 1);
  const hayMas = filas.length > opciones.limite;
  const items = hayMas ? filas.slice(0, opciones.limite) : filas;
  const ultimo = items.at(-1);
  return { items, siguiente: hayMas && ultimo ? codificarCursor({ nombre: ultimo.nombreNormalizado, id: ultimo.id }) : null };
}

/** Mejores candidatos por parecido del nombre (`pg_trgm`) o por contener el texto. Solo activos. */
export async function buscarClientes(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  textoNormalizado: string,
  limite: number,
): Promise<Array<Cliente & { parecido: number }>> {
  const parecido = sql<number>`similarity(${clientes.nombreNormalizado}, ${textoNormalizado}::text)`;
  const contiene = ilike(clientes.nombreNormalizado, `%${textoNormalizado.replace(/[\\%_]/g, '\\$&')}%`);
  return tx
    .select({ ...getTableColumns(clientes), parecido })
    .from(clientes)
    .where(and(deEmpresa(ctx), isNull(clientes.archivadoEn), isNull(clientes.fusionadoEn), or(sql`${clientes.nombreNormalizado} % ${textoNormalizado}::text`, contiene)))
    .orderBy(sql`${parecido} desc`, asc(clientes.nombreNormalizado))
    .limit(limite);
}

/** Archiva (idempotente). `null` si no existe. */
export async function archivarCliente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Cliente | null> {
  const [fila] = await tx
    .update(clientes)
    .set({ archivadoEn: sql`coalesce(${clientes.archivadoEn}, now())`, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(clientes.id, id)))
    .returning();
  return fila ?? null;
}

/** Restaura (idempotente). `null` si no existe. */
export async function restaurarCliente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Cliente | null> {
  const [fila] = await tx
    .update(clientes)
    .set({ archivadoEn: null, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(clientes.id, id)))
    .returning();
  return fila ?? null;
}
