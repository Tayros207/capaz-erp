import type { AsignacionDeModulo, EntradaDe, Invitacion, ListaDeMiembros, Miembro, ModuloDeYo, RolDeMiembro } from '@capaz/shared';

// Lógica pura de «Usuarios y accesos». Las reglas de fondo (último propietario, tope de usuarios,
// un admin no toca a un owner) las hace el servidor; aquí solo se oculta lo que no corresponde y se
// traducen los rechazos a mensajes claros.

export const ETIQUETA_DE_ROL: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', member: 'Miembro' };
export const etiquetaDeRol = (rol: string): string => ETIQUETA_DE_ROL[rol] ?? rol;

export type NivelDeModulo = 'sin_acceso' | 'lectura' | 'completo';
export const ETIQUETA_DE_NIVEL: Record<NivelDeModulo, string> = { sin_acceso: 'Sin acceso', lectura: 'Solo lectura', completo: 'Completo' };

/** Owner y admin entran a todo lo contratado sin asignación: no se les asigna nivel. */
export const entraATodo = (rol: string): boolean => rol === 'owner' || rol === 'admin';

/** Roles que `quien` puede dar a `objetivo`: un admin no toca a un owner ni nombra propietarios. */
export function rolesAsignables(rolDeQuien: string, objetivo: Miembro): RolDeMiembro[] {
  if (rolDeQuien === 'owner') return ['owner', 'admin', 'member'];
  if (rolDeQuien === 'admin' && objetivo.rol !== 'owner') return ['admin', 'member'];
  return [];
}

/** Un admin no puede quitar a un propietario; nadie se quita a sí mismo desde aquí. */
export function puedeQuitar(rolDeQuien: string, objetivo: Miembro, yoId: string): boolean {
  if (objetivo.personaId === yoId) return false;
  return rolDeQuien === 'owner' || (rolDeQuien === 'admin' && objetivo.rol !== 'owner');
}

/** Módulos a los que se puede asignar un nivel: los contratados y no dados de baja ni suspendidos. */
export function modulosAsignables(modulos: readonly ModuloDeYo[]): ModuloDeYo[] {
  return modulos.filter((m) => !['no_contratado', 'suspendido'].includes(m.acceso.motivo)).sort((a, b) => a.orden - b.orden);
}

export function nivelActual(m: Miembro, modulo: string): NivelDeModulo {
  return m.modulos.find((a) => a.modulo === modulo)?.nivel ?? 'sin_acceso';
}

export function alcanceActual(m: Miembro, modulo: string): 'todos' | 'propios' {
  return m.modulos.find((a) => a.modulo === modulo)?.alcance ?? 'todos';
}

export function argumentosDeAsignacion(personaId: string, modulo: string, nivel: NivelDeModulo, alcance: 'todos' | 'propios'): EntradaDe<'miembro_asignar_modulo'> {
  const args: EntradaDe<'miembro_asignar_modulo'> = { personaId, modulo, nivel };
  if (nivel !== 'sin_acceso') args.alcance = alcance;
  return args;
}

/** Resumen corto de lo asignado, para la lista. */
export function resumenDeModulos(m: Miembro, nombres: ReadonlyMap<string, string>): string {
  if (entraATodo(m.rol)) return 'Todo lo contratado';
  if (m.modulos.length === 0) return 'Sin módulos';
  return m.modulos.map((a: AsignacionDeModulo) => `${nombres.get(a.modulo) ?? a.modulo} (${a.nivel === 'lectura' ? 'lectura' : 'completo'})`).join(', ');
}

/** Cuántos lugares quedan; nulo si no hay tope. */
export function lugaresLibres(l: ListaDeMiembros): number | null {
  if (l.limiteDeUsuarios === null) return null;
  return Math.max(0, l.limiteDeUsuarios - l.miembros.length - l.invitacionesPendientes);
}

export function textoDeCupo(l: ListaDeMiembros): string {
  const libres = lugaresLibres(l);
  if (libres === null) return `${l.miembros.length} personas · sin tope de usuarios`;
  return `${l.miembros.length} de ${l.limiteDeUsuarios} personas · ${l.invitacionesPendientes} invitaciones pendientes · ${libres} lugares libres`;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarCorreo(correo: string): string | undefined {
  const c = correo.trim();
  if (!c) return 'Escribe el correo de la persona.';
  if (c.length > 254 || !CORREO.test(c)) return 'Escribe un correo válido.';
  return undefined;
}

/** La ruta que devuelve el servidor (`/invitacion/<id>`) se vuelve un enlace absoluto para copiarlo. */
export function enlaceAbsoluto(ruta: string, origen: string): string {
  return `${origen.replace(/\/+$/, '')}/${ruta.replace(/^\/+/, '')}`;
}

export const pendientes = (invitaciones: readonly Invitacion[]): Invitacion[] => invitaciones.filter((i) => i.estado === 'pending');

export function estadoDeInvitacion(i: Invitacion): { texto: string; tono: 'exito' | 'aviso' | 'neutro' } {
  if (i.estado === 'pending') return i.vencida ? { texto: 'Vencida', tono: 'aviso' } : { texto: 'Pendiente', tono: 'exito' };
  return { texto: i.estado === 'canceled' ? 'Anulada' : i.estado === 'accepted' ? 'Aceptada' : i.estado, tono: 'neutro' };
}

export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_permiso') return mensaje && mensaje !== 'No tienes permiso.' ? mensaje : 'No tienes permiso para gestionar usuarios.';
  if (codigo === 'sin_conexion') return 'No hay conexión con el servidor. Inténtalo de nuevo.';
  if (codigo === 'conflicto') return mensaje || 'No se pudo hacer el cambio porque entra en conflicto con otro dato.';
  if (codigo === 'no_encontrado') return mensaje || 'La persona o la invitación ya no existe. Recarga la lista.';
  if (codigo === 'argumentos_invalidos') return mensaje || 'Revisa los datos e inténtalo de nuevo.';
  return mensaje || 'No se pudo completar la operación.';
}
