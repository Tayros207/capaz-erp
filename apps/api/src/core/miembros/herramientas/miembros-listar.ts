import { eq } from 'drizzle-orm';
import { exito } from '@capaz/shared';
import { usuarioModulos } from '../../../db/esquema/core-modulos.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { limiteDeUsuarios } from '../reglas.js';
import type { ServicioDeMiembros } from '../miembros.service.js';
import { aIso, contratosDeLaEmpresa, miembrosDeLaVista } from './comunes.js';

export const crearMiembrosListar = (servicio: ServicioDeMiembros) =>
  definirHerramienta('miembros_listar', {
    modulo: 'core',
    permiso: 'miembros:ver',
    criticidad: 'lectura',
    ayuda: {
      titulo: 'Ver las personas de la empresa',
      paraQueSirve: 'Lista a quienes trabajan en tu empresa, su rol y los módulos que tienen asignados.',
      cuandoUsarla: 'Antes de invitar, cambiar un rol o dar acceso a un módulo.',
      campos: [],
      ejemploTecleado: 'ver los usuarios de la empresa',
      ejemploHablado: 'quiénes tienen acceso al sistema',
      erroresComunes: ['Solo el propietario y los administradores pueden ver esta lista.'],
      relacionadas: ['miembro_asignar_modulo', 'invitaciones_listar'],
    },
    async ejecutar(_args, ctx, tx) {
      const [filas, asignaciones, contratos, pendientes] = await Promise.all([
        miembrosDeLaVista(tx),
        tx.select().from(usuarioModulos).where(eq(usuarioModulos.tenantId, ctx.empresaId)),
        contratosDeLaEmpresa(tx, ctx.empresaId),
        servicio.invitaciones(ctx.empresaId, true),
      ]);
      const ahora = Date.now();
      return exito({
        miembros: filas.map((f) => ({
          personaId: f.usuario_id,
          nombre: f.nombre,
          correo: f.correo,
          rol: f.rol,
          miembroDesde: aIso(f.miembro_desde),
          modulos: asignaciones
            .filter((a) => a.usuarioId === f.usuario_id)
            .map((a) => ({ modulo: a.modulo, nivel: a.nivel as 'lectura' | 'completo', alcance: a.alcance as 'todos' | 'propios' })),
        })),
        limiteDeUsuarios: limiteDeUsuarios(contratos),
        invitacionesPendientes: pendientes.filter((p) => p.expiresAt.getTime() > ahora).length,
      });
    },
  });
