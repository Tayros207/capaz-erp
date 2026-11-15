import { exito } from '@capaz/shared';
import { definirHerramienta } from '../../herramientas/tipos.js';
import type { ServicioDeMiembros } from '../miembros.service.js';
import { aIso } from './comunes.js';
import { rutaDeInvitacion } from './invitacion-crear.js';

export const crearInvitacionesListar = (servicio: ServicioDeMiembros) =>
  definirHerramienta('invitaciones_listar', {
    modulo: 'core',
    permiso: 'miembros:ver',
    criticidad: 'lectura',
    ayuda: {
      titulo: 'Ver las invitaciones pendientes',
      paraQueSirve: 'Lista las invitaciones que aún no se aceptaron, con su enlace y si ya vencieron.',
      cuandoUsarla: 'Para volver a copiar un enlace o anular una invitación.',
      campos: [],
      ejemploTecleado: 'ver las invitaciones pendientes',
      ejemploHablado: 'a quién invitamos todavía',
      erroresComunes: ['Solo el propietario y los administradores pueden ver esta lista.'],
      relacionadas: ['invitacion_crear', 'invitacion_anular'],
    },
    async ejecutar(_args, ctx) {
      const ahora = Date.now();
      const filas = await servicio.invitaciones(ctx.empresaId, true);
      return exito({
        invitaciones: filas.map((f) => ({
          id: f.id,
          correo: f.email,
          rol: f.role ?? 'member',
          estado: f.status,
          expiraEn: aIso(f.expiresAt),
          creadaEn: aIso(f.createdAt),
          vencida: f.expiresAt.getTime() <= ahora,
          ruta: rutaDeInvitacion(f.id),
        })),
      });
    },
  });
