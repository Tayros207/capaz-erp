// Tipos y ayudantes comunes del cuadro por partes. Las herramientas y los repositorios no importan del motor (R22): lo que
// necesitan de él pasa por los archivos `cuadro-*.ts` de esta carpeta.
import type { Aviso, Candidata } from '@capaz/shared';
import type { Cuadro } from './motor/costeo/tipos/borrador.js';

export type { Cuadro, Emision } from './motor/costeo/tipos/borrador.js';
export type { ConfiguracionEmpresa } from './motor/base/empresa.js';
export type { Linea } from './motor/costeo/tipos/cotizacion.js';
export type { Plantilla } from './motor/costeo/constantes/plantillas.js';

export type RechazoDeCuadro = { ok: false; codigo: 'argumentos_invalidos' | 'conflicto' | 'no_encontrado'; mensaje: string; candidatas?: Candidata[] };
/** Lo que deja un comando aplicado al cuadro: el cuadro nuevo, avisos y la fila afectada. */
export type MutacionDeCuadro = { ok: true; cuadro: Cuadro; avisos: Aviso[]; linea?: Candidata };
export type ResultadoDeComando = MutacionDeCuadro | RechazoDeCuadro;

export const rechazarCuadro = (codigo: RechazoDeCuadro['codigo'], mensaje: string, candidatas?: Candidata[]): RechazoDeCuadro =>
  candidatas ? { ok: false, codigo, mensaje, candidatas } : { ok: false, codigo, mensaje };

export const avisoComercial = (codigo: string, mensaje: string): Aviso => ({ codigo, mensaje, nivel: 'comercial' });
export const avisoInterno = (codigo: string, mensaje: string): Aviso => ({ codigo, mensaje, nivel: 'interno' });
