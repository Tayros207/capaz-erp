import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { invitacionVigente } from '../reglas.js';
import type { ServicioDeMiembros } from '../miembros.service.js';
import { bloquearMiembros } from './comunes.js';

export const crearInvitacionAnular = (servicio: ServicioDeMiembros) =>
  definirHerramienta('invitacion_anular', {
    modulo: 'core',
    permiso: 'miembros:gestionar',
    criticidad: 'normal',
    ayuda: {
      titulo: 'Anular una invitación',
      paraQueSirve: 'Deja sin efecto una invitación pendiente: su enlace deja de servir.',
      cuandoUsarla: 'Cuando invitaste al correo equivocado o ya no hace falta.',
      campos: [{ nombre: 'invitacionId', queSeAnota: 'La invitación (la sacas de la lista de invitaciones).', ejemplo: 'inv_123' }],
      ejemploTecleado: 'anular la invitación de ana@miempresa.pe',
      ejemploHablado: 'cancela la invitación de Ana',
      erroresComunes: ['Esa invitación ya no está pendiente o ya venció.'],
      relacionadas: ['invitaciones_listar', 'invitacion_crear'],
    },
    auditar: (args) => ({ entidadTipo: 'invitacion', entidadId: args.invitacionId }),
    async ejecutar(args, ctx, tx) {
      await bloquearMiembros(tx, ctx.empresaId);
      const inv = await servicio.invitacion(args.invitacionId);
      // Una invitación de otra empresa se responde igual que una que no existe.
      if (!inv || inv.organizationId !== ctx.empresaId) return rechazo('no_encontrado', 'No existe esa invitación.');
      const v = invitacionVigente({ invitacion: inv, empresaId: ctx.empresaId, ahora: new Date() });
      if (!v.ok) return rechazo(v.codigo, v.mensaje);
      const r = await servicio.anular(args.invitacionId);
      return r.ok ? exito({ invitacionId: args.invitacionId, anulada: true as const }) : r;
    },
  });
