import { sql } from 'drizzle-orm';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { diaLocal } from '../automatizaciones/condiciones.js';

// «Hoy» de la empresa: la zona sale de `core.empresa_config` (sin fila, `America/Lima`).

const ZONA_POR_DEFECTO = 'America/Lima';

export type HoyDeLaEmpresa = { zona: string; dia: string; anio: number };

/** Calcula el día y el año locales; `ahora` es inyectable para pruebas. */
export function hoyEnZona(zona: string, ahora: Date = new Date()): HoyDeLaEmpresa {
  const dia = diaLocal(ahora, zona);
  return { zona, dia, anio: Number(dia.slice(0, 4)) };
}

export async function hoyDeLaEmpresa(tx: Transaccion, ahora: Date = new Date()): Promise<HoyDeLaEmpresa> {
  const r = await tx.execute<{ zona_horaria: string }>(sql`select zona_horaria from core.empresa_config limit 1`);
  return hoyEnZona(r.rows[0]?.zona_horaria ?? ZONA_POR_DEFECTO, ahora);
}

/** Mediodía UTC: el día local coincide en cualquier zona entre UTC−11 y UTC+11 (lo usan las fuentes de tiempo). */
export const instanteDeDia = (dia: string): Date => new Date(`${dia}T12:00:00Z`);
