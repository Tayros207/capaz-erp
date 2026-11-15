import { and, eq } from 'drizzle-orm';
import { exito, rechazo } from '@capaz/shared';
import { usuarioModulos } from '../../../db/esquema/core-modulos.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import type { ServicioDeMiembros } from '../miembros.service.js';
import { bloquearMiembros, moduloContratado } from './comunes.js';

export const crearMiembroAsignarModulo = (servicio: ServicioDeMiembros) =>
  definirHerramienta('miembro_asignar_modulo', {
    modulo: 'core',
    permiso: 'miembros:gestionar',
    criticidad: 'normal',
    ayuda: {
      titulo: 'Dar o quitar acceso a un módulo',
      paraQueSirve: 'Define qué módulo puede usar un miembro y con qué nivel: sin acceso, solo lectura o completo.',
      cuandoUsarla: 'Cuando un miembro nuevo necesita entrar a un módulo, o ya no debe hacerlo.',
      campos: [
        { nombre: 'personaId', queSeAnota: 'La persona (la sacas de la lista de miembros).', ejemplo: 'a1b2c3' },
        { nombre: 'modulo', queSeAnota: 'Código del módulo que tu empresa tiene contratado.', ejemplo: 'cotizador' },
        { nombre: 'nivel', queSeAnota: 'sin_acceso, lectura o completo.', ejemplo: 'lectura' },
        { nombre: 'alcance', queSeAnota: 'todos, o propios si solo ve lo que él registra (opcional).', ejemplo: 'todos' },
      ],
      ejemploTecleado: 'dar a Ana acceso de lectura al cotizador',
      ejemploHablado: 'que Ana pueda ver el cotizador pero no cambiarlo',
      erroresComunes: [
        'El propietario y los administradores ya entran a todo: no necesitan asignación.',
        'Tu empresa no tiene ese módulo contratado.',
      ],
      relacionadas: ['miembros_listar'],
    },
    auditar: (args) => ({
      entidadTipo: 'usuario_modulo',
      entidadId: args.personaId,
      resumen: { modulo: args.modulo, nivel: args.nivel, alcance: args.alcance ?? null },
    }),
    async ejecutar(args, ctx, tx) {
      if (args.modulo === 'core') return rechazo('argumentos_invalidos', 'El núcleo no se asigna: lo ve toda la empresa.');
      await bloquearMiembros(tx, ctx.empresaId);
      const objetivo = await servicio.miembroDe(ctx.empresaId, args.personaId);
      if (!objetivo) return rechazo('no_encontrado', 'Esa persona no es miembro de la empresa.');
      if (objetivo.role !== 'member') {
        return rechazo('conflicto', 'El propietario y los administradores ya entran a todo lo contratado: no necesitan asignación.');
      }
      if (!(await moduloContratado(tx, ctx.empresaId, args.modulo))) {
        return rechazo('no_encontrado', 'Tu empresa no tiene ese módulo contratado.');
      }
      const donde = and(
        eq(usuarioModulos.tenantId, ctx.empresaId),
        eq(usuarioModulos.usuarioId, args.personaId),
        eq(usuarioModulos.modulo, args.modulo),
      );
      if (args.nivel === 'sin_acceso') {
        await tx.delete(usuarioModulos).where(donde);
        return exito({ personaId: args.personaId, modulo: args.modulo, nivel: 'sin_acceso' as const, alcance: 'todos' as const });
      }
      const [fila] = await tx
        .insert(usuarioModulos)
        .values({ tenantId: ctx.empresaId, usuarioId: args.personaId, modulo: args.modulo, nivel: args.nivel, alcance: args.alcance ?? 'todos' })
        .onConflictDoUpdate({
          target: [usuarioModulos.tenantId, usuarioModulos.usuarioId, usuarioModulos.modulo],
          set: { nivel: args.nivel, ...(args.alcance && { alcance: args.alcance }) },
        })
        .returning();
      if (!fila) return rechazo('error_interno', 'No se pudo guardar la asignación.');
      return exito({ personaId: args.personaId, modulo: args.modulo, nivel: args.nivel, alcance: fila.alcance as 'todos' | 'propios' });
    },
  });
