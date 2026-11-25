// Catálogo único de códigos de error (regla 20 del plan de construcción). Los nombres son los de
// Cotizín para poder portar herramientas y pruebas sin renombrar. El estado HTTP solo sirve a los
// registros y a quien no mira el cuerpo; el cliente web decide por `codigo`.
export const CODIGOS = {
  // Herramientas
  herramienta_desconocida: 404,
  argumentos_invalidos: 400,
  argumento_prohibido: 400,
  sin_permiso: 403,
  confirmacion_vencida: 409,
  confirmacion_invalida: 400,
  confirmacion_no_coincide: 409,
  confirmacion_desactualizada: 409,
  confirmacion_ya_usada: 409,
  confirmacion_solo_ui: 403,
  // Transporte
  origen_invalido: 403,
  solicitud_invalida: 400,
  solicitud_muy_grande: 413,
  sin_conexion: 503,
  demasiados_intentos: 429,
  // Identidad, empresa y módulos
  no_autenticado: 401,
  sin_empresa: 403,
  modulo_no_disponible: 403,
  modulo_solo_lectura: 403,
  // Generales
  no_encontrado: 404,
  conflicto: 409,
  requiere_aprobacion: 409,
  error_interno: 500,
  // Modelos de IA fuera del turno del asistente (p. ej. el dictado por audio). Mismos nombres que los motivos del asistente.
  apagado: 503,
  modelo_no_disponible: 503,
  tope_mensual: 429,
} as const;

export type Codigo = keyof typeof CODIGOS;

export const esCodigo = (valor: unknown): valor is Codigo =>
  typeof valor === 'string' && Object.hasOwn(CODIGOS, valor);

export const estadoHttp = (codigo: Codigo): number => CODIGOS[codigo];

/** Estado HTTP → código del catálogo, para convertir excepciones de la plataforma. */
export function codigoDeEstado(estado: number): Codigo {
  switch (estado) {
    case 400:
    case 422:
      return 'solicitud_invalida';
    case 401:
      return 'no_autenticado';
    case 403:
      return 'sin_permiso';
    case 404:
      return 'no_encontrado';
    case 409:
      return 'conflicto';
    case 413:
      return 'solicitud_muy_grande';
    case 429:
      return 'demasiados_intentos';
    default:
      return 'error_interno';
  }
}
