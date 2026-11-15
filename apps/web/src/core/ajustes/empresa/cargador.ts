import type { ConfiguracionDeEmpresa, Respuesta } from '@capaz/shared';
import { llamar } from '../../../shared/api/herramientas.ts';

/** Cargador de la ruta: la lectura va por la herramienta, sin librería de caché. */
export function cargarConfiguracion(): Promise<Respuesta<ConfiguracionDeEmpresa>> {
  return llamar('empresa_ver_configuracion', {});
}
