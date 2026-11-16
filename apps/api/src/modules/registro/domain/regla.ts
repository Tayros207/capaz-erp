// Resultado de una regla de dinero: pasa (con lo que calculó) o se rechaza con un código del catálogo y el
// mensaje para la persona. Las reglas son puras: no tocan la base ni conocen el ejecutor.

export type CodigoDeRegla = 'conflicto' | 'argumentos_invalidos';
export type Rechazada = { ok: false; codigo: CodigoDeRegla; mensaje: string };
export type Regla<T = object> = ({ ok: true } & T) | Rechazada;

export const rechazada = (codigo: CodigoDeRegla, mensaje: string): Rechazada => ({ ok: false, codigo, mensaje });

/** Un importe en céntimos válido: entero y dentro del rango seguro. */
export function exigirCentimos(valor: number, nombre: string): void {
  if (!Number.isSafeInteger(valor)) throw new RangeError(`«${nombre}» debe ser un entero de céntimos (llegó ${valor}).`);
}
