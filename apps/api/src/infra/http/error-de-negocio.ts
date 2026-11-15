import type { Codigo } from '@capaz/shared';

/** Mensajes de pantalla por código, en español. Nunca incluyen detalles internos. */
export const MENSAJES: Record<Codigo, string> = {
  herramienta_desconocida: 'Esa operación no existe.',
  argumentos_invalidos: 'Los datos enviados no son válidos.',
  argumento_prohibido: 'Se envió un dato que solo el sistema puede poner.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  confirmacion_vencida: 'La confirmación venció: pídela de nuevo.',
  confirmacion_invalida: 'La confirmación no es válida.',
  confirmacion_no_coincide: 'La confirmación es de otra acción, otros datos u otra persona.',
  confirmacion_desactualizada: 'Los datos cambiaron después de pedir la confirmación: pídela de nuevo.',
  confirmacion_ya_usada: 'Esta confirmación ya se usó.',
  confirmacion_solo_ui: 'Confirma esta acción desde la pantalla.',
  origen_invalido: 'La solicitud debe venir desde Capaz.',
  solicitud_invalida: 'La solicitud no es válida.',
  solicitud_muy_grande: 'La solicitud es demasiado grande.',
  sin_conexion: 'No se pudo hablar con el servidor. Revisa la conexión e inténtalo de nuevo.',
  demasiados_intentos: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  no_autenticado: 'Inicia sesión para continuar.',
  sin_empresa: 'Primero elige o crea una empresa.',
  modulo_no_disponible: 'Tu empresa no tiene este módulo disponible.',
  modulo_solo_lectura: 'Este módulo está en solo lectura.',
  no_encontrado: 'No se encontró lo que buscas.',
  conflicto: 'Esa operación choca con el estado actual.',
  error_interno: 'Ocurrió un error inesperado. No se aplicó ningún cambio.',
};

/** Error de negocio con código del catálogo: guardias, pipes y servicios lo lanzan; el filtro lo traduce. */
export class ErrorDeNegocio extends Error {
  constructor(
    readonly codigo: Codigo,
    mensaje: string = MENSAJES[codigo],
  ) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
  }
}
