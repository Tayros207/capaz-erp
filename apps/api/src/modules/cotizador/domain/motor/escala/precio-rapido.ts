import { correcto, fallo, type Resultado } from '../base/resultado.js'
import type { RedondeoComercial } from '../base/empresa.js'
import { CERO, DECIMALES_IMPORTE, DECIMALES_UNITARIO, aTexto, dividir, esMayor, multiplicar, pct, redondear, sumar, techo } from '../base/dinero.js'
import type { Ajuste, CodigoDePrecioRapido, PrecioRapido, VariantePrecio } from './tipos/precio-por-escala.js'
import { calcularPrecioPorEscala } from './precio-por-escala.js'

/**
 * El total de lista llevado hacia arriba al múltiplo de 1, 5 o 10 que eligió la empresa (PRP-005):
 * 994.37 a 5 → 995.00. Un total que ya es múltiplo no cambia. `ninguno` lo deja como está.
 */
export function redondearComercial(total: string, redondeo: RedondeoComercial): string {
  if (redondeo === 'ninguno') return total
  return aTexto(multiplicar(techo(dividir(total, redondeo)), redondeo), DECIMALES_IMPORTE)
}

/**
 * El precio de una cotización rápida: el de lista sale de `calcularPrecioPorEscala` (mismas reglas:
 * 100 a 5.000, curva o escalón, mínimo) y el ajuste se aplica encima, solo para esta cotización.
 * El ajuste del cliente (PRP-006) y el redondeo comercial se aplican al de lista, en ese orden, antes del ajuste. Un final que no sea mayor que cero se rechaza. Todo con big.js, sin `number`.
 */
export function precioDeRapida(
  variante: VariantePrecio,
  cantidad: string,
  ajuste: Ajuste,
  redondeo: RedondeoComercial = 'ninguno',
  ajusteClientePct: string | null = null,
): Resultado<PrecioRapido, CodigoDePrecioRapido> {
  const lista = calcularPrecioPorEscala(variante, cantidad)
  if (!lista.ok) return lista
  // Orden: lista del motor → ajuste del cliente → redondeo comercial → (después) ajuste de esta cotización.
  const conCliente = ajusteClientePct === null ? lista.valor.total : aTexto(redondear(sumar(lista.valor.total, pct(lista.valor.total, ajusteClientePct)), DECIMALES_IMPORTE), DECIMALES_IMPORTE)
  const precioLista = redondearComercial(conCliente, redondeo)
  const final =
    ajuste.tipo === 'precio' ? ajuste.precio : ajuste.tipo === 'monto' ? sumar(precioLista, ajuste.monto) : precioLista
  if (!esMayor(final, CERO)) {
    return fallo('precio_no_positivo', 'El precio para el cliente debe ser mayor que cero.')
  }
  return correcto({
    precioLista,
    precioFinal: aTexto(final, DECIMALES_IMPORTE),
    unitario: aTexto(dividir(final, cantidad), DECIMALES_UNITARIO),
    minimoAplicado: lista.valor.minimoAplicado,
    ...(ajusteClientePct === null ? {} : { ajusteClientePct }),
  })
}
