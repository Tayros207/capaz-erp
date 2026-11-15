import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifrado de credenciales (ADR-014 §3): AES-256-GCM con la clave maestra del entorno. El texto cifrado
// lleva su versión de clave, para poder rotarla: `v<versión>.<iv>.<etiqueta>.<cifrado>` (base64url).
// El contexto (`aad`) se autentica pero no se guarda: un secreto copiado a otra fila no se descifra.

export class CifradoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'CifradoInvalido';
  }
}

export type Claves = ReadonlyMap<number, Buffer>;

export class Cifrador {
  constructor(
    private readonly claves: Claves,
    readonly versionActual: number,
  ) {
    for (const [v, k] of claves) if (k.length !== 32) throw new CifradoInvalido(`La clave de la versión ${v} no mide 32 bytes.`);
    if (!claves.has(versionActual)) throw new CifradoInvalido(`Falta la clave de la versión ${versionActual}.`);
  }

  /** Desde la configuración: `CONEXIONES_CLAVE` (32 bytes en base64) y su versión. */
  static desdeConfig(c: { CONEXIONES_CLAVE?: string; CONEXIONES_CLAVE_VERSION: number }): Cifrador | null {
    if (!c.CONEXIONES_CLAVE) return null;
    return new Cifrador(new Map([[c.CONEXIONES_CLAVE_VERSION, Buffer.from(c.CONEXIONES_CLAVE, 'base64')]]), c.CONEXIONES_CLAVE_VERSION);
  }

  cifrar(texto: string, aad: string): { cifrado: string; version: number } {
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.claves.get(this.versionActual)!, iv);
    cifrador.setAAD(Buffer.from(aad));
    const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    const partes = [iv, cifrador.getAuthTag(), datos].map((b) => b.toString('base64url'));
    return { cifrado: `v${this.versionActual}.${partes.join('.')}`, version: this.versionActual };
  }

  descifrar(cifrado: string, aad: string): string {
    const partes = cifrado.split('.');
    const version = /^v(\d+)$/.exec(partes[0] ?? '')?.[1];
    if (partes.length !== 4 || !version) throw new CifradoInvalido('El dato cifrado no tiene un formato válido.');
    const clave = this.claves.get(Number(version));
    if (!clave) throw new CifradoInvalido(`No hay clave para la versión ${version}: la clave maestra se rotó.`);
    try {
      const [iv, etiqueta, datos] = partes.slice(1).map((p) => Buffer.from(p!, 'base64url')) as [Buffer, Buffer, Buffer];
      const d = createDecipheriv('aes-256-gcm', clave, iv);
      d.setAAD(Buffer.from(aad));
      d.setAuthTag(etiqueta);
      return Buffer.concat([d.update(datos), d.final()]).toString('utf8');
    } catch {
      throw new CifradoInvalido('No se pudo descifrar: la clave no corresponde o el dato fue alterado.');
    }
  }

  /** `true` si el dato quedó cifrado con una versión anterior y conviene volver a cifrarlo. */
  necesitaRotar(cifrado: string): boolean {
    return !cifrado.startsWith(`v${this.versionActual}.`);
  }
}
