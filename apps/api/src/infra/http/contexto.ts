import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { AccesoDeModulo } from '@capaz/shared';
import type { NextFunction, Request, Response } from 'express';

// Contexto de la petición en curso. El middleware lo crea con `requestId`; el guardia de identidad
// (fase 3a) completa empresa, usuario, rol y permisos desde la SESIÓN, nunca desde la petición.

export type CanalDeLlamada = 'ui' | 'agente' | 'mcp' | 'sistema';

export type ContextoDePeticion = {
  requestId: string;
  empresaId: string | null;
  usuarioId: string | null;
  rol: string | null;
  permisos: readonly string[];
  modulos: readonly AccesoDeModulo[];
  canal: CanalDeLlamada;
};

const almacen = new AsyncLocalStorage<ContextoDePeticion>();

export const contextoActual = (): ContextoDePeticion | undefined => almacen.getStore();

export function crearContexto(requestId: string): ContextoDePeticion {
  return {
    requestId,
    empresaId: null,
    usuarioId: null,
    rol: null,
    permisos: [],
    modulos: [],
    canal: 'ui',
  };
}

export const conContexto = <T>(ctx: ContextoDePeticion, fn: () => T): T => almacen.run(ctx, fn);

const ID_VALIDO = /^[A-Za-z0-9._-]{8,64}$/;

/** Acepta el `x-request-id` del cliente solo si es inocuo para los registros; si no, genera uno. */
export function idDePeticion(cabecera: string | string[] | undefined): string {
  const valor = Array.isArray(cabecera) ? cabecera[0] : cabecera;
  return valor && ID_VALIDO.test(valor) ? valor : randomUUID();
}

export function middlewareDeContexto(req: Request, res: Response, next: NextFunction): void {
  const id = idDePeticion(req.headers['x-request-id']);
  res.setHeader('x-request-id', id);
  conContexto(crearContexto(id), next);
}
