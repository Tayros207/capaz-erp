import { rechazo, type Respuesta } from '@capaz/shared';
import type { HerramientaRegistrada } from '../herramientas/tipos.js';
import { esquemaParaElModelo } from './esquema-limpio.js';
import type { EstadoDelTurno } from './tipos-del-turno.js';

// Para que un modelo que se equivoca se corrija a la primera, o pare. Al fallar por argumentos se le devuelve lo que SÍ llegó y,
// la primera vez, el esquema completo (así no gasta otra ronda en describir la herramienta). Al tercer fallo seguido de la misma
// herramienta ya no se ejecuta: sin este freno, un modelo repetía la misma llamada hasta agotar el turno.

export const MAXIMO_DE_FALLOS_SEGUIDOS = 3;
const CODIGOS = new Set(['argumentos_invalidos', 'argumento_prohibido']);

/** El rechazo si esta herramienta ya falló demasiadas veces en el turno; `null` si se puede intentar. */
export function frenoPorFallos(estado: EstadoDelTurno, nombre: string): Respuesta<unknown> | null {
  if ((estado.fallosDeArgumentos.get(nombre) ?? 0) < MAXIMO_DE_FALLOS_SEGUIDOS) return null;
  return rechazo('conflicto', `«${nombre}» ya falló ${MAXIMO_DE_FALLOS_SEGUIDOS} veces en este turno. NO la vuelvas a llamar: dile a la persona, en palabras sencillas, qué no pudiste hacer y que puede hacerlo desde la pantalla.`);
}

/** Lo que quedó como texto aunque empieza como lista u objeto: la reparación no pudo leerlo. */
function textosQueDebianSerListas(args: unknown): string[] {
  if (args === null || typeof args !== 'object') return [];
  return Object.entries(args).filter(([, v]) => typeof v === 'string' && /^\s*(\[\s*\{|\{\s*")/.test(v)).map(([k]) => k);
}

/** Cuenta los fallos seguidos y añade al error lo que ayuda a corregirlo. */
export function conAyuda(estado: EstadoDelTurno, h: HerramientaRegistrada, args: unknown, r: Respuesta<unknown>): Respuesta<unknown> {
  if (r.ok || !('error' in r) || !CODIGOS.has(r.error.codigo)) {
    if (r.ok) estado.fallosDeArgumentos.delete(h.nombre);
    return r;
  }
  const previos = estado.fallosDeArgumentos.get(h.nombre) ?? 0;
  estado.fallosDeArgumentos.set(h.nombre, previos + 1);
  const recibido = args !== null && typeof args === 'object' ? Object.keys(args) : [];
  const comoTexto = textosQueDebianSerListas(args);
  const ayuda = {
    recibido,
    ...(comoTexto.length > 0 && { pista: `${comoTexto.map((k) => `«${k}»`).join(', ')} llegó como TEXTO cortado o mal escrito. Mándalo como lista u objeto JSON de verdad, sin comillas alrededor.` }),
    ...(previos === 0 && { argumentosEsperados: esquemaParaElModelo(h.nombre, h.entrada) }),
  };
  return { ...r, error: { ...r.error, ...ayuda } };
}
