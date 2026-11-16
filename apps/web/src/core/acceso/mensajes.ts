import type { Codigo } from '@capaz/shared';

/** Dónde ocurrió el error: cambia el texto de algunos códigos. */
export type Situacion = 'iniciar' | 'registro' | 'empresa' | 'salir' | 'restablecer';

const GENERALES: Partial<Record<Codigo, string>> = {
  sin_conexion: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
  demasiados_intentos: 'Hiciste demasiados intentos. Espera un minuto y vuelve a probar.',
  origen_invalido: 'Esta página no está autorizada para entrar. Abre Capaz desde su dirección habitual.',
  solicitud_muy_grande: 'Lo que enviaste es demasiado grande.',
  sin_permiso: 'Tu cuenta no puede crear empresas. Pide a Capaz que la cree.',
  error_interno: 'Ocurrió un error de nuestro lado. Inténtalo de nuevo en unos minutos.',
};

const POR_SITUACION: Record<Situacion, Partial<Record<Codigo, string>>> = {
  iniciar: {
    no_autenticado: 'El correo o la contraseña no son correctos.',
    solicitud_invalida: 'Revisa el correo y la contraseña.',
    argumentos_invalidos: 'Revisa el correo y la contraseña.',
  },
  registro: {
    solicitud_invalida: 'No pudimos crear la cuenta. Revisa los datos; si ya te registraste, inicia sesión.',
    conflicto: 'Ya existe una cuenta con ese correo. Inicia sesión.',
    argumentos_invalidos: 'Revisa los datos e inténtalo de nuevo.',
  },
  empresa: {
    no_autenticado: 'Tu sesión terminó. Inicia sesión de nuevo.',
    argumentos_invalidos: 'Escribe un nombre de empresa de 2 a 80 letras.',
    sin_permiso: 'Tu cuenta aún no tiene empresa: acepta una invitación o pide a Capaz que la cree.',
    conflicto: 'Ya existe una empresa con ese nombre. Prueba con otro.',
  },
  restablecer: {
    solicitud_invalida: 'El enlace no sirve: ya se usó o venció. Pide a Capaz que te genere uno nuevo.',
    argumentos_invalidos: 'La contraseña debe tener entre 10 y 128 caracteres.',
  },
  salir: {},
};

/** Texto en español para el código del catálogo, según la pantalla. */
export function mensajeDeError(codigo: Codigo, situacion: Situacion): string {
  return POR_SITUACION[situacion][codigo] ?? GENERALES[codigo] ?? 'No pudimos completar la acción. Inténtalo de nuevo.';
}
