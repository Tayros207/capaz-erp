// La semilla de Perú del motor vuelta filas del taller. Los valores son ILUSTRATIVOS: las tablas no tienen columna
// de nota, así que la pantalla lo avisa. Pura.
import { semillaEsPE } from './motor/base/semilla-es-pe.js';
import { normalizarNombre } from './lista.js';
import type { DatosDeFormato, DatosDeItem, DatosDeMaquina, DatosDeTarifa } from './taller.js';

type ConNombre<T> = T & { nombreNormalizado: string };
const conNombre = <T extends { nombre: string }>(d: T): ConNombre<T> => ({ ...d, nombreNormalizado: normalizarNombre(d.nombre) });

export type SemillaDelTaller = {
  formatos: Array<ConNombre<DatosDeFormato>>;
  maquinas: Array<ConNombre<DatosDeMaquina>>;
  /** `archivada`: la tarifa inactiva de la semilla entra ya archivada. */
  tarifas: Array<ConNombre<DatosDeTarifa> & { archivada: boolean }>;
  items: Array<ConNombre<DatosDeItem> & { posicion: number }>;
};

export function semillaDelTaller(): SemillaDelTaller {
  const s = semillaEsPE;
  return {
    formatos: s.formatos.map((f) => conNombre({ nombre: f.nombre, anchoCm: f.anchoCm, altoCm: f.altoCm, tipo: f.tipo })),
    maquinas: s.maquinas.map((m) =>
      conNombre({
        nombre: m.nombre,
        formatoMaxAnchoCm: m.formatoMaximo.anchoCm,
        formatoMaxAltoCm: m.formatoMaximo.altoCm,
        pinzaCm: m.pinzaCm,
        sangradoCm: m.sangradoCm,
        calleCm: m.calleCm,
        etapas: m.etapas.map((e) => ({ nombre: e.nombre, mermaPct: e.mermaPct, arranque: e.arranque })),
      }),
    ),
    tarifas: s.insumos.map((i) => ({ ...conNombre({ factor: i.factor, nombre: i.nombre, unidad: i.unidad, costoUnitario: i.costoUnitario, escalaPorDefecto: i.escalaPorDefecto }), archivada: !i.activo })),
    items: s.items.map((it, posicion) => ({ ...conNombre({ nombre: it.nombre, factor: it.factor, despuesDe: it.despuesDe, fija: it.fija }), posicion })),
  };
}
