// La configuración del motor sale de `cotizador.configuracion` (una fila por empresa). Moneda PEN y locale es-PE son fijos (V1).
import type { CondicionesDeCotizacion } from '@capaz/shared';
import { CONFIGURACION_POR_DEFECTO } from './configuracion.js';
import { porcentajeDeBase } from './adaptador-de-dinero.js';
import type { ConfiguracionEmpresa } from './motor/base/empresa.js';
import { configuracionEsPE } from './motor/base/semilla-es-pe.js';

/** Lo que se lee de la fila de configuración (los porcentajes llegan como `numeric`: '35.000'). */
export type FilaDeConfiguracion = {
  utilidadPct: string;
  utilidadBase: string;
  umbralVerdePct: string;
  umbralMinimoPct: string;
  redondeoComercial: string;
  igvPorcentaje: number;
  condiciones: unknown;
  mensajeWhatsapp: string | null;
};

const REDONDEOS = ['ninguno', '1', '5', '10'] as const;

/** La `ConfiguracionDeCosteo` completa que pide el motor, con los valores de la empresa (o los de partida si aún no hay fila). */
export function configuracionDeMotor(fila: FilaDeConfiguracion | null): ConfiguracionEmpresa {
  const f: FilaDeConfiguracion = fila ?? CONFIGURACION_POR_DEFECTO;
  const condiciones = { ...(f.condiciones as Partial<CondicionesDeCotizacion>) };
  return {
    ...configuracionEsPE,
    pais: 'PE',
    moneda: 'PEN',
    locale: 'es-PE',
    impuestoNombre: 'IGV',
    impuestoPct: String(f.igvPorcentaje),
    utilidadPct: porcentajeDeBase(f.utilidadPct),
    utilidadBase: f.utilidadBase === 'costo' ? 'costo' : 'venta',
    umbralVerdePct: porcentajeDeBase(f.umbralVerdePct),
    umbralMinimoPct: porcentajeDeBase(f.umbralMinimoPct),
    redondeoComercial: (REDONDEOS as readonly string[]).includes(f.redondeoComercial) ? (f.redondeoComercial as (typeof REDONDEOS)[number]) : 'ninguno',
    condiciones: {
      validezDias: condiciones.validezDias ?? null,
      plazoEntrega: condiciones.plazoEntrega ?? '',
      formaPago: condiciones.formaPago ?? '',
      tolerancia: condiciones.tolerancia ?? '',
      noIncluye: condiciones.noIncluye ?? '',
    },
    mensajeWhatsapp: f.mensajeWhatsapp && f.mensajeWhatsapp.includes('{enlace}') ? f.mensajeWhatsapp : configuracionEsPE.mensajeWhatsapp,
  };
}
