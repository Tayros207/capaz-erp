import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { CONFIG, type Config } from '../../../infra/config/config.js';
import { ajusteClienteFijar, ajustesClienteListar } from './ajustes-herramientas.js';
import { cotizadorConfiguracionVer, cotizadorConfigurar, cotizadorIniciar } from './configuracion-herramientas.js';
import { crearHerramientasDeEnlaces } from './enlaces-herramientas.js';
import { listaPrecioVer, listasPrecioListar } from './listas-lectura.js';
import { listaPrecioArchivar, listaPrecioCrear, listaPrecioEditar } from './listas-escritura.js';
import { cotizacionEmitir, cotizacionDuplicar, cotizacionNuevaVersion } from './cotizaciones-emision.js';
import { cotizacionCrear, cotizacionEditar } from './cotizaciones-escritura.js';
import { cotizacionAceptar, cotizacionAnular, cotizacionMarcarEnviada, cotizacionRechazar } from './cotizaciones-estado.js';
import { cotizacionesListar, cotizacionVer, cotizadorResumen } from './cotizaciones-lectura.js';
import { precioConsultar } from './precio-consultar.js';
import { cotizadorProductosBuscar } from './productos-buscar.js';

/** Once de s1 (precios y configuración), doce de s2 (cotizaciones) y el buscador del catálogo; R15 cuenta por sesión: máximo 13. */
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
  cotizadorProductosBuscar,
  ajustesClienteListar,
  ajusteClienteFijar,
  cotizacionCrear,
  cotizacionEditar,
  cotizacionVer,
  cotizacionesListar,
  cotizacionEmitir,
  cotizacionNuevaVersion,
  cotizacionDuplicar,
  cotizacionMarcarEnviada,
  cotizacionAceptar,
  cotizacionRechazar,
  cotizacionAnular,
  cotizadorResumen,
] as const;

/** Todo lo que el módulo `cotizador` aporta al servidor en esta parte: herramientas (sin consumidores ni fuentes de tiempo). */
@Injectable()
export class HerramientasDeCotizador implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly herramientas: RegistroDeHerramientas,
    @Inject(CONFIG) private readonly config: Pick<Config, 'BETTER_AUTH_URL'>,
  ) {}

  onModuleInit(): void {
    // Las del enlace público necesitan la URL base de la configuración: se crean aquí, no en la lista fija.
    this.herramientas.agregar([...HERRAMIENTAS_DE_COTIZADOR, ...crearHerramientasDeEnlaces({ urlBase: this.config.BETTER_AUTH_URL })]);
  }
}
