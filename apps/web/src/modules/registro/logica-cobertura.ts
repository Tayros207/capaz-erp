import { formatearSoles, type CoberturaDelMesDto } from '@capaz/shared';

// Texto de la cobertura del mes (todas las deudas por pagar con vencimiento ese mes). Lógica pura, sin React.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** `2026-11` → «noviembre»; si el texto no es un mes válido, se devuelve tal cual. */
export function nombreDelMes(mes: string): string {
  const m = /^\d{4}-(\d{2})$/.exec(mes);
  return (m ? MESES[Number(m[1]) - 1] : undefined) ?? mes;
}

/** Días que quedan del mes contando desde mañana (el último día del mes, `hasta`, menos hoy); nunca negativo. */
export function diasQueQuedan(hoy: string, hasta: string): number {
  const a = Date.parse(`${hoy}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** «Pagos de noviembre: llevas S/ 500.00 de S/ 1,000.00 (50 %). Faltan S/ 500.00 y quedan 10 días.» */
export function textoDeCobertura(c: CoberturaDelMesDto, hoy: string): string {
  const base = `Pagos de ${nombreDelMes(c.mes)}: llevas ${formatearSoles(c.ingresosCentimos)} de ${formatearSoles(c.compromisosCentimos)} (${c.porcentaje ?? 0} %).`;
  const n = diasQueQuedan(hoy, c.hasta);
  const dias = n === 0 ? 'hoy es el último día del mes' : n === 1 ? 'queda 1 día' : `quedan ${n} días`;
  return c.faltaCentimos > 0 ? `${base} Faltan ${formatearSoles(c.faltaCentimos)} y ${dias}.` : `${base} Ya cubriste lo comprometido y ${dias}.`;
}
