import {
  CARACTERES_MINIMOS_DE_EXPLICACION, formatearSoles, semanaDe, sumarDias,
  type Centimos, type EntradaDe, type EstadoDeSemana, type SemanaRevisadaDto,
} from '@capaz/shared';
import { formatearDia } from './logica.ts';

// Lógica pura del cierre semanal (sin React ni red): semanas, diferencias, validación y argumentos de `semana_cerrar`.

export const PASOS_DE_CIERRE = ['Semana', 'Revisar', 'Contar', 'Cerrar'] as const;
export const MAXIMO_DE_NOTAS = 1000;
export const MAXIMO_DE_EXPLICACION = 500;

type Cuenta = SemanaRevisadaDto['cuentas'][number];
/** Lo que la persona contó, por cuenta (`null` = todavía vacío). */
export type Conteos = Record<string, Centimos | null>;
export type Explicaciones = Record<string, string>;
export type ErroresDeConteo = Record<string, { conteo?: string; explicacion?: string }>;

/** La semana (lunes a sábado) que contiene al día; el domingo cuenta la que terminó el día anterior. */
export const semanaDeHoy = (hoy: string): string => semanaDe(hoy).desde;
/** Mueve el lunes de la semana `n` semanas (negativo = atrás). */
export const moverSemana = (desde: string, n: number): string => sumarDias(desde, 7 * n);
/** La semana que toca cerrar: la en curso desde el sábado; de lunes a viernes, la anterior (ya terminada). El domingo, la que terminó ayer. */
export function semanaQueTocaCerrar(hoy: string): string {
  const { desde, hasta } = semanaDe(hoy);
  return hoy >= hasta ? desde : sumarDias(desde, -7);
}
export const esLaSemanaDeHoy = (desde: string, hoy: string): boolean => desde === semanaDeHoy(hoy);

/** «16/11 al 21/11/2026». */
export function textoDeSemana(desde: string, hasta: string): string {
  const corto = formatearDia(desde).slice(0, 5);
  return `${corto} al ${formatearDia(hasta)}`;
}

export const TEXTO_DE_ESTADO_DE_SEMANA: Record<EstadoDeSemana, string> = {
  futura: 'Todavía no empieza',
  en_curso: 'En curso',
  por_cerrar: 'Lista para cerrar',
  cerrada: 'Cerrada',
};
export const TONO_DE_ESTADO_DE_SEMANA: Record<EstadoDeSemana, 'neutro' | 'info' | 'aviso' | 'exito'> = { futura: 'neutro', en_curso: 'info', por_cerrar: 'aviso', cerrada: 'exito' };

/** Frase que explica por qué la semana no se puede contar todavía, o `null` si sí se puede. */
export function motivoParaNoContar(estado: EstadoDeSemana, hasta: string): string | null {
  if (estado === 'futura') return 'Esta semana todavía no empieza: no se puede cerrar.';
  if (estado === 'en_curso') return `Esta semana termina el sábado ${formatearDia(hasta)}: ciérrala ese día o después.`;
  if (estado === 'cerrada') return 'Esta semana ya está cerrada.';
  return null;
}

/** Contado menos sistema, o `null` si todavía no se contó. Negativo = falta dinero. */
export const diferenciaDeConteo = (sistemaCentimos: number, contado: Centimos | null | undefined): number | null =>
  contado === null || contado === undefined ? null : contado - sistemaCentimos;

/** «Cuadra», «Faltan S/ 5.00» o «Sobran S/ 5.00». */
export function textoDeDiferencia(diferenciaCentimos: number): string {
  if (diferenciaCentimos === 0) return 'Cuadra';
  return `${diferenciaCentimos < 0 ? 'Faltan' : 'Sobran'} ${formatearSoles(Math.abs(diferenciaCentimos))}`;
}

/** El conteo es al sábado de la semana, no a hoy. `hasta` es ese sábado (AAAA-MM-DD). */
export const etiquetaDeConteo = (hasta: string): string => `Saldo al cierre del sábado ${formatearDia(hasta).slice(0, 5)}`;

