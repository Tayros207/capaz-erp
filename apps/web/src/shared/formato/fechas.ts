// Fechas y horas en es-PE con la zona horaria de la empresa. `Yo` aún no trae la zona: mientras
// tanto la zona es un argumento con Lima por defecto.

export const ZONA_POR_DEFECTO = 'America/Lima';

function partes(valor: Date | string | number, zona: string, opciones: Intl.DateTimeFormatOptions) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const mapa: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('es-PE', { timeZone: zona, ...opciones }).formatToParts(fecha)) {
    mapa[p.type] = p.value;
  }
  return mapa;
}

const FECHA = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
const HORA = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;

/** `14/11/2026`. Una fecha inválida se muestra como «—». */
export function formatearFecha(valor: Date | string | number, zona = ZONA_POR_DEFECTO): string {
  const p = partes(valor, zona, FECHA);
  return p ? `${p.day}/${p.month}/${p.year}` : '—';
}

/** `22:30` (24 horas). */
export function formatearHora(valor: Date | string | number, zona = ZONA_POR_DEFECTO): string {
  const p = partes(valor, zona, HORA);
  return p ? `${p.hour}:${p.minute}` : '—';
}

/** `14/11/2026 22:30`. */
export function formatearFechaHora(valor: Date | string | number, zona = ZONA_POR_DEFECTO): string {
  const fecha = formatearFecha(valor, zona);
  return fecha === '—' ? fecha : `${fecha} ${formatearHora(valor, zona)}`;
}
