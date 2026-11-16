import { formatearSoles, MAXIMO_DE_DIAS_DEL_PANEL, type BloqueDelPanelDto, type IndicadorDto } from '@capaz/shared';
import type { SerieDeGrafico } from '../../shared/ui/logica-grafico.ts';

// Lógica pura de la pantalla «Indicadores»: períodos, validación y formato. Sin React ni red.

export const PRESETS = ['hoy', 'semana', 'mes', 'rango'] as const;
export type Preset = (typeof PRESETS)[number];
export const ETIQUETA_DE_PRESET: Record<Preset, string> = { hoy: 'Hoy', semana: '7 días', mes: 'Este mes', rango: 'Rango' };

export type RangoDeDias = { desde: string; hasta: string };

const MS_DIA = 86_400_000;
const FORMA_DE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const aMs = (dia: string) => Date.parse(`${dia}T00:00:00Z`);
const deMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Un `AAAA-MM-DD` que existe de verdad (no `2026-02-30`). */
export const esDiaValido = (dia: string): boolean => FORMA_DE_DIA.test(dia) && deMs(aMs(dia)) === dia;

export const sumarDias = (dia: string, n: number): string => deMs(aMs(dia) + n * MS_DIA);
export const diasEntre = (desde: string, hasta: string): number => Math.round((aMs(hasta) - aMs(desde)) / MS_DIA) + 1;

/** El período de un preset, contando hasta `hoy`. `rango` usa lo que la persona escribió. */
export function periodoDe(preset: Preset, hoy: string, rango: RangoDeDias): RangoDeDias {
  if (preset === 'hoy') return { desde: hoy, hasta: hoy };
  if (preset === 'semana') return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (preset === 'mes') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  return rango;
}

/** El motivo por el que un rango no sirve, o nulo si sirve. */
export function errorDeRango({ desde, hasta }: RangoDeDias): string | null {
  if (!esDiaValido(desde) || !esDiaValido(hasta)) return 'Escribe las dos fechas.';
  if (hasta < desde) return 'La fecha final no puede ser anterior a la inicial.';
  if (diasEntre(desde, hasta) > MAXIMO_DE_DIAS_DEL_PANEL) return `El período abarca como máximo ${MAXIMO_DE_DIAS_DEL_PANEL} días.`;
  return null;
}

export const valorDeIndicador = (i: Pick<IndicadorDto, 'tipo' | 'valor'>): string =>
  i.tipo === 'dinero' ? formatearSoles(i.valor) : i.valor.toLocaleString('es-PE');

/** `2026-03-01` → `01/03/2026`, sin pasar por `Date`. */
export function formatearDia(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

export const textoDelPeriodo = ({ desde, hasta }: RangoDeDias): string =>
  desde === hasta ? formatearDia(desde) : `${formatearDia(desde)} al ${formatearDia(hasta)}`;

/** Tono de una cifra: solo lo que tiene sentido de negocio y nunca inventado (atrasos y vencidos son atención). */
export function tonoDeIndicador(i: Pick<IndicadorDto, 'etiqueta' | 'valor'>): 'neutro' | 'peligro' {
  return i.valor > 0 && /atrasad|vencid|bajo m[ií]nimo|perdid/i.test(i.etiqueta) ? 'peligro' : 'neutro';
}

/** Las series de un bloque en la forma de los gráficos del kit. Vacío si el módulo no entregó `serie`: no se inventa nada. */
export function seriesParaGrafico(bloque: BloqueDelPanelDto): Array<{ id: string; nombre: string; formato: (n: number) => string; series: SerieDeGrafico[] }> {
  return bloque.series
    .filter((s) => s.puntos.length > 0)
    .map((s) => ({
      id: s.id,
      nombre: `${bloque.nombre} · ${s.etiqueta}`,
      formato: s.tipo === 'dinero' ? formatearSoles : (n: number) => n.toLocaleString('es-PE'),
      series: [{ nombre: s.etiqueta, puntos: s.puntos.map((p) => ({ x: formatearDia(p.fecha).slice(0, 5), y: p.valor })) }],
    }));
}

/** Nombre de archivo que no puede salirse de la carpeta de descargas. */
export const nombreDeArchivoSeguro = (nombre: string): string => nombre.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '') || 'indicadores.csv';

/** Día `AAAA-MM-DD` de un instante en una zona horaria. El servidor valida el período; esto solo precarga «hoy». */
export function diaEnZona(instante: Date, zona = 'America/Lima'): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${de('year')}-${de('month')}-${de('day')}`;
}
