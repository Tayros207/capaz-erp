import { NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA } from '@capaz/shared';
import type { TipoDeMovimiento } from './movimiento.js';

// Catálogos con los que arranca una empresa (regla 10 de la ficha). Nombres propios de Capaz.

export const CUENTA_POR_DEFECTO = { nombre: 'Caja', tipo: 'caja' } as const;

export const CATEGORIAS_POR_DEFECTO: ReadonlyArray<{ nombre: string; tipo: TipoDeMovimiento }> = [
  { nombre: 'Ventas', tipo: 'ingreso' },
  { nombre: 'Cobros', tipo: 'ingreso' },
  { nombre: 'Otros ingresos', tipo: 'ingreso' },
  { nombre: 'Compras', tipo: 'egreso' },
  { nombre: 'Pagos', tipo: 'egreso' },
  { nombre: 'Servicios', tipo: 'egreso' },
  { nombre: 'Sueldos', tipo: 'egreso' },
  { nombre: 'Otros egresos', tipo: 'egreso' },
  // Reservada: la usan las dos patas de una transferencia entre cuentas (no se edita ni se archiva).
  { nombre: NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA, tipo: 'ingreso' },
  { nombre: NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA, tipo: 'egreso' },
];

/** Categoría de un abono: «Cobros» si entra dinero, «Pagos» si sale. */
export const categoriaDeAbono = (tipo: TipoDeMovimiento): string => (tipo === 'ingreso' ? 'Cobros' : 'Pagos');

/** Nombre para comparar: sin tildes, en minúsculas y con espacios simples. */
export function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
