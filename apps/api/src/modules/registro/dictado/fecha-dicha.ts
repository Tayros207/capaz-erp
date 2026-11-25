// REGLA NUEVA (A2): el modelo copia la fecha TAL COMO SE DIJO («el lunes», «hace 3 días») y el servidor la resuelve con el «hoy» de
// la empresa. Así el modelo nunca calcula fechas ni necesita saber qué día es. Puro; aritmética en UTC, sin Date local.
import { extraerFechaEntrega } from './reglas/pedido-fecha.js';
import { sinTildes } from './reglas/pedido-texto.js';

const MS_DIA = 86_400_000;
const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const CUANTOS: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

const aUtc = (dia: string): number => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)));
const restar = (hoy: string, dias: number): string => new Date(aUtc(hoy) - dias * MS_DIA).toISOString().slice(0, 10);

/** AAAA-MM-DD de un día que exista; null si no existe (31 de febrero). */
function diaValido(anio: number, mes: number, dia: number): string | null {
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia ? f.toISOString().slice(0, 10) : null;
}

/** «hoy», «ayer», «anteayer», «hace N días/semanas». */
function relativa(t: string, hoy: string): string | null {
  if (/\b(?:anteayer|antier|antes de ayer)\b/.test(t)) return restar(hoy, 2);
  if (/\bayer\b/.test(t)) return restar(hoy, 1);
  if (/\bhoy\b/.test(t)) return hoy;
  const hace = /\bhace\s+(\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(dias?|semanas?)\b/.exec(t);
  if (!hace) return null;
  const n = CUANTOS[hace[1]!] ?? Number(hace[1]);
  return restar(hoy, hace[2]!.startsWith('semana') ? n * 7 : n);
}

/** «el lunes»: el último lunes ANTES de hoy (dicho un lunes, el de la semana pasada). */
function diaDeLaSemana(t: string, hoy: string): string | null {
  const m = /\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/.exec(t);
  if (!m) return null;
  const actual = new Date(aUtc(hoy)).getUTCDay();
  return restar(hoy, (actual - DIAS[m[1]!]! + 7) % 7 || 7);
}

/** «el 15», «15 de octubre», «15/10», «15/10/2026», «2026-10-15»: la última vez que llegó ese día (nunca en el futuro). */
function diaConNumero(t: string, hoy: string): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (iso) return diaValido(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const barra = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?\b/.exec(t);
  const palabras = /\b(\d{1,2})(?:\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre))?\b/.exec(t);
  const m = barra ?? palabras;
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = barra ? Number(barra[2]) : palabras?.[2] ? MESES[palabras[2]]! : null;
  const anio = barra?.[3] ? Number(barra[3].length === 2 ? `20${barra[3]}` : barra[3]) : null;
  const [ha, hm] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))];
  if (anio !== null && mes !== null) return diaValido(anio, mes, dia);
  if (mes !== null) return [diaValido(ha, mes, dia), diaValido(ha - 1, mes, dia)].find((d) => d !== null && d <= hoy) ?? null;
  const previo = hm === 1 ? diaValido(ha - 1, 12, dia) : diaValido(ha, hm - 1, dia);
  const este = diaValido(ha, hm, dia);
  return este !== null && este <= hoy ? este : previo;
}

/** La fecha PASADA de un movimiento dicha por la persona. null si no se entiende o si cae en el futuro (no se registra a futuro). */
export function fechaPasadaDicha(expresion: string, hoy: string): string | null {
  const t = sinTildes(expresion).trim();
  const fecha = relativa(t, hoy) ?? diaDeLaSemana(t, hoy) ?? diaConNumero(t, hoy);
  return fecha !== null && fecha <= hoy ? fecha : null;
}

/** La fecha de ENTREGA de un pedido, con las mismas reglas que el dictado de pedidos («para el viernes», «en 3 días»). */
export function fechaDeEntregaDicha(expresion: string, hoy: string): string | null {
  const t = expresion.trim();
  const plano = sinTildes(t);
  const conPara = /^(?:para|entrega|en\s|dentro|manana|pasado|hoy)/.test(plano) ? t : `para ${/^\d/.test(plano) ? 'el ' : ''}${t}`;
  return extraerFechaEntrega(conPara, hoy).fecha || null;
}
