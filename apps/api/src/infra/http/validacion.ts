import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ErrorDeNegocio } from './error-de-negocio.js';

type Problema = { message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> };

/** «Dato inválido en «a.b».» (solo el campo; el texto del validador puede traer el valor). */
export function mensajeDeValidacion(problemas: readonly Problema[]): string {
  const ruta = problemas[0]?.path?.map((s) => String(typeof s === 'object' ? s.key : s)).join('.');
  return ruta ? `Dato inválido en «${ruta}».` : 'Los datos enviados no son válidos.';
}

/** Pipe global para las rutas REST con `@Body({ schema })`. Las herramientas validan en `ejecutar()`. */
export const crearPipeDeValidacion = () =>
  new StandardSchemaValidationPipe({
    exceptionFactory: (problemas) =>
      new ErrorDeNegocio('argumentos_invalidos', mensajeDeValidacion(problemas)),
  });
