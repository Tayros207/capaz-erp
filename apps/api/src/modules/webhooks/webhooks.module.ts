import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { RegistroDeConectores } from '../../core/conectores/registro-de-conectores.js';
import { RegistroDeConsumidores } from '../../core/eventos/registro-de-consumidores.js';
import { EntregaDeWebhooks } from './entrega.js';
import { HerramientasDeWebhooks } from './herramientas-de-webhooks.js';
import { conectorWebhooks } from './webhooks.connector.js';

@Module({ providers: [EntregaDeWebhooks, HerramientasDeWebhooks] })
export class WebhooksModule implements OnModuleInit {
  constructor(
    @Inject(RegistroDeConectores) private readonly conectores: RegistroDeConectores,
    @Inject(RegistroDeConsumidores) private readonly consumidores: RegistroDeConsumidores,
    @Inject(EntregaDeWebhooks) private readonly entrega: EntregaDeWebhooks,
  ) {}

  onModuleInit(): void {
    this.conectores.agregar(conectorWebhooks);
    this.consumidores.agregar([this.entrega.consumidor()]);
  }
}
