import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { EmpresasModule } from '../empresas/empresas.module.js';
import { AUTH, crearAuth } from './auth.js';
import { GuardiaDeIdentidad } from './guardia.js';

@Global()
@Module({
  imports: [EmpresasModule],
  providers: [
    { provide: AUTH, useFactory: (db: DatabaseService, c: Config) => crearAuth(db, c), inject: [DatabaseService, CONFIG] },
    { provide: APP_GUARD, useClass: GuardiaDeIdentidad },
  ],
  exports: [AUTH],
})
export class AuthModule {}
