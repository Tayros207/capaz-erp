import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { middlewareDeCabeceras } from './cabeceras.js';
import { HerramientasDeMiembros } from './herramientas/herramientas-de-miembros.js';
import { ServicioDeMiembros } from './miembros.service.js';

@Module({
  providers: [ServicioDeMiembros, HerramientasDeMiembros],
  exports: [ServicioDeMiembros],
})
export class MiembrosModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Better Auth necesita la cookie de quien actúa para operar por su API de servidor (ver cabeceras.ts).
    consumer.apply(middlewareDeCabeceras).forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
