import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { CONFIG, type Config } from '../config/config.js';
import { crearConEmpresa, type BaseDeDatos, type ConEmpresa } from './con-empresa.js';

export type DatabaseStatus = 'up' | 'down';

// Grupos de conexiones (`pg.Pool`, TCP normal: el servidor corre permanente). `pg` solo se importa
// aquí (prueba de arquitectura). Tres grupos, tres roles (ADR-011):
//   aplicacion → capaz_app (negocio, bajo RLS)   · siempre
//   auth       → capaz_auth (Better Auth)        · siempre
//   sistema    → capaz_sistema (plataforma)      · siempre
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly aplicacion: pg.Pool;
  readonly auth: pg.Pool;
  readonly sistema: pg.Pool;
  readonly db: BaseDeDatos;
  readonly conEmpresa: ConEmpresa;

  constructor(@Inject(CONFIG) config: Config) {
    this.aplicacion = new pg.Pool({ connectionString: config.DATABASE_URL_APP, max: 10 });
    this.auth = new pg.Pool({ connectionString: config.DATABASE_URL_AUTH, max: 5 });
    this.sistema = new pg.Pool({ connectionString: config.DATABASE_URL_SISTEMA, max: 5 });
    this.db = drizzle(this.aplicacion);
    this.conEmpresa = crearConEmpresa(this.db);
  }

  async ping(): Promise<DatabaseStatus> {
    try {
      await this.aplicacion.query('select 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.aplicacion.end(), this.auth.end(), this.sistema.end()]);
  }
}
