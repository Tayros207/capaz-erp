import { and, eq, sql } from 'drizzle-orm';
import { exito, rechazo } from '@capaz/shared';
import { solicitudesModulo } from '../../../db/esquema/core-modulos.js';
import type { CatalogoDeModulos } from '../../modulos/catalogo.js';
import { definirHerramienta } from '../../herramientas/tipos.js';

/** Un módulo que la empresa aún no tiene se pide desde aquí; la plataforma lo atiende. */
export const crearModuloSolicitar = (catalogo: CatalogoDeModulos) =>
  definirHerramienta('modulo_solicitar', {
    modulo: 'core',
    permiso: null,
    criticidad: 'normal',
    idempotente: true,
    ayuda: {
      titulo: 'Solicitar un módulo',
      paraQueSirve: 'Avisa al equipo de Capaz que tu empresa quiere usar un módulo que todavía no tiene.',
      cuandoUsarla: 'Cuando ves un módulo bloqueado y quieres activarlo.',
      campos: [
        { nombre: 'modulo', queSeAnota: 'Código del módulo que quieres.', ejemplo: 'cotizador' },
        { nombre: 'nota', queSeAnota: 'Algo que quieras contarnos (opcional).', ejemplo: 'Lo necesitamos para el taller.' },
      ],
      ejemploTecleado: 'solicitar el módulo cotizador',
      ejemploHablado: 'quiero activar el cotizador',
      erroresComunes: ['El módulo no existe: revisa el código.', 'Tu empresa ya tiene ese módulo activo.'],
      relacionadas: [],
    },
    auditar: (args, datos) => ({
      entidadTipo: 'solicitud_modulo',
      entidadId: datos?.id,
      resumen: { modulo: args.modulo },
    }),
    async ejecutar(args, ctx, tx) {
      if (!catalogo.contratables().some((m) => m.codigo === args.modulo)) {
        return rechazo('no_encontrado', `No existe el módulo «${args.modulo}».`);
      }
      const acceso = ctx.modulos.find((m) => m.codigo === args.modulo);
      if (acceso && (acceso.motivo === 'activo' || acceso.motivo === 'prueba')) {
        return rechazo('conflicto', 'Tu empresa ya tiene ese módulo activo.');
      }
      const [pendiente] = await tx
        .select({ id: solicitudesModulo.id })
        .from(solicitudesModulo)
        .where(
          and(
            eq(solicitudesModulo.tenantId, ctx.empresaId),
            eq(solicitudesModulo.modulo, args.modulo),
            eq(solicitudesModulo.estado, 'pendiente'),
          ),
        )
        .limit(1);
      if (pendiente) return exito({ id: pendiente.id, modulo: args.modulo, estado: 'pendiente' as const, yaSolicitado: true });
      // SQL explícito: `capaz_app` solo puede insertar estas cuatro columnas (el resto, por defecto).
      const { rows } = await tx.execute<{ id: string }>(
        sql`insert into core.solicitudes_modulo (tenant_id, modulo, usuario_id, nota)
            values (${ctx.empresaId}, ${args.modulo}, ${ctx.usuarioId}, ${args.nota ?? null}) returning id`,
      );
      const nueva = rows[0];
      return nueva
        ? exito({ id: nueva.id, modulo: args.modulo, estado: 'pendiente' as const, yaSolicitado: false })
        : rechazo('error_interno', 'No se pudo registrar la solicitud.');
    },
  });
