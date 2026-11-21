import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { sumarDias } from './mi-dia.js';

// Cierre semanal de caja: la semana va del lunes al sábado; el domingo cuenta en la semana que empieza al día
// siguiente. Se cuenta el dinero de cada cuenta y lo que no cuadra queda como un movimiento «Diferencia de caja».
// Este archivo NO importa `registro.ts` (evita el ciclo): `registro.ts` lo incorpora. Dinero en céntimos enteros.

export const CARACTERES_MINIMOS_DE_EXPLICACION = 15;
export const NOMBRE_DE_CATEGORIA_DE_DIFERENCIA = 'Diferencia de caja';
export const ESTADOS_DE_SEMANA = ['futura', 'en_curso', 'por_cerrar', 'cerrada'] as const;
export type EstadoDeSemana = (typeof ESTADOS_DE_SEMANA)[number];

const MENSAJE_DE_LUNES = 'La semana se indica con su lunes (AAAA-MM-DD).';

/** `true` si el día `AAAA-MM-DD` existe y es lunes. */
export const esLunes = (dia: string): boolean => new Date(`${dia}T00:00:00Z`).getUTCDay() === 1;

/** La semana (lunes a sábado) de un día. El domingo devuelve la semana que terminó el día anterior. */
export function semanaDe(dia: string): { desde: string; hasta: string } {
  const diaDeSemana = new Date(`${dia}T00:00:00Z`).getUTCDay();
  const desde = sumarDias(dia, -(diaDeSemana === 0 ? 6 : diaDeSemana - 1));
  return { desde, hasta: sumarDias(desde, 5) };
}

/** Día `AAAA-MM-DD` desde 1900 (un año absurdo no sirve para revisar ni cerrar una semana). */
const dia = z.iso.date().refine((d) => d >= '1900-01-01', { error: 'La fecha no puede ser anterior a 1900.' });
export const MAXIMO_CONTADO_CENTIMOS = 1_000_000_000_000;
/** Lo contado: entero seguro hasta 1e12 céntimos en valor absoluto (el servidor además exige cero o más en una caja). */
const centimos = z.number().int().safe().min(-MAXIMO_CONTADO_CENTIMOS, { error: 'El monto contado es demasiado grande.' }).max(MAXIMO_CONTADO_CENTIMOS, { error: 'El monto contado es demasiado grande.' });
const texto = (max: number) => z.string().trim().max(max);

export const movimientoDeSemanaSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  fecha: dia,
  tipo: z.enum(['ingreso', 'egreso']),
  montoCentimos: z.number().int(),
  cuentaNombre: z.string(),
  contactoNombre: z.string().nullable(),
  descripcion: z.string().nullable(),
  medioDePago: z.string(),
});
export type MovimientoDeSemanaDto = z.infer<typeof movimientoDeSemanaSchema>;

export const saldoDeCierreSchema = z.strictObject({
  cuentaId: z.string(),
  nombre: z.string(),
  sistemaCentimos: z.number().int(),
  contadoCentimos: z.number().int(),
  /** Contado menos sistema: negativo si faltó dinero, positivo si sobró. */
  diferenciaCentimos: z.number().int(),
  movimientoId: z.string().nullable(),
  explicacion: z.string().nullable(),
});
export type SaldoDeCierreDto = z.infer<typeof saldoDeCierreSchema>;

export const cierreSchema = z.strictObject({
  id: z.string(),
  desde: dia,
  hasta: dia,
  saldos: z.array(saldoDeCierreSchema),
  diferenciaTotalCentimos: z.number().int(),
  notas: z.string().nullable(),
  cerradoPor: z.string(),
  cerradoEn: z.iso.datetime(),
});
export type CierreDto = z.infer<typeof cierreSchema>;

