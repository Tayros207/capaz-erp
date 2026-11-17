// Evaluar un cuadro: sincroniza las filas del motor, costea (por filas y por columnas) y decide cuál es el precio que rige.
// Una versión emitida devuelve su foto congelada: no se recalcula con la configuración de hoy.
import { correcto, fallo, type Resultado } from './motor/base/resultado.js';
import { cuadroSchema, type Emision } from './motor/costeo/tipos/borrador.js';
import type { Calculo } from './motor/costeo/tipos/cotizacion.js';
import type { Columna, CuadroDirectoCalculado } from './motor/costeo/tipos/cuadro-directo.js';
import { calcularCuadro, sincronizarFilas, type CuadroCalculado } from './motor/costeo/cuadro.js';
import { calcularCuadroDirecto } from './motor/costeo/cuadro-directo.js';
import type { ConfiguracionEmpresa, Cuadro } from './cuadro-tipos.js';

export type CuadroEvaluado = {
  /** El cuadro con las filas automáticas al día. */
  cuadro: Cuadro;
  calculado: CuadroCalculado;
  directo: CuadroDirectoCalculado;
  codigos: Record<Columna, string | null>;
  /** El precio que rige: el de la columna base (lo escrito a mano manda) o, sin columna base, el del cuadro por filas. `null` si aún no se puede calcular. */
  rige: Calculo | null;
  emitida: boolean;
};

const SIN_CODIGOS: Record<Columna, string | null> = { '100': null, '1000': null, '5000': null };

/** El papel está ligado al motor y le faltan datos (o la pieza no cabe): el costo por filas todavía no es fiable. */
function papelPendiente(c: CuadroCalculado): boolean {
  return c.cuadro.automaticas.papel !== null && (c.faltantes.length > 0 || c.problema !== null);
}

export function evaluarBorrador(cuadro: Cuadro, config: ConfiguracionEmpresa): Resultado<CuadroEvaluado, 'utilidad_imposible'> {
  const calculado = calcularCuadro(cuadro, config);
  if (!calculado.ok) return calculado;
  const d = calcularCuadroDirecto(cuadro, config);
  if (!d.ok) return d;
  const { codigos, ...directo } = d.valor;
  const base = directo.base;
  const rige = base ? directo.columnas[base].calculo : papelPendiente(calculado.valor) ? null : calculado.valor.calculo;
  return correcto({ cuadro: calculado.valor.cuadro, calculado: calculado.valor, directo, codigos, rige, emitida: false });
}

/** La foto congelada de una versión emitida. */
export function evaluarEmitida(cuadro: Cuadro, emision: Emision): Resultado<CuadroEvaluado, 'utilidad_imposible'> {
  const directo = emision.directo ?? (() => {
    const d = calcularCuadroDirecto(cuadro, emision.configuracion);
    return d.ok ? { base: d.valor.base, filas: d.valor.filas, columnas: d.valor.columnas, coherencia: d.valor.coherencia } : null;
  })();
  if (!directo) return fallo('utilidad_imposible', 'No se pudo leer la cotización emitida.');
  const calculado: CuadroCalculado = { cuadro, entradaDeImposicion: null, imposicion: emision.imposicion, faltantes: [], problema: null, calculo: emision.calculo };
  return correcto({ cuadro, calculado, directo, codigos: SIN_CODIGOS, rige: emision.calculo, emitida: true });
}

/** Lee una versión guardada (su `entrada` y, si está emitida, su `resultado`) y la evalúa. */
export function evaluarVersion(entrada: unknown, resultado: unknown, emitida: boolean, config: ConfiguracionEmpresa): Resultado<CuadroEvaluado, 'cuadro_invalido' | 'utilidad_imposible'> {
  const leido = cuadroSchema.safeParse(entrada);
  if (!leido.success) return fallo('cuadro_invalido', 'El cuadro guardado no es válido.');
  if (emitida && resultado) return evaluarEmitida(leido.data, resultado as Emision);
  return evaluarBorrador(leido.data, config);
}

/** Pone al día las filas del motor y valida el cuadro entero (tope de filas, ids, ítems…) antes de guardarlo. */
export function validarCuadro(cuadro: Cuadro): { ok: true; cuadro: Cuadro } | { ok: false; mensaje: string } {
  const r = cuadroSchema.safeParse(sincronizarFilas(cuadro).cuadro);
  return r.success ? { ok: true, cuadro: r.data } : { ok: false, mensaje: r.error.issues[0]?.message ?? 'El cuadro no es válido.' };
}

/** Lee el cuadro guardado en la `entrada` de una versión. */
export function leerCuadro(entrada: unknown): { ok: true; cuadro: Cuadro } | { ok: false; mensaje: string } {
  const r = cuadroSchema.safeParse(entrada);
  return r.success ? { ok: true, cuadro: r.data } : { ok: false, mensaje: 'El cuadro guardado no es válido.' };
}
