import { Module } from '@nestjs/common';
import { HerramientasDeClientes } from './herramientas/herramientas-de-clientes.js';

@Module({ providers: [HerramientasDeClientes] })
export class ClientesModule {}
