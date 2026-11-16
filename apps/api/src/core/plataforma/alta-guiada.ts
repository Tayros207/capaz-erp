import { rechazo, type Respuesta } from '@capaz/shared';
import type { CatalogoDeModulos } from '../modulos/catalogo.js';
import type { Cliente } from './tipos.js';

// Alta guiada (A6): decide qué módulos recibe una empresa nueva a partir del plan y/o la lista pedida,
// respetando `dependeDe` del catálogo. Todo se valida ANTES de crear la empresa.

type Rechazo = Extract<Respuesta<never>, { ok: false; error: unknown }>;
export type PedidoDeAlta = { plan?: string | undefined; modulos?: { codigo: string; pruebaDias?: number | undefined }[] | undefined };
export type ModuloPlanificado = { codigo: string; pruebaDias: number | null; porDependencia: boolean };
export type PlanDeAlta = { plan: string | null; modulos: ModuloPlanificado[] };

type Catalogo = Pick<CatalogoDeModulos, 'porCodigo' | 'porDefecto'>;

async function modulosDelPlan(db: Cliente, plan: string): Promise<string[] | null> {
  const { rows } = await db.query<{ activo: boolean; modulos: string[] }>(
    `select p.activo, coalesce((select array_agg(pm.modulo order by pm.modulo) from core.plan_modulos pm where pm.plan = p.codigo), '{}') as modulos
       from core.planes p where p.codigo = $1`,
    [plan],
  );
  return rows[0]?.activo ? rows[0].modulos : null;
}

/** Revisa que el módulo exista, no esté en construcción y devuelve su rechazo si no. */
function revisar(catalogo: Catalogo, codigo: string): Rechazo | null {
  const m = catalogo.porCodigo(codigo);
  if (!m || codigo === 'core') return rechazo('argumentos_invalidos', `El módulo «${codigo}» no existe.`);
  if (m.enConstruccion) return rechazo('argumentos_invalidos', `El módulo «${m.nombre}» está en construcción y todavía no se puede dar.`);
  return null;
}

export async function planificarAlta(db: Cliente, catalogo: Catalogo, pedido: PedidoDeAlta): Promise<PlanDeAlta | { rechazo: Rechazo }> {
  const pedidos = new Map<string, number | null>(); // código → días de prueba
  if (pedido.plan) {
    const delPlan = await modulosDelPlan(db, pedido.plan);
    if (!delPlan) return { rechazo: rechazo('argumentos_invalidos', `El plan «${pedido.plan}» no existe o no está activo.`) };
    for (const c of delPlan) pedidos.set(c, null);
  }
  for (const m of pedido.modulos ?? []) pedidos.set(m.codigo, m.pruebaDias ?? null);
  if (!pedido.plan && !pedido.modulos?.length) for (const m of catalogo.porDefecto()) pedidos.set(m.codigo, m.porDefecto.pruebaDias);

  const planificados = new Map<string, ModuloPlanificado>();
  const agregar = (codigo: string, pruebaDias: number | null, porDependencia: boolean): Rechazo | null => {
    if (planificados.has(codigo)) return null;
    const malo = revisar(catalogo, codigo);
    if (malo) return malo;
    // Primero lo que necesita (la base exige la dependencia ya dada), después el módulo.
    for (const dep of catalogo.porCodigo(codigo)!.dependeDe) {
      const r = agregar(dep, pruebaDias, !pedidos.has(dep));
      if (r) return r;
    }
    planificados.set(codigo, { codigo, pruebaDias, porDependencia });
    return null;
  };
  for (const [codigo, dias] of pedidos) {
    const r = agregar(codigo, dias, false);
    if (r) return { rechazo: r };
  }
  return { plan: pedido.plan ?? null, modulos: [...planificados.values()] };
}
