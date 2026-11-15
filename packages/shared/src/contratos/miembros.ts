import { z } from 'zod';
import { contrato } from '../herramientas.js';

// Contratos del área «miembros»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
//
// Regla 19: las cuentas son globales. Ningún contrato de esta área trae el correo ni la contraseña de
// una persona que ya existe; el correo solo aparece al INVITAR (y es el de quien aún no es miembro).
// Regla 4: la empresa y quien actúa salen de la sesión; el argumento `personaId` es la persona sobre
// la que se actúa (`usuarioId` es un nombre reservado y no se acepta como argumento).

export const ROLES_DE_MIEMBRO = ['owner', 'admin', 'member'] as const;
export const rolDeMiembroSchema = z.enum(ROLES_DE_MIEMBRO, { error: 'El rol debe ser owner, admin o member.' });
export type RolDeMiembro = z.infer<typeof rolDeMiembroSchema>;

/** A una persona nueva solo se la invita como administrador o miembro; el propietario se nombra después. */
export const ROLES_INVITABLES = ['admin', 'member'] as const;
export const rolInvitableSchema = z.enum(ROLES_INVITABLES, { error: 'Solo se invita como admin o member.' });

export const NIVELES_ASIGNABLES = ['sin_acceso', 'lectura', 'completo'] as const;
export const nivelAsignableSchema = z.enum(NIVELES_ASIGNABLES, { error: 'El nivel debe ser sin_acceso, lectura o completo.' });
export const alcanceSchema = z.enum(['todos', 'propios'], { error: 'El alcance debe ser todos o propios.' });

const personaId = z.string().trim().min(1, { error: 'Falta indicar a la persona.' }).max(64);
const codigoDeModulo = z.string().trim().regex(/^[a-z][a-z0-9_]{0,31}$/, { error: 'El código del módulo no es válido.' });

export const asignacionDeModuloSchema = z.strictObject({
  modulo: z.string(),
  nivel: z.enum(['lectura', 'completo']),
  alcance: alcanceSchema,
});
export type AsignacionDeModulo = z.infer<typeof asignacionDeModuloSchema>;

export const miembroSchema = z.strictObject({
  personaId: z.string(),
  nombre: z.string(),
  correo: z.string(),
  rol: z.string(),
  miembroDesde: z.iso.datetime(),
  /** Lo que se le asignó a esta persona; owner y admin entran a todo lo contratado sin asignación. */
  modulos: z.array(asignacionDeModuloSchema),
});
export type Miembro = z.infer<typeof miembroSchema>;

export const listaDeMiembrosSchema = z.strictObject({
  miembros: z.array(miembroSchema),
  /** Tope de personas que permiten los módulos contratados; nulo si no hay tope. */
  limiteDeUsuarios: z.number().int().positive().nullable(),
  invitacionesPendientes: z.number().int().nonnegative(),
});
export type ListaDeMiembros = z.infer<typeof listaDeMiembrosSchema>;

export const moduloAsignadoSchema = z.strictObject({
  personaId: z.string(),
  modulo: z.string(),
  nivel: nivelAsignableSchema,
  alcance: alcanceSchema,
});

export const asignarModuloSchema = z.strictObject({
  personaId,
  modulo: codigoDeModulo,
  nivel: nivelAsignableSchema,
  alcance: alcanceSchema.optional(),
});
export type AsignarModulo = z.infer<typeof asignarModuloSchema>;

export const cambiarRolSchema = z.strictObject({ personaId, rol: rolDeMiembroSchema });
export const rolCambiadoSchema = z.strictObject({ personaId: z.string(), rol: z.string() });

export const quitarMiembroSchema = z.strictObject({ personaId });
export const miembroQuitadoSchema = z.strictObject({ personaId: z.string(), quitado: z.literal(true) });

export const crearInvitacionSchema = z.strictObject({
  correo: z.email({ error: 'Escribe un correo válido.' }).max(254),
  rol: rolInvitableSchema,
});

export const invitacionSchema = z.strictObject({
  id: z.string(),
  correo: z.string(),
  rol: z.string(),
  estado: z.string(),
  expiraEn: z.iso.datetime(),
  creadaEn: z.iso.datetime(),
  vencida: z.boolean(),
  /** Ruta de la pantalla donde la persona acepta; el administrador la copia y se la envía. */
  ruta: z.string(),
});
export type Invitacion = z.infer<typeof invitacionSchema>;

export const anularInvitacionSchema = z.strictObject({
  invitacionId: z.string().trim().min(1, { error: 'Falta indicar la invitación.' }).max(64),
});
export const invitacionAnuladaSchema = z.strictObject({ invitacionId: z.string(), anulada: z.literal(true) });

export const listaDeInvitacionesSchema = z.strictObject({ invitaciones: z.array(invitacionSchema) });

export const contratosDeMiembros = {
  miembros_listar: contrato(z.strictObject({}), listaDeMiembrosSchema),
  miembro_asignar_modulo: contrato(asignarModuloSchema, moduloAsignadoSchema),
  miembro_cambiar_rol: contrato(cambiarRolSchema, rolCambiadoSchema),
  miembro_quitar: contrato(quitarMiembroSchema, miembroQuitadoSchema),
  invitacion_crear: contrato(crearInvitacionSchema, invitacionSchema),
  invitacion_anular: contrato(anularInvitacionSchema, invitacionAnuladaSchema),
  invitaciones_listar: contrato(z.strictObject({}), listaDeInvitacionesSchema),
} as const;
export const eventosDeMiembros = {} as const;
