// Qué conversación del asistente se estaba usando, para reabrirla al volver (recargar la página, volver mañana). El chat ya está guardado en
// el servidor; aquí solo se recuerda CUÁL era. Es una comodidad de este navegador: si el almacenamiento no sirve (modo privado, bloqueado),
// el panel funciona igual y empieza una conversación nueva. Lógica pura, sin React.

export const CLAVE_DE_CONVERSACION_RECORDADA = 'capaz-agente-conversacion';
/** Pasado este tiempo sin usarla, se empieza una conversación nueva (la anterior sigue en el historial). */
export const HORAS_PARA_RECORDAR = 12;

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const FORMA_DE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El almacenamiento del navegador, o `null` si no se puede usar (puede lanzar al solo tocarlo). */
export function almacenDelNavegador(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** La conversación que se estaba usando, si fue hace poco y lo guardado tiene forma de identificador. */
export function leerConversacionRecordada(almacen: Almacen | null, ahoraMs: number): string | null {
  try {
    const crudo = almacen?.getItem(CLAVE_DE_CONVERSACION_RECORDADA);
    if (!crudo) return null;
    const dato: unknown = JSON.parse(crudo);
    if (dato === null || typeof dato !== 'object') return null;
    const { id, en } = dato as { id?: unknown; en?: unknown };
    if (typeof id !== 'string' || !FORMA_DE_ID.test(id) || typeof en !== 'number') return null;
    const horas = (ahoraMs - en) / 3_600_000;
    return horas >= 0 && horas <= HORAS_PARA_RECORDAR ? id : null;
  } catch {
    return null;
  }
}

export function recordarConversacion(almacen: Almacen | null, id: string, ahoraMs: number): void {
  try {
    if (FORMA_DE_ID.test(id)) almacen?.setItem(CLAVE_DE_CONVERSACION_RECORDADA, JSON.stringify({ id, en: ahoraMs }));
  } catch {
    // Sin almacenamiento no pasa nada: la conversación sigue guardada en el servidor.
  }
}

export function olvidarConversacion(almacen: Almacen | null): void {
  try {
    almacen?.removeItem(CLAVE_DE_CONVERSACION_RECORDADA);
  } catch {
    // Ídem.
  }
}
