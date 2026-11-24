import { Module } from '@nestjs/common';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { AgenteController } from './agente.controller.js';
import { HerramientasDeAgente } from './herramientas-de-agente.js';
import { HerramientasDeMemoria } from './herramientas-de-memoria.js';
import { PreciosDeModelos } from './precios-de-modelos.js';
import { MODELO_DE_CHAT, type ModeloDeChat } from './modelo-de-chat.js';
import { ModeloDeOpenRouter } from './modelo-de-openrouter.js';
import { ModeloSimulado } from './modelo-simulado.js';
import { ServicioDeConversaciones } from './servicio-de-conversaciones.js';
import { ServicioDeTurnos } from './servicio-de-turnos.js';

/**
 * Elige el modelo según la configuración. `apagado` (por defecto) no llama a nadie: el servicio rechaza el turno antes de usar
 * el modelo, así que el simulado que queda aquí nunca responde en la práctica. `simulado` solo existe fuera de producción.
 */
export function crearModeloDeChat(config: Pick<Config, 'AGENTE_PROVEEDOR' | 'OPENROUTER_API_KEY' | 'AGENTE_RAZONAMIENTO'>): ModeloDeChat {
  if (config.AGENTE_PROVEEDOR === 'openrouter') {
    if (!config.OPENROUTER_API_KEY) throw new Error('Falta la llave del proveedor del modelo.');
    return new ModeloDeOpenRouter({ apiKey: config.OPENROUTER_API_KEY, razonamiento: config.AGENTE_RAZONAMIENTO });
  }
  return new ModeloSimulado();
}

@Module({
  controllers: [AgenteController],
  providers: [
    { provide: MODELO_DE_CHAT, inject: [CONFIG], useFactory: crearModeloDeChat },
    // Los precios se consultan a OpenRouter solo si el proveedor es OpenRouter: con el asistente apagado o simulado no se sale a la red.
    { provide: PreciosDeModelos, inject: [CONFIG], useFactory: (c: Config) => new PreciosDeModelos({ habilitado: c.AGENTE_PROVEEDOR === 'openrouter' }) },
    HerramientasDeAgente,
    HerramientasDeMemoria,
    ServicioDeTurnos,
    ServicioDeConversaciones,
  ],
})
export class AgenteModule {}
