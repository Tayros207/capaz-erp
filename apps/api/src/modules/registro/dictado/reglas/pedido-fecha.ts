// Porte adaptado de SF (features/ordenes/lib/dictado-orden.ts:156-267 y hooks/cola.ts:29-40,56-60). Cambios: la función grande se
// divide en tres ayudantes (plazo, cercana, por día) para cumplir el tope de 50 líneas; las regex y `fechaPorDiaDelMes` van literales.
import { quitar, sinTildes } from './pedido-texto.js';

type Hallazgo = { fecha: string; resto: string };

const MS_DIA = 86_400_000;

function aUtc(fecha: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 'AAAA-MM-DD' + n días. Devuelve la fecha tal cual si no se entiende. */
function sumarDias(fecha: string, dias: number): string {
  const base = aUtc(fecha);
  if (Number.isNaN(base)) return fecha;
  return new Date(base + dias * MS_DIA).toISOString().slice(0, 10);
}

const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const SEMANAS: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4 };
const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, setiembre: 8, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

/** En N días o en N semanas. */
function fechaPorPlazo(texto: string, plano: string, hoy: string): Hallazgo | null {
  const enDias = plano.match(/[,;]?\s*\b(?:en|dentro\s+de)\s+(\d{1,3})\s*d[ií]as?\b/i);
  if (enDias?.index !== undefined) {
    return { fecha: sumarDias(hoy, Number(enDias[1])), resto: quitar(texto, enDias.index, enDias[0].length) };
  }
  const enSemanas = plano.match(/[,;]?\s*\b(?:en|dentro\s+de)\s+(\d{1,2}|una?|dos|tres|cuatro)\s*semanas?\b/i);
  if (enSemanas?.index !== undefined) {
    const cuantas = SEMANAS[enSemanas[1]!.toLowerCase()] ?? Number(enSemanas[1]);
    if (Number.isFinite(cuantas) && cuantas > 0) {
      return { fecha: sumarDias(hoy, cuantas * 7), resto: quitar(texto, enSemanas.index, enSemanas[0].length) };
    }
  }
  return null;
}

/** Pasado mañana, mañana y hoy. */
function fechaCercana(texto: string, plano: string, hoy: string): Hallazgo | null {
  const pasado = plano.match(/[,;]?\s*\b(?:para\s+)?pasado\s+mañana\b|[,;]?\s*\b(?:para\s+)?pasado\s+manana\b/i);
  if (pasado?.index !== undefined) return { fecha: sumarDias(hoy, 2), resto: quitar(texto, pasado.index, pasado[0].length) };
  const manana = plano.match(/[,;]?\s*\b(?:para\s+|entrega\s+)?manana\b/i);
  if (manana?.index !== undefined) return { fecha: sumarDias(hoy, 1), resto: quitar(texto, manana.index, manana[0].length) };
  const paraHoy = plano.match(/[,;]?\s*\b(?:para\s+|entrega\s+)hoy\b/i);
  if (paraHoy?.index !== undefined) return { fecha: hoy, resto: quitar(texto, paraHoy.index, paraHoy[0].length) };
  return null;
}

/** El próximo día N que llegue. Sin mes, si el N de este mes ya pasó es el del mes que viene. Todo en UTC. */
function fechaPorDiaDelMes(hoy: string, dia: number, mes: number | null): string {
  if (dia < 1 || dia > 31) return '';
  const base = new Date(`${hoy}T00:00:00Z`);
  let anio = base.getUTCFullYear();
  let cual = mes ?? base.getUTCMonth();
  if (mes === null) {
    if (dia <= base.getUTCDate()) cual += 1;
  } else if (cual < base.getUTCMonth() || (cual === base.getUTCMonth() && dia < base.getUTCDate())) {
    anio += 1;
  }
  const fecha = new Date(Date.UTC(anio, cual, dia));
  // Un 31 de febrero no existe: antes que inventar una entrega, no se pone ninguna.
  if (fecha.getUTCDate() !== dia) return '';
  return fecha.toISOString().slice(0, 10);
}

/** Un día de la semana («para el viernes», siempre hacia adelante) o del mes («para el 15 de octubre»). */
function fechaPorDia(texto: string, plano: string, hoy: string): Hallazgo | null {
  const diaSemana = plano.match(/[,;]?\s*\b(?:para|entrega\w*)\s+(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/i);
  if (diaSemana?.index !== undefined) {
    const objetivo = DIAS[diaSemana[1]!.toLowerCase()]!;
    const actual = new Date(`${hoy}T00:00:00Z`).getUTCDay();
    const saltos = (objetivo - actual + 7) % 7 || 7;
    return { fecha: sumarDias(hoy, saltos), resto: quitar(texto, diaSemana.index, diaSemana[0].length) };
  }
  const diaMes = plano.match(
    /[,;]?\s*\b(?:para|entrega\w*)\s+el\s+(\d{1,2})(?:\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre))?\b/i,
  );
  if (diaMes?.index !== undefined) {
    const fecha = fechaPorDiaDelMes(hoy, Number(diaMes[1]), MESES[diaMes[2]?.toLowerCase() ?? ''] ?? null);
    if (fecha) return { fecha, resto: quitar(texto, diaMes.index, diaMes[0].length) };
  }
  return null;
}

/** Cuándo hay que entregarlo: AAAA-MM-DD (o '') y el texto sin esa parte. */
export function extraerFechaEntrega(texto: string, hoy: string): { fecha: string; resto: string } {
  const plano = sinTildes(texto);
  return fechaPorPlazo(texto, plano, hoy) ?? fechaCercana(texto, plano, hoy) ?? fechaPorDia(texto, plano, hoy) ?? { fecha: '', resto: texto };
}
