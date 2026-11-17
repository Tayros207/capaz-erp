import type { SugerenciaDeCaptura } from '@capaz/shared';
import type { ArgsEditables } from '../logica-tarjeta.ts';

/** Lo que recibe el formulario de cada herramienta: los argumentos vivos y cómo cambiarlos. */
export type PropsDeFormulario = {
  args: ArgsEditables;
  sugerencias: readonly SugerenciaDeCaptura[];
  alCambiar: (args: ArgsEditables) => void;
  /** El formulario avisa si lo que hay escrito no se puede convertir en argumentos válidos. */
  alInvalidar: (invalido: boolean) => void;
  deshabilitado: boolean;
};
