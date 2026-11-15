import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { ManifiestoDeConector } from '@capaz/shared';
import type { Logger } from 'pino';
import { z } from 'zod';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { CatalogoDeModulos } from '../modulos/catalogo.js';

export class ConectoresInvalidos extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Conectores inválidos:\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConectoresInvalidos';
  }
}

const CODIGO = /^[a-z][a-z0-9_]*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const CAPACIDAD = /^[a-z][a-z0-9_]*$/;

/**
 * Cada conector contratable es un módulo de la familia `conexiones` MÁS un manifiesto de conector con el
 * mismo código (ADR-014). Los módulos agregan el suyo en `onModuleInit`; al arrancar se validan y se
 * sincronizan con `core.conectores` (el catálogo, sin credenciales ni empresa).
 */
@Injectable()
export class RegistroDeConectores implements OnApplicationBootstrap {
  private readonly lista: ManifiestoDeConector[] = [];

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
    @Inject(CONFIG) private readonly config: Pick<Config, 'NODE_ENV' | 'CONEXIONES_CLAVE'>,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  agregar(m: ManifiestoDeConector): void {
    if (this.lista.some((x) => x.codigo === m.codigo)) throw new Error(`Ya existe un conector llamado «${m.codigo}».`);
    this.lista.push(m);
  }

  obtener(codigo: string): ManifiestoDeConector | undefined {
    return this.lista.find((m) => m.codigo === codigo);
  }

  todos(): readonly ManifiestoDeConector[] {
    return this.lista;
  }

  /** Problemas de forma y de correspondencia con el catálogo de módulos. */
  problemas(): string[] {
    const p: string[] = [];
    for (const m of this.lista) {
      const d = `El conector «${m.codigo}»`;
      if (!CODIGO.test(m.codigo)) p.push(`${d} tiene un código inválido.`);
      if (!m.nombre.trim()) p.push(`${d} no tiene nombre.`);
      if (!VERSION.test(m.version)) p.push(`${d} tiene una versión inválida (usa 1.2.3).`);
      if (!['clave_api', 'oauth2', 'ninguna'].includes(m.autenticacion)) p.push(`${d} tiene un tipo de autenticación inválido.`);
      if (m.capacidades.some((c) => !CAPACIDAD.test(c))) p.push(`${d} tiene capacidades con nombre inválido.`);
      if (!(m.configuracion instanceof z.ZodType) || !(m.credenciales instanceof z.ZodType)) p.push(`${d} debe traer esquemas Zod de configuración y credenciales.`);
      const modulo = this.catalogo.porCodigo(m.codigo);
      if (!modulo) p.push(`${d} no tiene un módulo con el mismo código.`);
      else if (modulo.familia !== 'conexiones') p.push(`${d} debe ser un módulo de la familia «conexiones».`);
    }
    return p;
  }

  validar(): void {
    const p = this.problemas();
    if (p.length) throw new ConectoresInvalidos(p);
  }

  /** Inserta o actualiza el catálogo y apaga lo que ya no existe en el código. */
  async sincronizar(): Promise<void> {
    for (const m of this.lista) {
      await this.db.sistema.query(
        `insert into core.conectores (codigo, nombre, descripcion, version, capacidades, autenticacion, activo)
         values ($1, $2, $3, $4, $5::text[], $6, true)
         on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, version = excluded.version,
           capacidades = excluded.capacidades, autenticacion = excluded.autenticacion, activo = true`,
        [m.codigo, m.nombre, m.descripcion, m.version, [...m.capacidades], m.autenticacion],
      );
    }
    await this.db.sistema.query('update core.conectores set activo = false where not (codigo = any($1::text[]))', [this.lista.map((m) => m.codigo)]);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.NODE_ENV === 'production' && !this.config.CONEXIONES_CLAVE) {
      throw new Error('Falta CONEXIONES_CLAVE: es obligatoria en producción (32 bytes en base64).');
    }
    this.validar();
    await this.sincronizar();
    this.logger.info({ conectores: this.lista.map((m) => m.codigo) }, 'Conectores sincronizados.');
  }
}
