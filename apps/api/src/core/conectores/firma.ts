import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Firmas y claves de API. Toda comparación de secretos es de tiempo constante.

export const hmacHex = (secreto: string, mensaje: string | Buffer): string => createHmac('sha256', secreto).update(mensaje).digest('hex');

export function iguales(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

/** Firma de un envío de salida: HMAC-SHA256 de `<marca>.<cuerpo>`, con el secreto del webhook. */
export const firmarEnvio = (secreto: string, marca: number, cuerpo: string): string => `sha256=${hmacHex(secreto, `${marca}.${cuerpo}`)}`;

export const hashDeClave = (clave: string): string => createHash('sha256').update(clave).digest('hex');

const PREFIJO = 'capaz_';
export const generarSecreto = (): string => randomBytes(32).toString('base64url');

/** `capaz_<43 caracteres>`: solo se ve al crearla; en la base queda su hash y los primeros caracteres. */
export function generarClaveDeApi(): { clave: string; hash: string; prefijo: string } {
  const clave = `${PREFIJO}${generarSecreto()}`;
  return { clave, hash: hashDeClave(clave), prefijo: clave.slice(0, PREFIJO.length + 6) };
}

export const pareceClaveDeApi = (c: string): boolean => /^capaz_[A-Za-z0-9_-]{43}$/.test(c);

/**
 * Firma opcional de un webhook de ENTRADA: `X-Capaz-Firma: sha256=<hex>`, HMAC-SHA256 del cuerpo con el
 * hash de la clave de API como secreto (el servidor solo guarda ese hash; quien envía lo calcula de su clave).
 */
export const firmaDeEntrada = (hash: string, cuerpo: string | Buffer): string => `sha256=${hmacHex(hash, cuerpo)}`;
