import { AsyncLocalStorage } from 'node:async_hooks';
import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';

// La API de servidor de Better Auth (`auth.api.*`) exige la sesión de quien actúa: lee la cookie de
// las cabeceras de la petición. El contexto de las herramientas no las lleva (y no debe: empresa y
// permisos salen de la sesión ya validada por el guardia), así que este módulo guarda las cabeceras
// de la petición EN CURSO en su propio almacén, visible solo para el servicio de miembros. Fuera de
// una petición (reglas automáticas, tareas) no hay cabeceras y esas operaciones no se pueden hacer.

const almacen = new AsyncLocalStorage<Headers>();

export const cabecerasDeLaPeticion = (): Headers | undefined => almacen.getStore();

export function middlewareDeCabeceras(req: Request, _res: Response, next: NextFunction): void {
  almacen.run(fromNodeHeaders(req.headers), next);
}
