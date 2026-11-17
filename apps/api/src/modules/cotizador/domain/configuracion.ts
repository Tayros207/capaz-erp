// Reglas de la configuración del Cotizador. Puras.
import { CONDICIONES_VACIAS, UNIDADES_SUGERIDAS, type ConfiguracionDeCotizadorDto } from '@capaz/shared';
import type { Rechazo } from './precios.js';

/** Los valores cuando la empresa todavía no tiene fila (coinciden con los de la tabla). */
export const CONFIGURACION_POR_DEFECTO: ConfiguracionDeCotizadorDto = {
  utilidadPct: '35.000',
  utilidadBase: 'venta',
  umbralVerdePct: '30.000',
  umbralMinimoPct: '15.000',
  redondeoComercial: 'ninguno',
  igvPorcentaje: 18,
  condiciones: { ...CONDICIONES_VACIAS },
  mensajeWhatsapp: null,
  unidades: [...UNIDADES_SUGERIDAS],
  actualizadoEn: null,
};

/** Tras fusionar el cambio: `umbralMinimoPct < umbralVerdePct` y, con base `venta`, `utilidadPct < 100`. */
export function validarConfiguracion(c: Pick<ConfiguracionDeCotizadorDto, 'utilidadPct' | 'utilidadBase' | 'umbralVerdePct' | 'umbralMinimoPct'>): Rechazo | null {
  if (!(Number(c.umbralMinimoPct) < Number(c.umbralVerdePct))) {
    return { ok: false, codigo: 'argumentos_invalidos', mensaje: 'El umbral mínimo debe ser menor que el umbral verde.' };
  }
  if (c.utilidadBase === 'venta' && !(Number(c.utilidadPct) < 100)) {
    return { ok: false, codigo: 'argumentos_invalidos', mensaje: 'Con la utilidad sobre la venta, el porcentaje debe ser menor que 100.' };
  }
  return null;
}

/** El ajuste de un cliente: de -100 (sin incluir) a 500; `0` o vacío lo quita. `null` = quitarlo. */
export function validarAjusteDeCliente(texto: string | null): { ok: true; porcentaje: string | null } | Rechazo {
  if (texto === null) return { ok: true, porcentaje: null };
  const n = Number(texto);
  if (n === 0) return { ok: true, porcentaje: null };
  if (!(n > -100 && n <= 500)) return { ok: false, codigo: 'argumentos_invalidos', mensaje: 'El ajuste debe estar entre -100 y 500 por ciento.' };
  return { ok: true, porcentaje: texto };
}
