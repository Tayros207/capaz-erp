import { NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA } from '@capaz/shared';
import { normalizarNombre } from './catalogos.js';
import { cuentaUtilizable } from './movimiento.js';
import { rechazada, type Regla } from './regla.js';

// Transferencias entre cuentas (C-F2): dos movimientos enlazados —egreso en la cuenta de origen e ingreso en la de
// destino— con un identificador común en `origen_ref`. No son ingresos ni egresos del negocio: los reportes las
// excluyen, pero cada cuenta sí las refleja en su saldo.

/** Prefijo de `origen_ref` de las dos patas de una transferencia. */
export const PREFIJO_DE_TRANSFERENCIA = 'transferencia:';

/** Patrón `like` de las patas de una transferencia (para excluirlas de los reportes o aislarlas). */
export const LIKE_DE_TRANSFERENCIA = `${PREFIJO_DE_TRANSFERENCIA}%`;

export const referenciaDeTransferencia = (transferenciaId: string): string => `${PREFIJO_DE_TRANSFERENCIA}${transferenciaId}`;

/** El identificador de la transferencia a la que pertenece un movimiento, o `null` si no es una pata. */
export function transferenciaDeReferencia(origenRef: string | null): string | null {
  if (origenRef === null || !origenRef.startsWith(PREFIJO_DE_TRANSFERENCIA)) return null;
  return origenRef.slice(PREFIJO_DE_TRANSFERENCIA.length) || null;
}

/** El nombre «Transferencia» (sin importar mayúsculas, tildes ni espacios) está reservado a la categoría del sistema. */
export const esNombreReservado = (nombre: string): boolean => normalizarNombre(nombre) === normalizarNombre(NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA);

export const MENSAJE_DE_NOMBRE_RESERVADO = 'El nombre «Transferencia» está reservado para las transferencias entre cuentas.';
export const MENSAJE_DE_ORIGEN_RESERVADO = 'Ese origen está reservado para las transferencias entre cuentas: usa «Transferir entre cuentas».';

type CuentaDeTransferencia = { id: string; nombre: string; archivadoEn: Date | null };

/** Origen y destino: cuentas distintas y en uso (que sean de la misma empresa lo garantiza la consulta por empresa). */
export function transferenciaPermitida(origen: CuentaDeTransferencia, destino: CuentaDeTransferencia): Regla {
  if (origen.id === destino.id) return rechazada('argumentos_invalidos', 'El origen y el destino deben ser cuentas distintas.');
  const deOrigen = cuentaUtilizable(origen);
  if (!deOrigen.ok) return deOrigen;
  return cuentaUtilizable(destino);
}

/** Texto de las dos patas: «Transferencia a Banco» / «Transferencia desde Caja», con la nota si la hay. */
export function descripcionDePata(sentido: 'salida' | 'entrada', nombreDeLaOtraCuenta: string, nota: string | null | undefined): string {
  const base = sentido === 'salida' ? `Transferencia a ${nombreDeLaOtraCuenta}` : `Transferencia desde ${nombreDeLaOtraCuenta}`;
  const extra = nota?.trim();
  return extra ? `${base}: ${extra}` : base;
}
