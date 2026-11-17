import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { ajusteClienteFijar, ajustesClienteListar } from './ajustes-herramientas.js';
import { cotizadorConfiguracionVer, cotizadorConfigurar, cotizadorIniciar } from './configuracion-herramientas.js';
import { listaPrecioVer, listasPrecioListar } from './listas-lectura.js';
import { listaPrecioArchivar, listaPrecioCrear, listaPrecioEditar } from './listas-escritura.js';
import { precioConsultar } from './precio-consultar.js';

/** Once herramientas en esta parte (R15: máximo 13). Las cotizaciones llegan con s2. */
export const HERRAMIENTAS_DE_COTIZADOR = [
  cotizadorIniciar,
  cotizadorConfiguracionVer,
  cotizadorConfigurar,
  listasPrecioListar,
  listaPrecioVer,
  listaPrecioCrear,
  listaPrecioEditar,
  listaPrecioArchivar,
  precioConsultar,
  ajustesClienteListar,
  ajusteClienteFijar,
] as const;

/** Todo lo que el módulo `cotizador` aporta al servidor en esta parte: herramientas (sin consumidores ni fuentes de tiempo). */
@Injectable()
export class HerramientasDeCotizador implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly herramientas: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.herramientas.agregar(HERRAMIENTAS_DE_COTIZADOR);
  }
}
