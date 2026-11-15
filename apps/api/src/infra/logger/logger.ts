import type { LoggerService } from '@nestjs/common';
import pino, { type DestinationStream, type Logger } from 'pino';

// Registros en JSON (una línea por evento). Nunca se registran cuerpos ni cabeceras; además, por
// defensa en profundidad, se ocultan los campos delicados si alguien los agrega por error.

export const LOGGER = Symbol('LOGGER');

const CAMPOS_OCULTOS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'contrasena',
  'token',
  'secret',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.contrasena',
  '*.token',
  '*.secret',
];

export function crearLogger(
  entorno: 'development' | 'test' | 'production',
  salida?: DestinationStream,
): Logger {
  return pino(
    {
      level: entorno === 'test' ? 'silent' : 'info',
      redact: { paths: CAMPOS_OCULTOS, censor: '[oculto]' },
      base: { servicio: 'capaz-api' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    salida,
  );
}

/** Adaptador para que los registros internos de NestJS salgan por el mismo logger. */
export class LoggerDeNest implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(mensaje: unknown, contexto?: string) {
    this.logger.info({ contexto }, String(mensaje));
  }
  error(mensaje: unknown, ...resto: unknown[]) {
    this.logger.error({ detalle: resto.map(String) }, String(mensaje));
  }
  warn(mensaje: unknown, contexto?: string) {
    this.logger.warn({ contexto }, String(mensaje));
  }
  debug(mensaje: unknown, contexto?: string) {
    this.logger.debug({ contexto }, String(mensaje));
  }
  verbose(mensaje: unknown, contexto?: string) {
    this.logger.trace({ contexto }, String(mensaje));
  }
  fatal(mensaje: unknown, contexto?: string) {
    this.logger.fatal({ contexto }, String(mensaje));
  }
}
