import type pg from 'pg';
import type { Azar } from './azar.ts';
import type { Sesion } from './http.ts';
import type { Sector } from './sectores.ts';

/** Lo que comparten todas las secciones de la siembra de UNA empresa. */
export type Ctx = {
  s: Sesion; // sesión del dueño de la empresa, con la empresa activa
  sec: Sector;
  empresaId: string;
  az: Azar;
  db: pg.Client; // superusuario local: solo para contar filas (idempotencia) y resumir
  estados: Map<string, string>; // módulo → estado de contratación
  sucursales: any[];
  productos: any[];
  clientes: any[]; // tipo cliente o ambos
  proveedores: any[]; // tipo proveedor o ambos
  log: (m: string) => void;
};

export const escribible = (c: Ctx, modulo: string): boolean => ['activo', 'prueba'].includes(c.estados.get(modulo) ?? '');

/** Filas de una tabla para la empresa (con el superusuario: la RLS no estorba en un conteo de verificación). */
export async function contar(c: Ctx, tabla: string): Promise<number> {
  const { rows } = await c.db.query<{ n: string }>(`select count(*) n from ${tabla} where tenant_id = $1`, [c.empresaId]);
  return Number(rows[0]!.n);
}

/** Suma `dias` a una fecha `AAAA-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(fecha) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** La fecha más reciente que se permite: ayer (todo lo sembrado es pasado). */
export const AYER = (): string => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
export const minFecha = (a: string, b: string): string => (a < b ? a : b);

/** Céntimos redondeados a múltiplos de 10 (un monto «de persona»). */
export const centimos = (soles: number): number => Math.max(100, Math.round(soles * 10) * 10);

/** Corre una sección sin que su fallo detenga las demás; deja el motivo en el informe. */
export async function seccion(c: Ctx, nombre: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    c.log(`  ⚠ ${nombre}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
