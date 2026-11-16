import type { ConfiguracionEmpresa } from './empresa.js'
import { DECIMALES_IMPORTE, aTexto, esCero, pct, sumar } from './dinero.js'

/** La línea del impuesto de un precio; `null` si la empresa no tiene impuesto (entonces no se muestra). */
export type LineaDeImpuesto = { nombre: string; pct: string; monto: string } | null

/**
 * El impuesto aparte de un precio y el total con él, con el nombre y el % de la empresa (IGV 18 % en
 * Perú). Una sola cuenta para todo lo que lo muestra: la página pública, el PDF y la cotización rápida.
 */
export function conImpuesto(
  precio: string,
  configuracion: Pick<ConfiguracionEmpresa, 'impuestoNombre' | 'impuestoPct'>,
): { impuesto: LineaDeImpuesto; totalConImpuesto: string } {
  const impuesto = esCero(configuracion.impuestoPct)
    ? null
    : {
        nombre: configuracion.impuestoNombre,
        pct: aTexto(configuracion.impuestoPct, 2),
        monto: aTexto(pct(precio, configuracion.impuestoPct), DECIMALES_IMPORTE),
      }
  return { impuesto, totalConImpuesto: aTexto(sumar(precio, impuesto?.monto ?? '0'), DECIMALES_IMPORTE) }
}
