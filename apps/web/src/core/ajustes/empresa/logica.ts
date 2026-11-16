// Lógica pura de la pantalla «Empresa»: sin React ni red.

/** Zonas horarias que ofrece el selector: las de Perú y vecinos primero, luego todas las del sistema. */
const COMUNES = ['America/Lima', 'America/Bogota', 'America/Guayaquil', 'America/La_Paz', 'America/Santiago', 'America/Mexico_City', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/New_York', 'Europe/Madrid', 'UTC'];

export function zonasDisponibles(actual: string, todas: readonly string[] = zonasDelSistema()): string[] {
  const resto = todas.filter((z) => !COMUNES.includes(z));
  const lista = [...COMUNES.filter((z) => todas.length === 0 || todas.includes(z) || z === actual), ...resto];
  return lista.includes(actual) ? lista : [actual, ...lista];
}

function zonasDelSistema(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

/** Los argumentos de `empresa_actualizar_configuracion`, o nulo si no cambió nada. */
export function cambiosDeZona(actual: string, elegida: string): { zonaHoraria: string } | null {
  return elegida.trim() === '' || elegida === actual ? null : { zonaHoraria: elegida };
}

const MENSAJES: Record<string, string> = {
  sin_permiso: 'No tienes permiso para cambiar la configuración de la empresa.',
  confirmacion_ya_usada: 'Esa confirmación ya se usó. Vuelve a intentarlo.',
  confirmacion_desactualizada: 'La configuración cambió mientras decidías. Revisa y vuelve a intentarlo.',
  confirmacion_vencida: 'La confirmación venció. Vuelve a intentarlo.',
};

/** Los rechazos conocidos se traducen; el resto (por ejemplo, un RUC inválido) muestra el mensaje del servidor. */
export function mensajeDeGuardado(codigo: string, mensajeDelServidor: string): string {
  return MENSAJES[codigo] ?? mensajeDelServidor;
}
