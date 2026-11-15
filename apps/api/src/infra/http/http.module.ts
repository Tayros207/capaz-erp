import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FiltroDeErrores } from './filtro-de-errores.js';

@Module({ providers: [{ provide: APP_FILTER, useClass: FiltroDeErrores }] })
export class HttpModule {}
