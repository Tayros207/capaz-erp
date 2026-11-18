import { detectarPreguntaDePrecio, type EntradaDe } from '@capaz/shared';

// Lógica pura de la pantalla «¿Cuánto le cobramos?»: qué se busca según la dirección y a qué dirección lleva una pregunta dictada.

export type Busqueda = { clienteId?: string; clienteTexto?: string; texto: string };

export const RUTA_DE_PRECIOS = '/precios';

/** `/precios?cliente=…&q=…`: lo que se abre cuando el dictado o la paleta reconocen la pregunta de precio. */
export function rutaDePrecios(p: { clienteTexto?: string; productoTexto?: string; clienteId?: string; clienteNombre?: string }): string {
  const q = new URLSearchParams();
  if (p.clienteId) {
    q.set('clienteId', p.clienteId);
    if (p.clienteNombre) q.set('nombre', p.clienteNombre);
  } else if (p.clienteTexto) q.set('cliente', p.clienteTexto);
  if (p.productoTexto) q.set('q', p.productoTexto);
  const texto = q.toString();
  return texto ? `${RUTA_DE_PRECIOS}?${texto}` : RUTA_DE_PRECIOS;
}

/** Si el texto es una pregunta de precio («cuánto le cobramos a Cristina por las cajas»), a dónde llevarla; si no, `null`. */
export function destinoDePreguntaDePrecio(texto: string): string | null {
  const p = detectarPreguntaDePrecio(texto);
  return p ? rutaDePrecios(p) : null;
}

export type DesdeLaDireccion = { clienteId: string; clienteNombre: string; clienteTexto: string; texto: string };

export function leerDireccion(params: URLSearchParams): DesdeLaDireccion {
  const leer = (k: string) => (params.get(k) ?? '').trim();
  return { clienteId: leer('clienteId'), clienteNombre: leer('nombre'), clienteTexto: leer('cliente'), texto: leer('q') };
}

/** La búsqueda que se envía, o `null` mientras falte el producto (sin él no hay nada que preguntar). */
export function busquedaDe(d: { clienteId?: string; clienteTexto?: string; texto: string }): Busqueda | null {
  const texto = d.texto.trim();
  if (texto.length < 2) return null;
  return { ...(d.clienteId ? { clienteId: d.clienteId } : d.clienteTexto?.trim() ? { clienteTexto: d.clienteTexto.trim() } : {}), texto };
}

export const argumentosDe = (b: Busqueda, limite = 15): EntradaDe<'precio_anterior_consultar'> => ({ ...b, limite });