export const cuentaDeSemanaSchema = z.strictObject({
  cuentaId: z.string(),
  nombre: z.string(),
  tipo: z.enum(['caja', 'banco', 'billetera']),
  /** Saldo al empezar el domingo anterior a la semana. */
  saldoInicialCentimos: z.number().int(),
  ingresosCentimos: z.number().int(),
  egresosCentimos: z.number().int(),
  /** Entradas menos salidas por transferencias entre cuentas (ya incluidas en ingresos y egresos). */
  transferenciasNetasCentimos: z.number().int(),
  /** Saldo con todo lo que tiene fecha hasta el sábado. */
  sistemaCentimos: z.number().int(),
  /**
   * Neto (ingresos menos egresos, transferencias incluidas) de lo que tiene fecha después del sábado y hasta hoy. La web
   * puede decir «el saldo de hoy incluye S/ X posteriores al sábado». Es 0 si la semana aún no termina.
   */
  movimientosPosterioresCentimos: z.number().int(),
  movimientos: z.number().int(),
});

export const cambioDesdeElCierreSchema = z.strictObject({
  cuentaId: z.string(),
  nombre: z.string(),
  contadoCentimos: z.number().int(),
  sistemaCentimos: z.number().int(),
});

/** El saldo con el que empieza la semana no coincide con lo contado al cerrar la semana anterior (algo se cargó después con fecha atrasada). */
export const ajusteAnteriorAlCierreSchema = z.strictObject({
  cuentaId: z.string(),
  nombre: z.string(),
  contadoDelCierreCentimos: z.number().int(),
  saldoInicialCentimos: z.number().int(),
  /** Saldo inicial menos lo contado al cerrar. */
  diferenciaCentimos: z.number().int(),
});
export type AjusteAnteriorAlCierreDto = z.infer<typeof ajusteAnteriorAlCierreSchema>;

export const revisarSemanaSchema = z.strictObject({ fecha: dia.optional() });
export const semanaRevisadaSchema = z.strictObject({
  desde: dia,
  hasta: dia,
  /** El domingo anterior: desde ahí se miran los movimientos. */
  movimientosDesde: dia,
  estado: z.enum(ESTADOS_DE_SEMANA),
  cuentas: z.array(cuentaDeSemanaSchema),
  movimientos: z.array(movimientoDeSemanaSchema).max(200),
  movimientosTotal: z.number().int(),
  /** Ingresos sin cliente anotado (sin contar transferencias ni diferencias de caja). */
  ingresosSinCliente: z.array(movimientoDeSemanaSchema).max(50),
  ingresosSinClienteTotal: z.number().int(),
  /** Cobros por yape, plin, transferencia o tarjeta en una caja, o en efectivo en un banco o billetera. */
  cobrosEnCuentaDudosa: z.array(movimientoDeSemanaSchema).max(50),
  cobrosEnCuentaDudosaTotal: z.number().int(),
  cierre: cierreSchema.nullable(),
  /** Cuentas cuyo saldo de hoy ya no coincide con lo contado al cerrar. */
  cambiosDesdeElCierre: z.array(cambioDesdeElCierreSchema),
  /** Cuentas cuyo saldo inicial difiere de lo contado al cerrar la semana anterior (movimientos con fecha atrasada cargados después). Máximo 50; no bloquea nada. */
  ajustesPosterioresACierre: z.array(ajusteAnteriorAlCierreSchema).max(50),
});
export type SemanaRevisadaDto = z.infer<typeof semanaRevisadaSchema>;

export const cerrarSemanaSchema = z.strictObject({
  desde: dia.refine(esLunes, { error: MENSAJE_DE_LUNES }).describe('Lunes de la semana'),
  conteos: z
    .array(z.strictObject({ cuentaId: z.uuid(), contadoCentimos: centimos, explicacion: texto(500).optional() }))
    .min(1, { error: 'Cuenta el dinero de al menos una cuenta.' })
    .max(50),
  notas: texto(1000).optional(),
});
export const semanaCerradaSchema = z.strictObject({ cierre: cierreSchema, movimientosCreados: z.array(movimientoDeSemanaSchema) });
export type SemanaCerradaDto = z.infer<typeof semanaCerradaSchema>;

export const contratosDeRegistroCierre = {
  semana_revisar: contrato(revisarSemanaSchema, semanaRevisadaSchema),
  semana_cerrar: contrato(cerrarSemanaSchema, semanaCerradaSchema),
} as const;
