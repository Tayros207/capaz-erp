import { Global, Module } from '@nestjs/common';
import type { ManifiestoDeEntrada } from '@capaz/shared';
import { CatalogoDeModulos, MANIFIESTOS } from './catalogo.js';
import { manifiestoCore } from './manifiesto-core.js';
import { ModulosService } from './modulos.service.js';

/**
 * `core` no puede importar de `modules/` (prueba de arquitectura): quien ensambla la aplicación
 * (`app.module.ts`) pasa los manifiestos de los demás módulos con `ModulosModule.con([...])`.
 */
@Global()
@Module({})
export class ModulosModule {
  static con(manifiestos: readonly ManifiestoDeEntrada[]) {
    return {
      module: ModulosModule,
      providers: [
        { provide: MANIFIESTOS, useValue: [manifiestoCore, ...manifiestos] },
        { provide: CatalogoDeModulos, useFactory: (m: ManifiestoDeEntrada[]) => new CatalogoDeModulos(m), inject: [MANIFIESTOS] },
        ModulosService,
      ],
      exports: [CatalogoDeModulos, ModulosService],
    };
  }
}
