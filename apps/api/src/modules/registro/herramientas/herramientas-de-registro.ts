import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { RegistroDeConsumidores } from '../../../core/eventos/registro-de-consumidores.js';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { CONSUMIDORES_DE_REGISTRO } from '../consumidores.js';
import { FUENTES_DE_REGISTRO } from '../fuentes.js';
import { categoriaArchivar, categoriaCrear, categoriaEditar, categoriasListar } from './categorias-herramientas.js';
import { cuentaArchivar, cuentaCrear, cuentaEditar, cuentaMarcarPrincipal, cuentasListar, registroIniciar } from './cuentas-herramientas.js';
import { deudaAbonar } from './deudas-abonar.js';
import { deudaAnular, deudaCrear, deudaEditar } from './deudas-escritura.js';
import { deudasListar, deudaVer } from './deudas-lectura.js';
import { movimientoAnular, movimientoRegistrar } from './movimientos-escritura.js';
import { movimientosListar, movimientoVer } from './movimientos-lectura.js';
import { cuentasTransferir } from './transferencias.js';
import { cajaDelDia, registroResumen } from './reportes-herramientas.js';

export const HERRAMIENTAS_DE_REGISTRO = [
  registroIniciar,
  cuentasListar,
  cuentaCrear,
  cuentaEditar,
  cuentaArchivar,
  cuentaMarcarPrincipal,
  categoriasListar,
  categoriaCrear,
  categoriaEditar,
  categoriaArchivar,
  movimientoRegistrar,
  movimientoVer,
  movimientosListar,
  movimientoAnular,
  cuentasTransferir,
  deudaCrear,
  deudaVer,
  deudasListar,
  deudaEditar,
  deudaAbonar,
  deudaAnular,
  cajaDelDia,
  registroResumen,
] as const;

/** Todo lo que el módulo `registro` aporta al servidor: herramientas, consumidores de eventos y fuentes de tiempo. */
@Injectable()
export class HerramientasDeRegistro implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly herramientas: RegistroDeHerramientas,
    @Inject(RegistroDeConsumidores) private readonly consumidores: RegistroDeConsumidores,
    @Inject(RegistroDeFuentesDeTiempo) private readonly fuentes: RegistroDeFuentesDeTiempo,
  ) {}

  onModuleInit(): void {
    this.herramientas.agregar(HERRAMIENTAS_DE_REGISTRO);
    this.consumidores.agregar(CONSUMIDORES_DE_REGISTRO);
    this.fuentes.agregar(FUENTES_DE_REGISTRO);
  }
}
