import { Global, Module } from '@nestjs/common';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { Cifrador } from './cifrado.js';
import { EntradaController } from './entrada.controller.js';
import { HerramientasDeConexiones } from './herramientas-de-conexiones.js';
import { RegistroDeConectores } from './registro-de-conectores.js';
import { CIFRADOR } from './tokens.js';

/** Global: los módulos de conexiones inyectan `RegistroDeConectores` y `CIFRADOR` para declarar el suyo. */
@Global()
@Module({
  controllers: [EntradaController],
  providers: [
    { provide: CIFRADOR, useFactory: (config: Config) => Cifrador.desdeConfig(config), inject: [CONFIG] },
    RegistroDeConectores,
    HerramientasDeConexiones,
  ],
  exports: [RegistroDeConectores, CIFRADOR],
})
export class ConectoresModule {}
