import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeConsumidores } from '../../../core/eventos/registro-de-consumidores.js';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { CONSUMIDORES_DE_INSUMOS } from '../consumidores.js';
import { articuloActivar, articuloArchivar, articuloEditar } from './articulos-escritura.js';
import { articuloVer, articulosListar } from './articulos-lectura.js';
import { existenciaAjustar, existenciaMover } from './existencias-escritura.js';
import { existenciasListar, existenciasMovimientosListar, insumosResumen } from './existencias-lectura.js';
import { existenciasRecibir } from './existencias-recibir.js';
import { conteoAbrir, conteoAnular, conteoCerrar, conteoRegistrar, conteoVer, conteosListar } from './operaciones-conteos.js';
import { existenciasKardex } from './operaciones-kardex.js';
import { transferenciaCrear, transferenciaVer, transferenciasListar } from './operaciones-transferencias.js';

export const HERRAMIENTAS_DE_INSUMOS = [
  articuloActivar,
  articuloEditar,
  articuloArchivar,
  articulosListar,
  articuloVer,
  existenciasListar,
  existenciaMover,
  existenciasRecibir,
  existenciaAjustar,
  existenciasMovimientosListar,
  insumosResumen,
  transferenciaCrear,
  transferenciaVer,
  transferenciasListar,
  conteoAbrir,
  conteoRegistrar,
  conteoCerrar,
  conteoAnular,
  conteoVer,
  conteosListar,
  existenciasKardex,
] as const;

/** Todo lo que el módulo `insumos` aporta al servidor: herramientas y el consumidor de compras. Sin fuentes de tiempo. */
@Injectable()
export class HerramientasDeInsumos implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly herramientas: RegistroDeHerramientas,
    @Inject(RegistroDeConsumidores) private readonly consumidores: RegistroDeConsumidores,
  ) {}

  onModuleInit(): void {
    this.herramientas.agregar(HERRAMIENTAS_DE_INSUMOS);
    this.consumidores.agregar(CONSUMIDORES_DE_INSUMOS);
  }
}
