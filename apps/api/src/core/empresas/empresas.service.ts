import { Inject, Injectable } from '@nestjs/common';
import { empresaConfig } from '../../db/esquema/core.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { CatalogoDeModulos } from '../modulos/catalogo.js';

/** Aprovisionamiento de una empresa: deja lista su configuración y sus módulos por defecto. Idempotente. */
@Injectable()
export class EmpresasService {
  private readonly listas = new Set<string>();

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
  ) {}

  /**
   * Siembra `core.empresa_config` y activa los módulos por defecto que aún no tengan fila (con el rol
   * de plataforma: la empresa no puede activarse módulos sola). La creación de la empresa
   * (autenticación) y su aprovisionamiento (negocio y plataforma) usan conexiones distintas y no son
   * atómicas: se repite hasta que quede completo. Nunca reactiva un módulo dado de baja.
   */
  async asegurar(empresaId: string, usuarioId: string): Promise<void> {
    if (this.listas.has(empresaId)) return;
    await this.db.conEmpresa({ empresaId, usuarioId }, (tx) =>
      tx.insert(empresaConfig).values({ tenantId: empresaId }).onConflictDoNothing(),
    );
    await this.activarPorDefecto(empresaId);
    this.listas.add(empresaId);
  }

  private async activarPorDefecto(empresaId: string): Promise<void> {
    const modulos = this.catalogo.porDefecto();
    if (!modulos.length) return;
    const c = await this.db.sistema.connect();
    try {
      await c.query('begin');
      // Dos peticiones simultáneas de una empresa nueva no deben activar dos veces.
      await c.query('select pg_advisory_xact_lock(hashtext($1))', [`activar-por-defecto:${empresaId}`]);
      for (const m of modulos) {
        const { rowCount } = await c.query('select 1 from core.empresa_modulos where tenant_id = $1 and modulo = $2', [empresaId, m.codigo]);
        if (!rowCount) await c.query('select core.activar_modulo($1, $2, $3, $4)', [empresaId, m.codigo, m.porDefecto.pruebaDias, 'sistema:alta-de-empresa']);
      }
      await c.query('commit');
    } catch (e) {
      await c.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }
}
