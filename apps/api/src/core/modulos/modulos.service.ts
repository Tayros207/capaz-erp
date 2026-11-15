import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service.js';
import { CatalogoDeModulos } from './catalogo.js';

/** Sincroniza el catálogo de manifiestos con `core.modulos` al arrancar (con el rol de plataforma). */
@Injectable()
export class ModulosService implements OnModuleInit {
  private readonly log = new Logger(ModulosService.name);

  constructor(
    @Inject(CatalogoDeModulos) readonly catalogo: CatalogoDeModulos,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    const contratables = this.catalogo.contratables();
    for (const m of contratables) {
      await this.db.sistema.query(
        `insert into core.modulos (codigo, nombre, descripcion, version, depende_de, activo, por_defecto, prueba_dias)
         values ($1, $2, $3, $4, $5, true, $6, $7)
         on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion,
           version = excluded.version, depende_de = excluded.depende_de, activo = true,
           por_defecto = excluded.por_defecto, prueba_dias = excluded.prueba_dias`,
        [m.codigo, m.nombre, m.descripcion, m.version, m.dependeDe, !!m.porDefecto, m.porDefecto?.pruebaDias ?? null],
      );
    }
    // Lo que ya no existe en el código se marca inactivo (no se borra: puede tener contratos).
    await this.db.sistema.query('update core.modulos set activo = false where codigo <> all($1)', [contratables.map((m) => m.codigo)]);
    this.log.log(`Catálogo de módulos sincronizado: ${contratables.map((m) => m.codigo).join(', ')}`);
  }
}
