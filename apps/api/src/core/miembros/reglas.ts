import type { Codigo } from '@capaz/shared';

// Las reglas de la fase 6b como funciones PURAS (sin base ni red), para probarlas una por una.
// Quien las usa (las herramientas) pone los datos desde la sesión y la base; aquí solo se decide.
//   1. `hayCupo`            · se respeta `max_usuarios` de los módulos contratados.
//   2. `puedeQuitar` y `puedeCambiarRol` · no se quita ni se degrada al último propietario.
//   3. (en las mismas)      · un administrador no toca a un propietario ni nombra propietarios.
//   4. `puedeInvitarCon`    · solo se invita como admin o member, y solo lo hacen owner y admin.
//   5. `invitacionVigente`  · una invitación vale solo en su empresa, pendiente y sin vencer.
// Aparte, por construcción: ninguna herramienta de esta área recibe ni cambia el correo o la
// contraseña de otra persona (regla 19); los contratos no tienen esos campos.

export type Rol = 'owner' | 'admin' | 'member';
export type Veredicto = { ok: true } | { ok: false; codigo: Codigo; mensaje: string };

const OK: Veredicto = { ok: true };
const no = (codigo: Codigo, mensaje: string): Veredicto => ({ ok: false, codigo, mensaje });

export const esRol = (valor: unknown): valor is Rol => valor === 'owner' || valor === 'admin' || valor === 'member';
const administra = (rol: string | null): boolean => rol === 'owner' || rol === 'admin';

export type Participante = { usuarioId: string; rol: string | null };

/** El menor `max_usuarios` entre los módulos contratados vigentes (los dados de baja no cuentan); nulo si ninguno lo fija. */
export function limiteDeUsuarios(contratos: ReadonlyArray<{ estado: string; maxUsuarios: number | null }>): number | null {
  const topes = contratos.filter((c) => c.estado !== 'baja' && c.maxUsuarios !== null).map((c) => c.maxUsuarios as number);
  return topes.length === 0 ? null : Math.min(...topes);
}

/** Miembros actuales más invitaciones pendientes no pueden pasar del tope: así aceptar una invitación nunca lo rebasa. */
export function hayCupo(entrada: { limite: number | null; miembros: number; invitacionesPendientes: number }): Veredicto {
  const { limite, miembros, invitacionesPendientes } = entrada;
  if (limite === null) return OK;
  return miembros + invitacionesPendientes < limite
    ? OK
    : no('conflicto', `Tu contratación permite hasta ${limite} personas y ya están ocupados todos los lugares (contando las invitaciones pendientes).`);
}

export function puedeQuitar(entrada: { actor: Participante; objetivo: Participante; propietarios: number }): Veredicto {
  const { actor, objetivo, propietarios } = entrada;
  if (!administra(actor.rol)) return no('sin_permiso', 'Solo un propietario o un administrador puede quitar personas.');
  if (objetivo.rol === 'owner' && actor.rol !== 'owner') return no('sin_permiso', 'Un administrador no puede quitar a un propietario.');
  if (objetivo.rol === 'owner' && propietarios <= 1) return no('conflicto', 'No se puede quitar al último propietario de la empresa.');
  return OK;
}

export function puedeCambiarRol(entrada: { actor: Participante; objetivo: Participante; nuevoRol: Rol; propietarios: number }): Veredicto {
  const { actor, objetivo, nuevoRol, propietarios } = entrada;
  if (!administra(actor.rol)) return no('sin_permiso', 'Solo un propietario o un administrador puede cambiar roles.');
  if (objetivo.rol === nuevoRol) return no('conflicto', 'Esa persona ya tiene ese rol.');
  if (actor.rol !== 'owner' && (objetivo.rol === 'owner' || nuevoRol === 'owner')) {
    return no('sin_permiso', 'Un administrador no puede cambiar el rol de un propietario ni nombrar propietarios.');
  }
  if (objetivo.rol === 'owner' && nuevoRol !== 'owner' && propietarios <= 1) {
    return no('conflicto', 'No se puede degradar al último propietario de la empresa.');
  }
  return OK;
}

export function puedeInvitarCon(entrada: { actor: Participante; rol: string }): Veredicto {
  if (!administra(entrada.actor.rol)) return no('sin_permiso', 'Solo un propietario o un administrador puede invitar.');
  if (entrada.rol !== 'admin' && entrada.rol !== 'member') return no('argumentos_invalidos', 'Solo se invita como admin o member.');
  return OK;
}

export function invitacionVigente(entrada: {
  invitacion: { organizationId: string; status: string; expiresAt: Date | string };
  empresaId: string;
  ahora: Date;
}): Veredicto {
  const { invitacion, empresaId, ahora } = entrada;
  if (invitacion.organizationId !== empresaId) return no('no_encontrado', 'No existe esa invitación.');
  if (invitacion.status !== 'pending') return no('conflicto', 'Esa invitación ya no está pendiente.');
  if (new Date(invitacion.expiresAt).getTime() <= ahora.getTime()) return no('conflicto', 'Esa invitación ya venció.');
  return OK;
}
