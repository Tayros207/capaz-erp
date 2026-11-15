import { Catch, HttpException, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { codigoDeEstado, estadoHttp, rechazo, type Codigo } from '@capaz/shared';
import type { Response } from 'express';
import type { Logger } from 'pino';
import { LOGGER } from '../logger/logger.js';
import { contextoActual } from './contexto.js';
import { ErrorDeNegocio, MENSAJES } from './error-de-negocio.js';

type Traduccion = { codigo: Codigo; mensaje: string };

function traducir(excepcion: unknown): Traduccion {
  if (excepcion instanceof ErrorDeNegocio) return { codigo: excepcion.codigo, mensaje: excepcion.message };
  if (excepcion instanceof HttpException) {
    const codigo = codigoDeEstado(excepcion.getStatus());
    return { codigo, mensaje: MENSAJES[codigo] };
  }
  return { codigo: 'error_interno', mensaje: MENSAJES.error_interno };
}

/**
 * Convierte cualquier excepción en la respuesta estándar. Nunca devuelve trazas ni mensajes
 * internos: lo que se sabe del fallo queda en los registros, con el `requestId`.
 */
@Catch()
export class FiltroDeErrores implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const { codigo, mensaje } = traducir(excepcion);
    if (codigo === 'error_interno') {
      this.logger.error({ err: excepcion, requestId: contextoActual()?.requestId }, 'Error no controlado');
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(estadoHttp(codigo))
      .json(rechazo(codigo, mensaje));
  }
}
