import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// Validación de destinos de los webhooks de salida (SSRF). Solo https, sin credenciales en la URL, y el nombre
// se resuelve ANTES de enviar: si cualquier dirección es privada, de bucle local, de enlace local, de metadatos
// o reservada, se rechaza. El envío se conecta a la dirección ya validada (sin volver a resolver).

export class DestinoNoPermitido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'DestinoNoPermitido';
  }
}

export type Resolver = (host: string) => Promise<string[]>;
export const resolverReal: Resolver = async (host) => (await dnsLookup(host, { all: true, verbatim: true })).map((r) => r.address);

const enteros = (ip: string) => ip.split('.').map(Number) as [number, number, number, number];

/** IPv4 pública (no privada, ni bucle, ni enlace local, ni CGNAT, ni reservada, ni multicast). */
export function ipv4Publica(ip: string): boolean {
  const [a, b, c] = enteros(ip);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return a < 224;
}

function ipv6ComoBytes(ip: string): number[] | null {
  let texto = ip.toLowerCase().replace(/%.*$/, '');
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(texto);
  if (v4) {
    const [a, b, c, d] = enteros(v4[1]!);
    texto = texto.replace(v4[1]!, `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`);
  }
  const [izq = '', der, ...resto] = texto.split('::');
  if (resto.length) return null;
  const grupos = (s: string) => (s ? s.split(':') : []);
  const i = grupos(izq);
  const d = der === undefined ? [] : grupos(der);
  const relleno = der === undefined ? 0 : 8 - i.length - d.length;
  if (relleno < 0 || (der === undefined && i.length !== 8)) return null;
  const todos = [...i, ...Array<string>(relleno).fill('0'), ...d].map((g) => parseInt(g, 16));
  if (todos.length !== 8 || todos.some((g) => Number.isNaN(g) || g > 0xffff)) return null;
  return todos.flatMap((g) => [g >> 8, g & 255]);
}

export function ipv6Publica(ip: string): boolean {
  const b = ipv6ComoBytes(ip);
  if (!b) return false;
  const inicio = b.slice(0, 10).every((x) => x === 0);
  if (inicio && b[10] === 0 && b[11] === 0) return false; // ::, ::1 y compatibles con IPv4
  const incrustada = `${b[12]}.${b[13]}.${b[14]}.${b[15]}`;
  if (inicio && b[10] === 0xff && b[11] === 0xff) return ipv4Publica(incrustada); // ::ffff:a.b.c.d
  if (b.slice(0, 12).every((x, i) => x === [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0][i])) return ipv4Publica(incrustada); // NAT64
  if ((b[0]! & 0xfe) === 0xfc) return false; // fc00::/7
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0x80) return false; // fe80::/10
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0xc0) return false; // fec0::/10
  if (b[0] === 0xff) return false; // multicast
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return false; // documentación
  if (b[0] === 0x20 && b[1] === 0x02) return ipv4Publica(`${b[2]}.${b[3]}.${b[4]}.${b[5]}`); // 6to4
  return true;
}

export const direccionPublica = (ip: string): boolean => (isIP(ip) === 4 ? ipv4Publica(ip) : isIP(ip) === 6 ? ipv6Publica(ip) : false);

export type OpcionesDeDestino = { permitirLocales: boolean; resolver?: Resolver };
export type DestinoValido = { url: URL; direccion: string; familia: 4 | 6 };

/** Valida la forma de la URL (sin red). Con `permitirLocales` (solo pruebas) acepta http. */
export function validarUrl(texto: string, permitirLocales: boolean): URL {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new DestinoNoPermitido('La dirección no es una URL válida.');
  }
  if (url.protocol !== 'https:' && !(permitirLocales && url.protocol === 'http:')) throw new DestinoNoPermitido('La dirección debe empezar con https://.');
  if (url.username || url.password) throw new DestinoNoPermitido('La dirección no puede llevar usuario ni contraseña.');
  if (!url.hostname) throw new DestinoNoPermitido('La dirección no tiene servidor.');
  return url;
}

/** Valida la URL y resuelve el nombre: toda dirección resuelta debe ser pública (salvo `permitirLocales`). */
export async function resolverDestino(texto: string, o: OpcionesDeDestino): Promise<DestinoValido> {
  const url = validarUrl(texto, o.permitirLocales);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const direcciones = isIP(host) ? [host] : await (o.resolver ?? resolverReal)(host).catch(() => []);
  if (direcciones.length === 0) throw new DestinoNoPermitido('No se pudo resolver el servidor de la dirección.');
  if (!o.permitirLocales && !direcciones.every(direccionPublica)) throw new DestinoNoPermitido('La dirección apunta a una red privada o local: no se permite.');
  const direccion = direcciones[0]!;
  return { url, direccion, familia: isIP(direccion) === 6 ? 6 : 4 };
}
