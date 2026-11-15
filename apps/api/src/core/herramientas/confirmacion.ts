import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Confirmación en dos pasos de las herramientas críticas. El modelo pide; la app pregunta; la
// persona confirma; y la app reenvía el token. El token va firmado y ligado a la herramienta, a
// los argumentos, a la persona, a la empresa y al estado sobre el que se pidió. (Portado de Cotizín.)

export const TTL_CONFIRMACION_SEGUNDOS = 120;

export type CargaDeToken = {
  herramienta: string;
  /** SHA-256 de los argumentos, en JSON canónico. */
  hashArgs: string;
  /** Huella del estado sobre el que se pidió confirmar. */
  huella: string;
  usuarioId: string;
  empresaId: string;
  /** Identificador de un solo uso. */
  jti: string;
  /** Vencimiento, en segundos desde 1970. */
  exp: number;
};

/** JSON con las llaves ordenadas: el mismo contenido da siempre el mismo texto. */
export function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

export function hashCanonico(valor: unknown): string {
  return createHash('sha256').update(canonico(valor)).digest('hex');
}

function firmar(cuerpo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpo).digest('base64url');
}

/** `base64url(carga).firma`, con HMAC-SHA256. */
export function crearToken(carga: CargaDeToken, secreto: string): string {
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString('base64url');
  return `${cuerpo}.${firmar(cuerpo, secreto)}`;
}

export type VerificacionDeToken =
  | { ok: true; carga: CargaDeToken }
  | { ok: false; motivo: 'malformado' | 'firma' | 'vencido' };

function esCarga(valor: unknown): valor is CargaDeToken {
  if (valor === null || typeof valor !== 'object') return false;
  const v = valor as Record<string, unknown>;
  return (
    ['herramienta', 'hashArgs', 'huella', 'usuarioId', 'empresaId', 'jti'].every((k) => typeof v[k] === 'string') &&
    typeof v.exp === 'number'
  );
}

/** Comprueba forma, firma (en tiempo constante) y vencimiento; no compara contra la llamada. */
export function verificarToken(token: string, secreto: string, ahoraEnSegundos: number): VerificacionDeToken {
  const partes = token.split('.');
  const [cuerpo, firma] = partes;
  if (partes.length !== 2 || !cuerpo || !firma) return { ok: false, motivo: 'malformado' };
  const esperada = Buffer.from(firmar(cuerpo, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) {
    return { ok: false, motivo: 'firma' };
  }
  let carga: unknown;
  try {
    carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, motivo: 'malformado' };
  }
  if (!esCarga(carga)) return { ok: false, motivo: 'malformado' };
  return ahoraEnSegundos >= carga.exp ? { ok: false, motivo: 'vencido' } : { ok: true, carga };
}
