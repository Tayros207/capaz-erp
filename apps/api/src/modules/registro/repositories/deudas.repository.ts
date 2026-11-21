import { and, desc, eq, inArray, isNotNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { registroDeudas } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorInstante, type CursorPorInstante } from '../domain/cursor.js';

// Repositorio de cuentas por cobrar y por pagar. Una deuda no se borra (la base lo impide): se anula.
// `propietario`: con alcance «propios», el usuario dueño de las filas.

export type Deuda = typeof registroDeudas.$inferSelect;
export type DeudaConContacto = Deuda & { contactoNombre: string };

export type DatosDeDeuda = {
  numero: number;
  anio: number;
  tipo: 'por_cobrar' | 'por_pagar';
  contactoId: string;
  concepto: string;
  totalCentimos: number;
  fecha: string;
  venceEn: string | null;
  sucursalId: string | null;
  notas: string | null;
  origenTipo: string | null;
  origenId: string | null;
  /** Datos sueltos de la deuda; hoy `{ fijo: true, dia }` (pago fijo de cada mes y el día del mes en que vence, para no desplazarlo en meses cortos). */
  datosExtra?: { fijo: boolean; dia?: number };
};

export type FiltrosDeDeudas = {
  limite: number;
  cursor: CursorPorInstante | null;
  tipo: string;
  estado: 'abiertas' | 'vencidas' | 'pagadas' | 'anuladas' | 'todas';
  contactoId?: string;
  origenTipo?: string;
  origenId?: string;
  /** Día de hoy de la empresa: decide cuáles están vencidas. */
  hoy: string;
};

const d = registroDeudas;
const ABIERTAS = ['pendiente', 'parcial'];
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(d.tenantId, ctx.empresaId);
const delPropietario = (propietario: string | null): SQL | undefined => (propietario === null ? undefined : eq(d.creadoPor, propietario));

function conContacto(tx: Transaccion) {
  return tx
    .select({ fila: d, contactoNombre: clientes.nombre, instante: sql<string>`${d.creadoEn}::text` })
    .from(d)
    .innerJoin(clientes, and(eq(clientes.tenantId, d.tenantId), eq(clientes.id, d.contactoId)));
}

/** `null` si el documento de origen ya tiene una deuda viva (índice único parcial). */
export async function insertarDeuda(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeDeuda): Promise<string | null> {
  const [fila] = await tx
    .insert(d)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning({ id: d.id });
  return fila?.id ?? null;
}

/** La deuda viva (no anulada) que nació de ese documento de otro módulo. */
export async function deudaVivaPorOrigen(tx: Transaccion, ctx: ContextoDeEmpresa, origenTipo: string, origenId: string): Promise<Deuda | null> {
  const [fila] = await tx
    .select()
    .from(d)
    .where(and(deEmpresa(ctx), eq(d.origenTipo, origenTipo), eq(d.origenId, origenId), ne(d.estado, 'anulada')));
  return fila ?? null;
}

export async function verDeuda(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propietario: string | null): Promise<DeudaConContacto | null> {
  const [f] = await conContacto(tx).where(and(deEmpresa(ctx), eq(d.id, id), delPropietario(propietario)));
  return f ? { ...f.fila, contactoNombre: f.contactoNombre } : null;
}

/** Toma la deuda con `for update` ANTES de leer su saldo: dos abonos a la vez se turnan y ninguno cobra de más. */
export async function bloquearDeuda(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propietario: string | null): Promise<Deuda | null> {
  const [fila] = await tx
    .select()
    .from(d)
    .where(and(deEmpresa(ctx), eq(d.id, id), delPropietario(propietario)))
    .for('update');
  return fila ?? null;
}

function filtroDeEstado(f: FiltrosDeDeudas): SQL | undefined {
  if (f.estado === 'abiertas') return inArray(d.estado, ABIERTAS);
  if (f.estado === 'vencidas') return and(inArray(d.estado, ABIERTAS), isNotNull(d.venceEn), lt(d.venceEn, f.hoy));
  if (f.estado === 'pagadas') return eq(d.estado, 'pagada');
  if (f.estado === 'anuladas') return eq(d.estado, 'anulada');
  return undefined;
}

/** Orden `(creado_en, id)` descendente; el instante del cursor viaja como texto de PostgreSQL. */
export async function listarDeudas(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  f: FiltrosDeDeudas,
  propietario: string | null,
): Promise<{ items: DeudaConContacto[]; siguiente: string | null }> {
  const donde: (SQL | undefined)[] = [
    deEmpresa(ctx),
    delPropietario(propietario),
    eq(d.tipo, f.tipo),
    filtroDeEstado(f),
    f.contactoId ? eq(d.contactoId, f.contactoId) : undefined,
    f.origenTipo && f.origenId ? and(eq(d.origenTipo, f.origenTipo), eq(d.origenId, f.origenId)) : undefined,
    f.cursor ? sql`(${d.creadoEn}, ${d.id}) < (${f.cursor.instante}::timestamptz, ${f.cursor.id}::uuid)` : undefined,
  ];
  const filas = await conContacto(tx)
    .where(and(...donde))
    .orderBy(desc(d.creadoEn), desc(d.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return {
    items: pagina.map((x) => ({ ...x.fila, contactoNombre: x.contactoNombre })),
    siguiente: filas.length > f.limite && ultima ? codificarCursorPorInstante({ instante: ultima.instante, id: ultima.fila.id }) : null,
  };
}

/** Guarda lo abonado y el estado que calculó el dominio. La deuda debe estar bloqueada por quien llama. */
export async function guardarAbonado(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, abonadoCentimos: number, estado: string): Promise<void> {
  const filas = await tx
    .update(d)
    .set({ abonadoCentimos, estado })
    .where(and(deEmpresa(ctx), eq(d.id, id)))
    .returning({ id: d.id });
  if (filas.length !== 1) throw new Error('No se pudo actualizar el saldo de la deuda.');
}

export async function editarDeuda(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  id: string,
  cambios: Partial<Pick<Deuda, 'concepto' | 'venceEn' | 'notas'>> & { fijo?: boolean; dia?: number },
): Promise<void> {
  const { fijo, dia, ...columnas } = cambios;
  const extra = { ...(fijo !== undefined && { fijo }), ...(dia !== undefined && { dia }) };
  const datosExtra = Object.keys(extra).length === 0 ? {} : { datosExtra: sql`${d.datosExtra} || ${JSON.stringify(extra)}::jsonb` };
  await tx.update(d).set({ ...columnas, ...datosExtra }).where(and(deEmpresa(ctx), eq(d.id, id)));
}

/** Anula una deuda sin abonos. `false` si ya estaba anulada o tiene algo abonado (la condición va también en el `where`). */
export async function anularDeuda(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, motivo: string): Promise<boolean> {
  const filas = await tx
    .update(d)
    .set({ estado: 'anulada', anuladoEn: sql`now()`, anuladoPor: ctx.usuarioId, motivoAnulacion: motivo })
    .where(and(deEmpresa(ctx), eq(d.id, id), ne(d.estado, 'anulada'), eq(d.abonadoCentimos, 0)))
    .returning({ id: d.id });
  return filas.length === 1;
}
