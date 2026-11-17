import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { CONFIG, type Config } from '../../../infra/config/config.js';
import { ajusteClienteFijar, ajustesClienteListar } from './ajustes-herramientas.js';
import { cotizadorConfiguracionVer, cotizadorConfigurar, cotizadorIniciar } from './configuracion-herramientas.js';
import { crearHerramientasDeEnlaces } from './enlaces-herramientas.js';
import { listaPrecioVer, listasPrecioListar } from './listas-lectura.js';
import { listaPrecioArchivar, listaPrecioCrear, listaPrecioEditar, listaPrecioRestaurar } from './listas-escritura.js';
import { listasPrecioAjustarEnBloque } from './listas-bloque.js';
import { formatoPliegoRestaurar, itemCuadroRestaurar, maquinaRestaurar, tarifaRestaurar } from './taller-restaurar.js';
import { cotizacionEmitir, cotizacionDuplicar, cotizacionNuevaVersion } from './cotizaciones-emision.js';
import { cotizacionCrear, cotizacionEditar } from './cotizaciones-escritura.js';
import { cotizacionAceptar, cotizacionAnular, cotizacionMarcarEnviada, cotizacionRechazar } from './cotizaciones-estado.js';
import { cotizacionesListar, cotizacionVer, cotizadorResumen } from './cotizaciones-lectura.js';
import { formatoPliegoArchivar, formatoPliegoCrear, formatoPliegoEditar, formatosPliegoListar } from './taller-formatos.js';
import { itemCuadroArchivar, itemCuadroCrear, itemCuadroEditar, itemsCuadroListar, itemsCuadroReordenar } from './taller-items.js';
import { maquinaArchivar, maquinaCrear, maquinaEditar, maquinasListar } from './taller-maquinas.js';
import { tallerSembrar } from './taller-sembrar.js';
import { tarifaArchivar, tarifaCrear, tarifaEditar, tarifasListar } from './taller-tarifas.js';
import { precioConsultar } from './precio-consultar.js';
import { cotizadorProductosBuscar } from './productos-buscar.js';
import { cuadroFijarCostoDirecto, cuadroFijarColumnasAEnviar, cuadroFijarPrecioFinal, cuadroFijarUtilidad } from './cuadro-costos.js';
import { cuadroCalcular, cuadroIniciar, cuadroVer } from './cuadro-iniciar.js';
import { cuadroItemAgregar, cuadroItemEditar, cuadroItemQuitar } from './cuadro-items.js';
import { cuadroLineaAgregar, cuadroLineaEditar, cuadroLineaQuitar } from './cuadro-lineas.js';
import { cuadroGenerarReferencias, cuadroGuardarReferencias } from './cuadro-referencias.js';
import { cuadroFijarImposicion, cuadroFijarTrabajo } from './cuadro-trabajo.js';

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
  listaPrecioRestaurar,
  listasPrecioAjustarEnBloque,
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
  // Taller (cot-s3): formatos, máquinas, tarifas, ítems del cuadro y la carga de ejemplo.
  formatosPliegoListar, formatoPliegoCrear, formatoPliegoEditar, formatoPliegoArchivar,
  maquinasListar, maquinaCrear, maquinaEditar, maquinaArchivar,
  tarifasListar, tarifaCrear, tarifaEditar, tarifaArchivar,
  itemsCuadroListar, itemCuadroCrear, itemCuadroEditar, itemCuadroArchivar, itemsCuadroReordenar,
  formatoPliegoRestaurar, maquinaRestaurar, tarifaRestaurar, itemCuadroRestaurar,
  tallerSembrar,
  // Cuadro por partes (cot-s4).
  cuadroIniciar, cuadroVer, cuadroFijarTrabajo, cuadroFijarImposicion, cuadroLineaAgregar, cuadroLineaEditar, cuadroLineaQuitar,
  cuadroFijarCostoDirecto, cuadroFijarColumnasAEnviar, cuadroFijarUtilidad, cuadroFijarPrecioFinal, cuadroCalcular,
  cuadroItemAgregar, cuadroItemEditar, cuadroItemQuitar, cuadroGenerarReferencias, cuadroGuardarReferencias,
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
