import { and, eq } from 'drizzle-orm';
import { exito, rechazo } from '@capaz/shared';
import { usuarioModulos } from '../../../db/esquema/core-modulos.js';
import { hashCanonico } from '../../herramientas/confirmacion.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { puedeQuitar } from '../reglas.js';
import type { ServicioDeMiembros } from '../miembros.service.js';
import { actorDe, bloquearMiembros, miembrosDeLaVista } from './comunes.js';

export const crearMiembroQuitar = (servicio: ServicioDeMiembros) =>
  definirHerramienta('miembro_quitar', {
    modulo: 'core',
    permiso: 'miembros:gestionar',
    criticidad: 'critica',
    ayuda: {
      titulo: 'Quitar a una persona de la empresa',
      paraQueSirve: 'Saca a una persona de tu empresa. Su cuenta no se borra: solo pierde el acceso a esta empresa.',
      cuandoUsarla: 'Cuando alguien deja de trabajar contigo.',
      campos: [{ nombre: 'personaId', queSeAnota: 'La persona (la sacas de la lista de miembros).', ejemplo: 'a1b2c3' }],
      ejemploTecleado: 'quitar a Luis de la empresa',
      ejemploHablado: 'saca a Luis del sistema',
      erroresComunes: [
        'No se puede quitar al último propietario.',
        'Un administrador no puede quitar a un propietario.',
      ],
      relacionadas: ['miembros_listar', 'miembro_cambiar_rol'],
    },
    async resumir(args, ctx, tx) {
      const objetivo = await servicio.miembroDe(ctx.empresaId, args.personaId);
      if (!objetivo) return { ok: false, error: { codigo: 'no_encontrado', mensaje: 'Esa persona no es miembro de la empresa.' } };
      const propietarios = await servicio.propietarios(ctx.empresaId);
      const v = puedeQuitar({ actor: actorDe(ctx), objetivo: { usuarioId: args.personaId, rol: objetivo.role }, propietarios });
      if (!v.ok) return { ok: false, error: { codigo: v.codigo, mensaje: v.mensaje } };
      const nombre = (await miembrosDeLaVista(tx)).find((m) => m.usuario_id === args.personaId)?.nombre ?? 'la persona';
      return {
        ok: true,
        resumen: { resumen: `Quitarás a «${nombre}» (${objetivo.role}) de la empresa. Perderá el acceso de inmediato.`, huella: hashCanonico({ rol: objetivo.role, propietarios }) },
      };
    },
    auditar: (args) => ({ entidadTipo: 'miembro', entidadId: args.personaId }),
    async ejecutar(args, ctx, tx) {
      await bloquearMiembros(tx, ctx.empresaId);
      const objetivo = await servicio.miembroDe(ctx.empresaId, args.personaId);
      if (!objetivo) return rechazo('no_encontrado', 'Esa persona no es miembro de la empresa.');
      const propietarios = await servicio.propietarios(ctx.empresaId);
      const v = puedeQuitar({ actor: actorDe(ctx), objetivo: { usuarioId: args.personaId, rol: objetivo.role }, propietarios });
      if (!v.ok) return rechazo(v.codigo, v.mensaje);
      // Lo de la base de negocio primero: si Better Auth rechaza, todo se revierte con la transacción.
      await tx
        .delete(usuarioModulos)
        .where(and(eq(usuarioModulos.tenantId, ctx.empresaId), eq(usuarioModulos.usuarioId, args.personaId)));
      const r = await servicio.quitar(ctx.empresaId, objetivo.id);
      return r.ok ? exito({ personaId: args.personaId, quitado: true as const }) : r;
    },
  });
