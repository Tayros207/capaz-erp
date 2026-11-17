// Un cuadro nuevo: las filas de la plantilla, la utilidad de la empresa y los ítems activos del taller (copiados).
import { cuadroInicial } from './motor/costeo/cuadro.js';
import { sincronizarFilas } from './motor/costeo/cuadro.js';
import { PLANTILLAS, type Plantilla } from './motor/costeo/constantes/plantillas.js';
import { MAX_ITEMS_DEL_CUADRO } from './motor/costeo/tipos/cuadro-directo.js';
import type { ItemDeEmpresa } from './motor/base/empresa.js';
import type { Cuadro, ConfiguracionEmpresa } from './cuadro-tipos.js';

export { PLANTILLAS };

/** Un ítem del taller tal como lo guarda la base. */
export type ItemDelTaller = { nombre: string; factor: string; despuesDe: string; fija: boolean };

const comoItem = (i: ItemDelTaller, n: number): ItemDeEmpresa => ({
  id: `taller-${n}`,
  nombre: i.nombre,
  factor: i.factor as ItemDeEmpresa['factor'],
  despuesDe: i.despuesDe as ItemDeEmpresa['despuesDe'],
  fija: i.fija,
  activo: true,
});

export type DatosDeInicio = { plantilla: Plantilla; producto?: string | undefined; cliente?: string | undefined };

/** El cuadro con el que nace una cotización por partes. El cuadro admite hasta `MAX_ITEMS_DEL_CUADRO` ítems: sobran los últimos. */
export function cuadroNuevo(datos: DatosDeInicio, config: ConfiguracionEmpresa, items: readonly ItemDelTaller[]): Cuadro {
  const propios = items.slice(0, MAX_ITEMS_DEL_CUADRO).map(comoItem);
  const base = cuadroInicial(datos.plantilla, { pct: config.utilidadPct, base: config.utilidadBase }, propios);
  const trabajo = { ...base.trabajo, producto: datos.producto ?? '', cliente: datos.cliente ?? '' };
  return sincronizarFilas({ ...base, trabajo }).cuadro;
}
