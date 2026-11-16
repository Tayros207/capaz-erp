// Resultado de una operación de dominio que puede fallar por una entrada del usuario
// (utilidad imposible, pliego fuera de formato, texto que no es un número...).
// Los motores lo devuelven en lugar de lanzar: un fallo esperado no es una excepción.

export type Fallo<C extends string = string> = { codigo: C; mensaje: string }

export type Resultado<T, C extends string = string> =
  | { ok: true; valor: T }
  | { ok: false; error: Fallo<C> }

export function correcto<T>(valor: T): { ok: true; valor: T } {
  return { ok: true, valor }
}

export function fallo<C extends string>(
  codigo: C,
  mensaje: string,
): { ok: false; error: Fallo<C> } {
  return { ok: false, error: { codigo, mensaje } }
}
