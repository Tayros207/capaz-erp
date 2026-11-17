// Reglas del taller (formatos, máquinas, tarifas, ítems) que no dependen de la base. Puras.
// Las medidas y los costos son texto decimal: aquí no se convierten a `number`.
import { formatoPliegoSchema, insumoTarifaSchema, itemDeEmpresaSchema, maquinaSchema } from './motor/base/empresa.js';
import type { FormatoPliego, InsumoTarifa, ItemDeEmpresa, Maquina } from './motor/base/empresa.js';
import type { Rechazo } from './precios.js';

export type Valido = { ok: true } | Rechazo;
const BIEN: Valido = { ok: true };
const ID_DE_PASO = 'validando';

function primerError(r: { success: boolean; error?: { issues: Array<{ message: string }> } }): Valido {
  if (r.success) return BIEN;
  return { ok: false, codigo: 'argumentos_invalidos', mensaje: r.error?.issues[0]?.message ?? 'Los datos no son válidos.' };
}

export type DatosDeFormato = { nombre: string; anchoCm: string; altoCm: string; tipo: 'madre' | 'maquina' };
export type DatosDeMaquina = {
  nombre: string;
  formatoMaxAnchoCm: string;
  formatoMaxAltoCm: string;
  pinzaCm: string;
  sangradoCm: string;
  calleCm: string;
  etapas: Array<{ nombre: string; mermaPct: string; arranque: string }>;
};
export type DatosDeTarifa = {
  factor: InsumoTarifa['factor'];
  nombre: string;
  unidad: string;
  costoUnitario: string;
  escalaPorDefecto: InsumoTarifa['escalaPorDefecto'];
};
export type DatosDeItem = { nombre: string; factor: ItemDeEmpresa['factor']; despuesDe: ItemDeEmpresa['despuesDe']; fija: boolean };

export const validarFormato = (d: DatosDeFormato): Valido =>
  primerError(formatoPliegoSchema.safeParse({ id: ID_DE_PASO, nombre: d.nombre, anchoCm: d.anchoCm, altoCm: d.altoCm, tipo: d.tipo, activo: true }));

export const validarMaquina = (d: DatosDeMaquina): Valido =>
  primerError(
    maquinaSchema.safeParse({
      id: ID_DE_PASO,
      nombre: d.nombre,
      formatoMaximo: { anchoCm: d.formatoMaxAnchoCm, altoCm: d.formatoMaxAltoCm },
      pinzaCm: d.pinzaCm,
      sangradoCm: d.sangradoCm,
      calleCm: d.calleCm,
      etapas: d.etapas,
      activo: true,
    }),
  );

export const validarTarifa = (d: DatosDeTarifa): Valido =>
  primerError(insumoTarifaSchema.safeParse({ id: ID_DE_PASO, factor: d.factor, nombre: d.nombre, unidad: d.unidad, costoUnitario: d.costoUnitario, escalaPorDefecto: d.escalaPorDefecto, activo: true }));
export const validarItem = (d: DatosDeItem): Valido =>
  primerError(itemDeEmpresaSchema.safeParse({ id: ID_DE_PASO, nombre: d.nombre, factor: d.factor, despuesDe: d.despuesDe, fija: d.fija, activo: true }));

/** `'0.4500'` → `'0.45'`, `'70.00'` → `'70'`: solo para comparar y mostrar; no es aritmética. */
export function limpiarDecimal(t: string): string {
  return t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
}

export const mismoDecimal = (a: string, b: string): boolean => limpiarDecimal(a) === limpiarDecimal(b);

/** «Cambiarás el costo de «Papel»: 0.45 → 0.52». Sin cambio de costo, solo avisa de los datos. */
export function resumenDeCambioDeTarifa(nombre: string, antes: string, despues: string): string {
  if (mismoDecimal(antes, despues)) return `Cambiarás los datos de «${nombre}».`;
  return `Cambiarás el costo de «${nombre}»: ${limpiarDecimal(antes)} → ${limpiarDecimal(despues)}. Las cotizaciones nuevas usarán este costo.`;
}
