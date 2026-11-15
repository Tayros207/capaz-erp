import type { EntradaDe, Respuesta } from '@capaz/shared';
import type { ListaDeMiembros, Invitacion } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../../shared/api/herramientas.ts';

/** Lo que carga la ruta: miembros y, si la persona puede gestionar, las invitaciones. */
export type DatosDeUsuarios = { miembros: Respuesta<ListaDeMiembros>; invitaciones: Respuesta<{ invitaciones: Invitacion[] }> | null };

export async function cargarUsuarios(): Promise<DatosDeUsuarios> {
  // Las invitaciones se piden aparte y su fallo (p. ej. sin permiso) no tumba la lista de miembros.
  const [miembros, invitaciones] = await Promise.all([llamar('miembros_listar', {}), llamar('invitaciones_listar', {})]);
  return { miembros, invitaciones };
}

export const asignarModulo = (args: EntradaDe<'miembro_asignar_modulo'>) => llamar('miembro_asignar_modulo', args);
export const anularInvitacion = (invitacionId: string) => llamar('invitacion_anular', { invitacionId });

// Críticas: el servidor pide confirmar y la persona ve el resumen antes de que cambie nada.
export const cambiarRol = (personaId: string, rol: EntradaDe<'miembro_cambiar_rol'>['rol']) =>
  llamarConfirmando('miembro_cambiar_rol', { personaId, rol }, { titulo: 'Cambiar rol', textoConfirmar: 'Cambiar rol', peligroso: true });

export const quitarMiembro = (personaId: string) =>
  llamarConfirmando('miembro_quitar', { personaId }, { titulo: 'Quitar de la empresa', textoConfirmar: 'Quitar', peligroso: true });

export const invitar = (args: EntradaDe<'invitacion_crear'>) =>
  llamarConfirmando('invitacion_crear', args, { titulo: 'Invitar a la empresa', textoConfirmar: 'Invitar' });
