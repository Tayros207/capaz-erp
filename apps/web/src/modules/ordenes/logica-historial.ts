import { formatearSoles } from '@capaz/shared';

// Lógica pura de la pantalla «Importar historial»: validación de la fecha de corte y textos del resumen.

export type LecturaDeHistorial = {
  total: number;
  omitidasPorFecha: number;
  erroresTotal: number;
  duplicadasTotal: number;
  clientesPorCrearTotal: number;
  totalCentimos: number;
  primeraFecha: string | null;
  ultimaFecha: string | null;
  nuevas?: number;
  creadas?: number;
  clientesCreados?: number;
};

/** La fecha de corte debe ser un día real escrito AAAA-MM-DD; vacío no vale. */
export function validarCorte(texto: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  if (!m) return 'Escribe la fecha de corte completa.';
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(anio, mes - 1, dia));
  return real.getUTCFullYear() === anio && real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia ? undefined : 'Esa fecha no existe.';
}

/** `2026-03-10` → `10/03/2026`, sin pasar por `Date`. */
export function diaLegible(dia: string | null): string {
  const m = dia ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export const textoDeRango = (l: Pick<LecturaDeHistorial, 'primeraFecha' | 'ultimaFecha'>): string =>
  l.primeraFecha && l.ultimaFecha ? `${diaLegible(l.primeraFecha)} al ${diaLegible(l.ultimaFecha)}` : 'Sin fechas';

export const textoDeMonto = (centimos: number): string => formatearSoles(centimos);

export const textoDeBotonImportar = (nuevas: number): string => (nuevas === 1 ? 'Importar 1 trabajo' : `Importar ${nuevas} trabajos`);

/** Con errores el servidor no crea nada de esas filas: se avisa para que la persona decida con calma. */
export function avisoDeErrores(erroresTotal: number): string | null {
  if (erroresTotal === 0) return null;
  const filas = erroresTotal === 1 ? '1 fila tiene' : `${erroresTotal} filas tienen`;
  return `${filas} errores y no se importarán. Corrige el archivo y vuelve a previsualizar, o importa solo las demás.`;
}

/** «Se muestran las primeras 100 de 340.» solo cuando la lista llega cortada. */
export const avisoDeRecorte = (mostradas: number, total: number): string | null => (total > mostradas ? `Se muestran las primeras ${mostradas} de ${total}.` : null);

/** Frase de cierre tras importar. */
export function mensajeDeImportacion(l: LecturaDeHistorial): string {
  const creadas = l.creadas ?? 0;
  const clientes = l.clientesCreados ?? 0;
  const base = creadas === 1 ? 'Se importó 1 trabajo' : `Se importaron ${creadas} trabajos`;
  return clientes > 0 ? `${base} y se crearon ${clientes} ${clientes === 1 ? 'cliente' : 'clientes'}.` : `${base}.`;
}
