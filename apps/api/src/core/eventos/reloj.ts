/** Fuente de la hora, inyectable para que las pruebas controlen el tiempo. */
export type Reloj = () => Date;
export const RELOJ = Symbol('RELOJ');
