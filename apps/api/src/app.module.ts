import { Module } from '@nestjs/common';
import { AuthModule } from './core/auth/auth.module.js';
import { HerramientasModule } from './core/herramientas/herramientas.module.js';
import { ModulosModule } from './core/modulos/modulos.module.js';
import { manifiestoCotizador } from './modules/cotizador/cotizador.manifest.js';
import { manifiestoRegistro } from './modules/registro/registro.manifest.js';
import { AuditoriaModule } from './core/auditoria/auditoria.module.js';
import { EventosModule } from './core/eventos/eventos.module.js';
import { CorrelativosModule } from './core/correlativos/correlativos.module.js';
import { ClientesModule } from './core/clientes/clientes.module.js';
import { ProductosModule } from './core/productos/productos.module.js';
import { SucursalesModule } from './core/sucursales/sucursales.module.js';
import { MiembrosModule } from './core/miembros/miembros.module.js';
import { BorradoresModule } from './core/borradores/borradores.module.js';
import { PlataformaModule } from './core/plataforma/plataforma.module.js';
import { ConectoresModule } from './core/conectores/conectores.module.js';
import { AutomatizacionesModule } from './core/automatizaciones/automatizaciones.module.js';
import { IntercambioModule } from './core/intercambio/intercambio.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { manifiestoCrm } from './modules/crm/crm.manifest.js';
import { OrdenesModule } from './modules/ordenes/ordenes.module.js';
import { manifiestoOrdenes } from './modules/ordenes/ordenes.manifest.js';
import { ComprasModule } from './modules/compras/compras.module.js';
import { manifiestoCompras } from './modules/compras/compras.manifest.js';
import { InsumosModule } from './modules/insumos/insumos.module.js';
import { manifiestoInsumos } from './modules/insumos/insumos.manifest.js';
import { PersonalModule } from './modules/personal/personal.module.js';
import { manifiestoPersonal } from './modules/personal/personal.manifest.js';
import { ReportesModule } from './modules/reportes/reportes.module.js';
import { manifiestoReportes } from './modules/reportes/reportes.manifest.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { manifiestoWebhooks } from './modules/webhooks/webhooks.manifest.js';
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
    ModulosModule.con([
      manifiestoRegistro,
      manifiestoCotizador,
      manifiestoCrm,
      manifiestoOrdenes,
      manifiestoCompras,
      manifiestoInsumos,
      manifiestoPersonal,
      manifiestoReportes,
      manifiestoWebhooks,
    ]),
    HerramientasModule,
    AuthModule,
    HealthModule,
    AuditoriaModule,
    EventosModule,
    CorrelativosModule,
    ClientesModule,
    ProductosModule,
    SucursalesModule,
    MiembrosModule,
    BorradoresModule,
    PlataformaModule,
    ConectoresModule,
    AutomatizacionesModule,
    IntercambioModule,
    CrmModule,
    OrdenesModule,
    ComprasModule,
    InsumosModule,
    PersonalModule,
    ReportesModule,
    WebhooksModule,
  ],
})
export class AppModule {}