/** Aviso bajo una cuenta cuando ya hay movimientos anotados después del sábado, o `null` si no. */
export function avisoDeMovimientosPosteriores(netoCentimos: number): string | null {
  if (netoCentimos === 0) return null;
  const signo = netoCentimos > 0 ? '+' : '−';
  const sentido = netoCentimos > 0 ? 'entró más de lo que salió' : 'salió más de lo que entró';
  return `Hoy ya anotaste movimientos posteriores al sábado por ${signo}${formatearSoles(Math.abs(netoCentimos))} (neto: ${sentido}). Si miras tu banco hoy, réstalos para contar al sábado.`;
}

/** Frase de un ajuste: movimientos anotados después de cerrar una semana anterior. */
export const textoDeAjusteAnterior = (a: SemanaRevisadaDto['ajustesPosterioresACierre'][number]): string =>
  `${a.nombre}: contaste ${formatearSoles(a.contadoDelCierreCentimos)} y ahora la cuenta empieza en ${formatearSoles(a.saldoInicialCentimos)} (diferencia ${a.diferenciaCentimos < 0 ? '−' : '+'}${formatearSoles(Math.abs(a.diferenciaCentimos))}).`;

/** Caracteres de la explicación sin los espacios de los extremos (así los cuenta el servidor). */
export const largoDeExplicacion = (texto: string): number => texto.trim().length;
export const faltanParaExplicar = (texto: string): number => Math.max(0, CARACTERES_MINIMOS_DE_EXPLICACION - largoDeExplicacion(texto));

/** Un error por cuenta sin contar o con diferencia sin explicar. Vacío = se puede cerrar. */
export function validarConteos(cuentas: readonly Cuenta[], conteos: Conteos, explicaciones: Explicaciones): ErroresDeConteo {
  const errores: ErroresDeConteo = {};
  for (const c of cuentas) {
    const dif = diferenciaDeConteo(c.sistemaCentimos, conteos[c.cuentaId]);
    if (dif === null) errores[c.cuentaId] = { conteo: `Escribe lo que contaste en «${c.nombre}».` };
    else if (dif !== 0 && faltanParaExplicar(explicaciones[c.cuentaId] ?? '') > 0) {
      errores[c.cuentaId] = { explicacion: `Explica por qué «${c.nombre}» no cuadra (${textoDeDiferencia(dif)}): al menos ${CARACTERES_MINIMOS_DE_EXPLICACION} caracteres.` };
    }
  }
  return errores;
}

/** Cuántas cuentas no cuadran y cuánto suman las diferencias (con signo). */
export function resumenDeDiferencias(cuentas: readonly Cuenta[], conteos: Conteos): { sinCuadrar: number; totalCentimos: number } {
  let sinCuadrar = 0;
  let totalCentimos = 0;
  for (const c of cuentas) {
    const dif = diferenciaDeConteo(c.sistemaCentimos, conteos[c.cuentaId]);
    if (dif) { sinCuadrar += 1; totalCentimos += dif; }
  }
  return { sinCuadrar, totalCentimos };
}

/** Argumentos de `semana_cerrar`: la explicación solo viaja donde hay diferencia; lo vacío no viaja. */
export function argumentosDeCierre(desde: string, cuentas: readonly Cuenta[], conteos: Conteos, explicaciones: Explicaciones, notas: string): EntradaDe<'semana_cerrar'> {
  const lista = cuentas.map((c) => {
    const contado = conteos[c.cuentaId];
    if (contado === null || contado === undefined) throw new Error(`Falta lo contado en «${c.nombre}».`);
    const explicacion = (explicaciones[c.cuentaId] ?? '').trim();
    const item: EntradaDe<'semana_cerrar'>['conteos'][number] = { cuentaId: c.cuentaId, contadoCentimos: contado };
    if (contado !== c.sistemaCentimos && explicacion) item.explicacion = explicacion;
    return item;
  });
  const args: EntradaDe<'semana_cerrar'> = { desde, conteos: lista };
  if (notas.trim()) args.notas = notas.trim();
  return args;
}

/** Frase de un cambio ocurrido después del cierre. */
export const textoDeCambioDesdeElCierre = (c: SemanaRevisadaDto['cambiosDesdeElCierre'][number]): string =>
  `${c.nombre}: al cerrar contaste ${formatearSoles(c.contadoCentimos)} y hoy el sistema dice ${formatearSoles(c.sistemaCentimos)}.`;
