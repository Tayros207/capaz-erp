import type { z } from 'zod';
import type { ContratoDeHerramienta } from '../herramientas.js';
import { contratosDeEmpresa, eventosDeEmpresa } from './empresa.js';
import { contratosDeModulos, eventosDeModulos } from './modulos.js';
import { contratosDeAuditoria, eventosDeAuditoria } from './auditoria.js';
import { contratosDeMiembros, eventosDeMiembros } from './miembros.js';
import { contratosDeClientes, eventosDeClientes } from './clientes.js';
import { contratosDeProductos, eventosDeProductos } from './productos.js';
import { contratosDeMaestrosAmpliados, eventosDeMaestrosAmpliados } from './maestros-ampliados.js';
import { contratosDeInsumosOperaciones, eventosDeInsumosOperaciones } from './insumos-operaciones.js';
import { contratosDeComprasOperaciones, eventosDeComprasOperaciones } from './compras-operaciones.js';
import { contratosDeSucursales, eventosDeSucursales } from './sucursales.js';
import { contratosDeBorradores, eventosDeBorradores } from './borradores.js';
import { contratosDeConexiones, eventosDeConexiones } from './conexiones.js';
import { contratosDeAutomatizaciones, eventosDeAutomatizaciones } from './automatizaciones.js';
import { contratosDeIntercambio, eventosDeIntercambio } from './intercambio.js';
import { contratosDePlataforma, eventosDePlataforma } from './plataforma.js';
import { contratosDeRegistro, eventosDeRegistro } from './registro.js';
import { contratosDeCrm, eventosDeCrm } from './crm.js';
import { contratosDeOrdenes, eventosDeOrdenes } from './ordenes.js';
import { contratosDeInsumos, eventosDeInsumos } from './insumos.js';
import { contratosDeCompras, eventosDeCompras } from './compras.js';
import { contratosDePersonal, eventosDePersonal } from './personal.js';
import { contratosDeReportes, eventosDeReportes } from './reportes.js';
import { contratosDeCaptura, eventosDeCaptura } from './captura.js';
import { contratosDeCotizador, eventosDeCotizador } from './cotizador.js';

export * from './empresa.js';
export * from './modulos.js';
export * from './auditoria.js';
export * from './miembros.js';
export * from './clientes.js';
export * from './productos.js';
export * from './maestros-ampliados.js';
export * from './insumos-operaciones.js';
export * from './compras-operaciones.js';
export * from './sucursales.js';
export * from './borradores.js';
export * from './conexiones.js';
export * from './automatizaciones.js';
export * from './intercambio.js';
export * from './plataforma.js';
export * from './registro.js';
export * from './crm.js';
export * from './ordenes.js';
export * from './insumos.js';
export * from './compras.js';
export * from './personal.js';
export * from './reportes.js';
export * from './captura.js';
export * from './cotizador.js';

// Cada área aporta sus contratos y sus eventos; agregar uno solo obliga a editar el archivo del área.
export const CONTRATOS = {
  ...contratosDeEmpresa,
  ...contratosDeModulos,
  ...contratosDeAuditoria,
  ...contratosDeMiembros,
  ...contratosDeClientes,
  ...contratosDeProductos,
  ...contratosDeMaestrosAmpliados,
  ...contratosDeInsumosOperaciones,
  ...contratosDeComprasOperaciones,
  ...contratosDeSucursales,
  ...contratosDeBorradores,
  ...contratosDeConexiones,
  ...contratosDeAutomatizaciones,
  ...contratosDeIntercambio,
  ...contratosDeRegistro,
  ...contratosDeCrm,
  ...contratosDeOrdenes,
  ...contratosDeInsumos,
  ...contratosDeCompras,
  ...contratosDePersonal,
  ...contratosDeReportes,
  ...contratosDeCaptura,
  ...contratosDeCotizador,
} as const satisfies Record<string, ContratoDeHerramienta>;

/** Herramientas de la consola de plataforma: viven aparte (rol de plataforma). */
export const CONTRATOS_DE_PLATAFORMA = { ...contratosDePlataforma } as const satisfies Record<string, ContratoDeHerramienta>;

export const EVENTOS = {
  ...eventosDeEmpresa,
  ...eventosDeModulos,
  ...eventosDeAuditoria,
  ...eventosDeMiembros,
  ...eventosDeClientes,
  ...eventosDeProductos,
  ...eventosDeMaestrosAmpliados,
  ...eventosDeInsumosOperaciones,
  ...eventosDeComprasOperaciones,
  ...eventosDeSucursales,
  ...eventosDeBorradores,
  ...eventosDeConexiones,
  ...eventosDeAutomatizaciones,
  ...eventosDeIntercambio,
  ...eventosDePlataforma,
  ...eventosDeRegistro,
  ...eventosDeCrm,
  ...eventosDeOrdenes,
  ...eventosDeInsumos,
  ...eventosDeCompras,
  ...eventosDePersonal,
  ...eventosDeReportes,
  ...eventosDeCaptura,
  ...eventosDeCotizador,
} as const satisfies Record<string, z.ZodType>;

export type NombreDeHerramienta = keyof typeof CONTRATOS;
export type EntradaDe<N extends NombreDeHerramienta> = z.input<(typeof CONTRATOS)[N]['entrada']>;
export type ArgsDe<N extends NombreDeHerramienta> = z.output<(typeof CONTRATOS)[N]['entrada']>;
export type SalidaDe<N extends NombreDeHerramienta> = z.output<(typeof CONTRATOS)[N]['salida']>;
export type TipoDeEvento = keyof typeof EVENTOS;
export type CargaDe<T extends TipoDeEvento> = z.output<(typeof EVENTOS)[T]>;
