import { Module } from '@nestjs/common';
import { AuthModule } from './core/auth/auth.module.js';
import { ModulosModule } from './core/modulos/modulos.module.js';
import { manifiestoCotizador } from './modules/cotizador/cotizador.manifest.js';
import { manifiestoRegistro } from './modules/registro/registro.manifest.js';
import { ConfigModule } from './infra/config/config.module.js';
import { DatabaseModule } from './infra/database/database.module.js';
import { HealthModule } from './infra/health/health.module.js';
import { HttpModule } from './infra/http/http.module.js';
import { LoggerModule } from './infra/logger/logger.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    HttpModule,
    DatabaseModule,
    ModulosModule.con([manifiestoRegistro, manifiestoCotizador]),
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
