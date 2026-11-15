import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { AccesoDeModulo, Canal } from '@capaz/shared';
import { DatabaseService } from '../../infra/database/database.service.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import type { Asignacion, Contratacion } from './acceso.js';
import { CatalogoDeModulos } from './catalogo.js';

/**
 * Rol, módulos y permisos vigentes de una persona en una empresa. Lo usa el guardia de identidad
 * (una petición HTTP) y lo usarán los procesos sin petición (reglas, tareas) para armar su contexto.
 */
@Injectable()
export class ServicioDeAcceso {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
  ) {}

  /** El rol de la persona en la empresa, o nulo si ya no es miembro. */
  async rolDe(empresaId: string, usuarioId: string): Promise<string | null> {
    const { rows } = await this.db.auth.query<{ role: string }>(
      'select role from auth.member where user_id = $1 and organization_id = $2',
      [usuarioId, empresaId],
    );
    return rows[0]?.role ?? null;
  }

  /** Contratación de la empresa y asignaciones de la persona, en UNA transacción (una ida y vuelta a la base). */
  async cargarAcceso(
    rol: string | null,
    empresaId: string,
    usuarioId: string,
  ): Promise<{ modulos: AccesoDeModulo[]; permisos: string[] }> {
    const { contratos, asignaciones } = await this.db.conEmpresa(
      { empresaId, usuarioId },
      async (tx) => {
        // Drizzle devuelve las fechas de consultas crudas como texto: se convierten a Date.
        const c = await tx.execute<{
          modulo: string;
          estado: Contratacion['estado'];
          prueba_hasta: string | Date | null;
        }>(sql`select modulo, estado, prueba_hasta from core.empresa_modulos`);
        const a = await tx.execute<{
          modulo: string;
          nivel: Asignacion['nivel'];
          alcance: Asignacion['alcance'];
        }>(
          sql`select modulo, nivel, alcance from core.usuario_modulos where usuario_id = ${usuarioId}`,
        );
        return {
          contratos: c.rows.map((r): Contratacion => ({
            modulo: r.modulo,
            estado: r.estado,
            pruebaHasta: r.prueba_hasta ? new Date(r.prueba_hasta) : null,
          })),
          asignaciones: a.rows.map((r): Asignacion => ({
            modulo: r.modulo,
            nivel: r.nivel,
            alcance: r.alcance,
          })),
        };
      },
    );
    const modulos = this.catalogo.accesos({ rol, contratos, asignaciones });
    return { modulos, permisos: this.catalogo.permisos(modulos) };
  }

  /** Contexto completo de una persona en una empresa. Nulo si ya no es miembro. */
  async contextoDe(
    empresaId: string,
    usuarioId: string,
    canal: Canal,
    requestId: string,
  ): Promise<ContextoDeHerramienta | null> {
    const rol = await this.rolDe(empresaId, usuarioId);
    if (rol === null) return null;
    const { modulos, permisos } = await this.cargarAcceso(
      rol,
      empresaId,
      usuarioId,
    );
    return { requestId, empresaId, usuarioId, rol, permisos, modulos, canal };
  }
}
