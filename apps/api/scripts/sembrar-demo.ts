import { plataforma, type Urls } from './plataforma.ts';
import { crearAzar } from './demo/azar.ts';
import { sembrarCrm } from './demo/crm.ts';
import { escribible, type Ctx } from './demo/contexto.ts';
import { CLAVE_DEMO, CORREO_DEMO, conAdmin, leerEntorno, soltarLimiteDeAcceso, type Entorno } from './demo/entorno.ts';
import { sembrarFinanzas } from './demo/finanzas.ts';
import { Sesion } from './demo/http.ts';
import { sembrarCompras, sembrarInsumos } from './demo/inventario.ts';
import { limpiar } from './demo/limpiar.ts';
import { sembrarMaestros } from './demo/maestros.ts';
import { sembrarPedidos } from './demo/pedidos.ts';
import { sembrarBorradores, sembrarPersonal } from './demo/personal.ts';
import { resumir } from './demo/resumen.ts';
import { SECTORES, type Sector } from './demo/sectores.ts';
import { correoDe, sembrarUsuarios } from './demo/usuarios.ts';

// `pnpm --filter api db:sembrar-demo [--limpiar | --resumen]`: siembra cinco empresas de demostración
// por la API real (herramientas, permisos, auditoría, correlativos y RLS incluidos). SOLO base local.
// Requiere la API local en marcha (`pnpm --filter api start`) y `ALTA_DE_EMPRESAS=abierta`. Ver docs/DATOS-DE-PRUEBA.md.

const ORDEN_DE_MODULOS = ['registro', 'crm', 'ordenes', 'insumos', 'compras', 'personal', 'reportes'];
const log = (m: string): void => console.log(m);

async function estadosDe(e: Entorno, empresaId: string): Promise<Map<string, string>> {
  return conAdmin(e, async (c) => {
    const { rows } = await c.query<{ modulo: string; estado: string }>('select modulo, estado from core.empresa_modulos where tenant_id = $1', [empresaId]);
    return new Map(rows.map((r) => [r.modulo, r.estado]));
  });
}

/** Activa los módulos de la empresa por la vía oficial de plataforma (`core.activar_modulo`). */
async function contratarModulos(e: Entorno, sec: Sector, empresaId: string): Promise<void> {
  const urls: Urls = e.urls;
  let estados = await estadosDe(e, empresaId);
  for (const modulo of ORDEN_DE_MODULOS.filter((m) => m in sec.modulos)) {
    const quiere = sec.modulos[modulo]!;
    const actual = estados.get(modulo);
    const falta = actual === undefined || (actual === 'prueba' && !quiere.prueba);
    if (!falta) continue;
    await plataforma('activar', { empresa: empresaId, modulo, ...(quiere.prueba ? { 'prueba-dias': String(quiere.prueba) } : {}) }, urls);
    estados = await estadosDe(e, empresaId);
  }
}

async function dejarEstadosFinales(e: Entorno, sec: Sector, empresaId: string): Promise<void> {
  const estados = await estadosDe(e, empresaId);
  for (const [modulo, def] of Object.entries(sec.modulos)) {
    if (!def.despues || estados.get(modulo) !== 'activo') continue;
    const motivo = def.despues === 'suspendido' ? 'Demostración: pausa por falta de pago' : 'Demostración: el cliente dejó el módulo';
    await plataforma(def.despues === 'baja' ? 'baja' : 'suspender', { empresa: empresaId, modulo, motivo }, e.urls);
  }
}

async function sembrarEmpresa(e: Entorno, sec: Sector, indice: number): Promise<void> {
  log(`\n▶ ${sec.nombre} (${sec.rubro})`);
  const dueno = sec.usuarios.find((u) => u.rol === 'owner')!;
  const s = new Sesion(e.api, e.origen, () => soltarLimiteDeAcceso(e));
  await s.entrar(dueno.nombre, correoDe(dueno.clave, sec.clave), CLAVE_DEMO);
  const yo = await s.yo();
  let empresaId: string | undefined = yo?.empresas?.find((x: any) => x.nombre === sec.nombre)?.id;
  if (!empresaId) empresaId = await s.crearEmpresa(sec.nombre);
  await s.activarEmpresa(empresaId);
  await contratarModulos(e, sec, empresaId);

  await conAdmin(e, async (db) => {
    const ctx: Ctx = { s, sec, empresaId: empresaId!, az: crearAzar(20261116 + indice * 7919), db, estados: await estadosDe(e, empresaId!), sucursales: [], productos: [], clientes: [], proveedores: [], log };
    await sembrarMaestros(ctx);
    log(`  maestros: ${ctx.productos.length} productos, ${ctx.clientes.length} clientes, ${ctx.proveedores.length} proveedores, ${ctx.sucursales.length} sucursales`);
    if (ctx.clientes.length === 0 || ctx.productos.length === 0) return log('  ⚠ sin maestros: se omiten los módulos.');
    for (const paso of [sembrarFinanzas, sembrarCrm, sembrarPedidos, sembrarInsumos, sembrarCompras, sembrarPersonal, sembrarBorradores]) await paso(ctx);
    await sembrarUsuarios(ctx, e);
    log(`  listo (${[...ctx.estados].filter(([m]) => escribible(ctx, m)).length} módulos con escritura)`);
  });
  await dejarEstadosFinales(e, sec, empresaId);
}

async function sembrarOperador(e: Entorno): Promise<void> {
  const correo = `operador${CORREO_DEMO}`;
  await new Sesion(e.api, e.origen, () => soltarLimiteDeAcceso(e)).entrar('Operador de Plataforma Demo', correo, CLAVE_DEMO);
  await plataforma('admin', { correo }, e.urls);
  log(`\n▶ Operador de plataforma: ${correo}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const e = leerEntorno();
  if (args.includes('--limpiar')) return limpiar(e, log);
  if (args.includes('--resumen')) return resumir(e, log);
  const salud = await fetch(`${e.api}/api/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`La API local no responde en ${e.api}. Arráncala: pnpm --filter api build && pnpm --filter api start.`);
  for (const [i, sec] of SECTORES.entries()) await sembrarEmpresa(e, sec, i);
  await sembrarOperador(e);
  await resumir(e, log);
  log(`\nCuentas demo: <rol>.<empresa>${CORREO_DEMO} · contraseña ${CLAVE_DEMO} (ver docs/DATOS-DE-PRUEBA.md).`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
