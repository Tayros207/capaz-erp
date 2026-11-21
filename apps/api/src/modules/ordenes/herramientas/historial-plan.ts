import { CLIENTE_DE_HISTORIAL_SIN_NOMBRE, MAX_CLIENTES_NUEVOS_POR_HISTORIAL, SERIE_DE_HISTORIAL, rechazo, type FilaConMotivo } from '@capaz/shared';
import type { Separador } from '../../../core/intercambio/csv.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { CLAVE_DE_CLIENTE_VARIOS, claveDeCliente, leerHistorial, type FilaDeHistorial } from '../domain/historial.js';
import { clientesPorNombre, huellasExistentes, sucursalConCodigo } from '../repositories/historial.repository.js';

// Lo que haría una importación del historial: trabajos nuevos, repetidos, con error y clientes por crear. Solo lee la base.

export type FilaPlanificada = FilaDeHistorial & { claveCliente: string };
export type ClientePorCrear = { clave: string; nombre: string; filas: number[] };

export type Plan = {
  separador: Separador;
  total: number;
  omitidasPorFecha: number;
  columnasIgnoradas: string[];
  errores: FilaConMotivo[];
  duplicadas: FilaConMotivo[];
  nuevas: FilaPlanificada[];
  clientesPorCrear: ClientePorCrear[];
  /** Cliente existente por nombre normalizado. */
  existentes: Map<string, string>;
};

export type Entrada = { contenido: string; separador?: Separador | undefined; desde: string; crearClientesFaltantes: boolean };
export type ResultadoDePlan = { ok: true; plan: Plan } | ReturnType<typeof rechazo>;

const SIN_CLIENTE = (nombre: string) => `No existe el cliente «${nombre}»: créalo antes o marca «Crear los clientes que falten».`;
const clavesDe = (f: FilaDeHistorial): string[] => (f.cliente === null ? [CLAVE_DE_CLIENTE_VARIOS] : [claveDeCliente(f.cliente), ...(f.clienteOriginal ? [claveDeCliente(f.clienteOriginal)] : [])]);

/** Reparte las filas entre clientes que existen, clientes por crear y errores de fila. */
function asignarClientes(filas: readonly FilaDeHistorial[], existentes: Map<string, string>, crear: boolean) {
  const nuevas: FilaPlanificada[] = [];
  const errores: FilaConMotivo[] = [];
  const porCrear = new Map<string, ClientePorCrear>();
  for (const f of filas) {
    const encontrada = clavesDe(f).find((c) => existentes.has(c));
    if (encontrada) {
      nuevas.push({ ...f, claveCliente: encontrada });
    } else if (f.cliente === null || crear) {
      const nombre = f.cliente ?? CLIENTE_DE_HISTORIAL_SIN_NOMBRE;
      const clave = claveDeCliente(nombre);
      const previo = porCrear.get(clave) ?? { clave, nombre, filas: [] };
      previo.filas.push(f.fila);
      porCrear.set(clave, previo);
      nuevas.push({ ...f, claveCliente: clave });
    } else errores.push({ fila: f.fila, motivo: SIN_CLIENTE(f.cliente) });
  }
  return { nuevas, errores, porCrear: [...porCrear.values()] };
}

/** Lee el archivo, valida cada fila y separa nuevas, repetidas y erróneas. No escribe nada. */
export async function planificarHistorial(tx: Transaccion, ctx: ContextoDeEmpresa, entrada: Entrada): Promise<ResultadoDePlan> {
  const hoy = await hoyDeLaEmpresa(tx);
  const lectura = leerHistorial(entrada.contenido, { ...(entrada.separador && { separador: entrada.separador }), desde: entrada.desde, hoy: hoy.dia });
  if (!lectura.ok) return rechazo('argumentos_invalidos', lectura.motivo);
  const sucursal = await sucursalConCodigo(tx, ctx, SERIE_DE_HISTORIAL);
  if (sucursal) return rechazo('conflicto', `La sucursal «${sucursal}» usa el código ${SERIE_DE_HISTORIAL}, reservado para el historial importado: cambia su código antes de importar.`);

  const repetidas = await huellasExistentes(tx, ctx, lectura.filas.map((f) => f.huella));
  const duplicadas: FilaConMotivo[] = lectura.filas.filter((f) => repetidas.has(f.huella)).map((f) => ({ fila: f.fila, motivo: 'Ya se importó antes: se omite.' }));
  const pendientes = lectura.filas.filter((f) => !repetidas.has(f.huella));

  const existentes = await clientesPorNombre(tx, ctx, [...new Set(pendientes.flatMap(clavesDe))]);
  const { nuevas, errores, porCrear } = asignarClientes(pendientes, existentes, entrada.crearClientesFaltantes);
  const faltan = porCrear.filter((c) => c.clave !== CLAVE_DE_CLIENTE_VARIOS).length;
  if (faltan > MAX_CLIENTES_NUEVOS_POR_HISTORIAL) {
    return rechazo('conflicto', `Faltan ${faltan} clientes (máximo ${MAX_CLIENTES_NUEVOS_POR_HISTORIAL} por archivo): impórtalos antes desde Conecta › Importar.`);
  }
  const todosLosErrores = [...lectura.errores, ...errores].sort((a, b) => a.fila - b.fila);
  return {
    ok: true,
    plan: { separador: lectura.separador, total: lectura.total, omitidasPorFecha: lectura.omitidasPorFecha, columnasIgnoradas: lectura.columnasIgnoradas, errores: todosLosErrores, duplicadas, nuevas, clientesPorCrear: porCrear, existentes },
  };
}
