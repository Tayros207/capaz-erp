import type { Yo } from '@capaz/shared';

// Lógica pura de las tarjetas de pendientes de /inicio.

export type CodigoDeTarjeta = 'borradores' | 'deudas' | 'entregas' | 'actividades';

/** Módulos a los que esta persona entra viendo todo (alcance `todos`): solo ahí se muestran pendientes. */
export function modulosConAlcanceTotal(yo: Yo): Set<string> {
  return new Set(yo.modulos.filter((m) => m.acceso.puedeEntrar && m.acceso.alcance === 'todos').map((m) => m.codigo));
}

/** Qué tarjetas ve la persona: los borradores piden `borradores:ver`; el resto, el módulo con alcance `todos`. */
export function tarjetasVisibles(yo: Yo): CodigoDeTarjeta[] {
  const modulos = modulosConAlcanceTotal(yo);
  const tarjetas: CodigoDeTarjeta[] = [];
  if (yo.permisos.includes('borradores:ver')) tarjetas.push('borradores');
  if (modulos.has('registro')) tarjetas.push('deudas');
  if (modulos.has('ordenes')) tarjetas.push('entregas');
  if (modulos.has('crm')) tarjetas.push('actividades');
  return tarjetas;
}

/** Fecha `AAAA-MM-DD` de un instante en una zona horaria. */
export function fechaEnZona(ahora: Date, zona: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Primer y último día del mes de una fecha `AAAA-MM-DD`. */
export function rangoDelMes(fecha: string): { desde: string; hasta: string } {
  const [anio = 0, mes = 1] = fecha.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const m = String(mes).padStart(2, '0');
  return { desde: `${anio}-${m}-01`, hasta: `${anio}-${m}-${String(ultimo).padStart(2, '0')}` };
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export const textoDeBorradores = (n: number) => (n === 0 ? 'Nada por aprobar' : `${n} ${plural(n, 'borrador por aprobar', 'borradores por aprobar')}`);
export const textoDeDeudasVencidas = (n: number) => (n === 0 ? 'Ninguna vencida' : `${n} ${plural(n, 'deuda vencida', 'deudas vencidas')}`);
export const textoDeActividadesVencidas = (n: number) => (n === 0 ? 'Ninguna vencida' : `${n} ${plural(n, 'actividad vencida', 'actividades vencidas')}`);
