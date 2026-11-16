import { Module } from '@nestjs/common';
import { HerramientasDeRegistro } from './herramientas/herramientas-de-registro.js';

/** Finanzas ligeras: caja, movimientos, cuentas por cobrar y por pagar, abonos. */
@Module({ providers: [HerramientasDeRegistro] })
export class RegistroModule {}
