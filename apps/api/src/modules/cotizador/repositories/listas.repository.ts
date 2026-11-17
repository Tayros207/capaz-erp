import { and, asc, eq, isNotNull, isNull, like, ne, sql, type SQL } from 'drizzle-orm';
import { productos } from '../../../db/esquema/core-maestros.js';
import { cotizadorListasDePrecio } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorDeLista, type CursorDeLista } from '../domain/cursor.js';

// Repositorio de listas de precio. Recibe la transacción de `conEmpresa`: la RLS aísla y el `where` por empresa es
// defensa en profundidad. Un choque de nombre se devuelve, no se lanza.

const l = cotizadorListasDePrecio;
export type ListaDePrecio = typeof l.$inferSelect;
export type DatosDeLista = {
  nombre: string;
  nombreNormalizado: string;
  unidad: string;
  productoId: string | null;
  p100Centimos: number;
  p1000Centimos: number;
  p5000Centimos: number;
  modoIntermedio: string;
  precioMinimoCentimos: number | null;
  aConfirmado: boolean;
};
export type CambiosDeLista = Partial<DatosDeLista> & { preciosFijadosEn?: Date };
export type FiltrosDeListas = {
  buscar?: string;
  estado: 'activas' | 'archivadas' | 'todas';
  /** Día (`AAAA-MM-DD`, zona de la empresa) anterior al cual los precios están por revisar; solo con `soloPorRevisar`. */
  porRevisarAntesDe: string | null;
  zona: string;
  cursor: CursorDeLista | null;
  limite: number;
};

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(l.tenantId, ctx.empresaId);
/** Los comodines de `like` que escribió la persona no valen. */
const sinComodines = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listarListas(tx: Transaccion, ctx: ContextoDeEmpresa, f: FiltrosDeListas): Promise<{ items: ListaDePrecio[]; siguiente: string | null }> {
  const donde: (SQL | undefined)[] = [
    deEmpresa(ctx),
    f.estado === 'activas' ? isNull(l.archivadoEn) : f.estado === 'archivadas' ? isNotNull(l.archivadoEn) : undefined,
    f.buscar ? like(l.nombreNormalizado, `%${sinComodines(f.buscar)}%`) : undefined,
    f.porRevisarAntesDe ? sql`(${l.preciosFijadosEn} at time zone ${f.zona})::date < ${f.porRevisarAntesDe}::date` : undefined,
    f.cursor ? sql`(${l.nombreNormalizado}, ${l.id}) > (${f.cursor.nombreNormalizado}, ${f.cursor.id}::uuid)` : undefined,
  ];
  const filas = await tx
    .select()
    .from(l)
    .where(and(...donde))
    .orderBy(asc(l.nombreNormalizado), asc(l.id))
    .limit(f.limite + 1);
  const items = filas.slice(0, f.limite);
  const ultima = items.at(-1);
  return { items, siguiente: filas.length > f.limite && ultima ? codificarCursorDeLista({ nombreNormalizado: ultima.nombreNormalizado, id: ultima.id }) : null };
}

export async function verLista(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<ListaDePrecio | null> {
  const [fila] = await tx.select().from(l).where(and(deEmpresa(ctx), eq(l.id, id)));
  return fila ?? null;
}

/** La lista activa que ya usa ese nombre (normalizado), salvo `salvo`. */
export async function listaActivaConNombre(tx: Transaccion, ctx: ContextoDeEmpresa, nombreNormalizado: string, salvo?: string): Promise<ListaDePrecio | null> {
  const filtros: SQL[] = [deEmpresa(ctx), eq(l.nombreNormalizado, nombreNormalizado), isNull(l.archivadoEn)];
  if (salvo) filtros.push(ne(l.id, salvo));
  const [fila] = await tx.select().from(l).where(and(...filtros));
  return fila ?? null;
}

export async function existeProductoVivo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx.select({ id: productos.id }).from(productos).where(and(eq(productos.tenantId, ctx.empresaId), eq(productos.id, id), isNull(productos.archivadoEn)));
  return fila !== undefined;
}

export async function crearLista(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  datos: DatosDeLista,
): Promise<{ creada: true; lista: ListaDePrecio } | { creada: false; existente: ListaDePrecio }> {
  const [fila] = await tx
    .insert(l)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  if (fila) return { creada: true, lista: fila };
  const existente = await listaActivaConNombre(tx, ctx, datos.nombreNormalizado);
  if (!existente) throw new Error('Conflicto de unicidad de listas sin fila que lo explique.');
  return { creada: false, existente };
}

/** La fila se bloquea (`for update`) para que la confirmación y el cambio vean el mismo estado. */
export async function bloquearLista(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<ListaDePrecio | null> {
  const [fila] = await tx.select().from(l).where(and(deEmpresa(ctx), eq(l.id, id))).for('update');
  return fila ?? null;
}

export async function editarLista(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: CambiosDeLista): Promise<ListaDePrecio> {
  const [fila] = await tx
    .update(l)
    .set({ ...cambios, actualizadoEn: new Date() })
    .where(and(deEmpresa(ctx), eq(l.id, id)))
    .returning();
  if (!fila) throw new Error('La lista editada no existe.');
  return fila;
}

/** Archiva (idempotente): una lista ya archivada se devuelve tal cual. */
export async function archivarLista(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<ListaDePrecio | null> {
  const [fila] = await tx
    .update(l)
    .set({ archivadoEn: new Date(), actualizadoEn: new Date() })
    .where(and(deEmpresa(ctx), eq(l.id, id), isNull(l.archivadoEn)))
    .returning();
  return fila ?? (await verLista(tx, ctx, id));
}
