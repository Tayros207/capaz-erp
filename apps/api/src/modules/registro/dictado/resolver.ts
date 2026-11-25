// Resuelve nombres a identificadores leyendo la base. Solo lee (R19): ni siembra catálogos ni guarda nada.
import type { SugerenciaDeCaptura } from '@capaz/shared';
import { buscarClientes } from '../../../core/clientes/repositories/clientes.repository.js';
import { normalizarNombre } from '../../../core/clientes/domain/normalizacion.js';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { codigoDeDeuda } from '../domain/codigos.js';
import { categoriaConNombre } from '../repositories/categorias.repository.js';
import { listarCuentas } from '../repositories/cuentas.repository.js';
import { listarDeudas, type Deuda } from '../repositories/deudas.repository.js';
import { categoriasUsadasConContacto } from '../repositories/movimientos.repository.js';
import { propietarioDe } from '../herramientas/comun.js';
import { DOMINANCIA_MINIMA, MINIMO_REGISTROS } from './reglas/categoria.js';
import { esProbableMismaPersona } from './reglas/similitud-nombres.js';

export type ContactoResuelto = { id: string; nombre: string };
export type ResolucionDeContacto = { contacto: ContactoResuelto | null; sugerencia: SugerenciaDeCaptura | null };

const opcion = (c: { id: string; nombre: string }) => ({ id: c.id, nombre: c.nombre });

/** Del nombre dictado al cliente: coincidencia exacta; si no, el único parecido; si hay varios o ninguno, una sugerencia. */
export async function resolverContacto(tx: Transaccion, ctx: ContextoDeHerramienta, dictado: string | null): Promise<ResolucionDeContacto> {
  if (dictado === null) return { contacto: null, sugerencia: null };
  const n = normalizarNombre(dictado);
  const candidatos = await buscarClientes(tx, ctx, n, 5);
  const exacto = candidatos.find((c) => c.nombreNormalizado === n);
  if (exacto) return { contacto: opcion(exacto), sugerencia: null };
  const probables = candidatos.filter((c) => esProbableMismaPersona(dictado, c.nombre));
  if (probables.length === 1) return { contacto: opcion(probables[0]!), sugerencia: null };
  const opciones = (probables.length > 1 ? probables : candidatos.slice(0, 3)).map(opcion);
  return { contacto: null, sugerencia: { campo: 'contactoId', texto: dictado, opciones } };
}

export type CuentaResuelta = { id: string | null; faltan: string[] };

/**
 * De la cuenta nombrada («caja chica», «BCP») a su id: el nombre exacto, o la ÚNICA cuenta activa que lo contiene. Si no hay una
 * sola, no se elige ninguna (rige la principal) y se avisa: elegir la cuenta equivocada mueve el saldo de otra.
 */
export async function resolverCuenta(tx: Transaccion, ctx: ContextoDeHerramienta, dicha: string | null): Promise<CuentaResuelta> {
  if (dicha === null) return { id: null, faltan: [] };
  const n = normalizarNombre(dicha);
  const cuentas = await listarCuentas(tx, ctx, { incluirArchivadas: false });
  const exacta = cuentas.find((c) => c.nombreNormalizado === n);
  const parecidas = cuentas.filter((c) => c.nombreNormalizado.includes(n) || n.includes(c.nombreNormalizado));
  const elegida = exacta ?? (parecidas.length === 1 ? parecidas[0]! : null);
  return elegida ? { id: elegida.id, faltan: [] } : { id: null, faltan: [`la cuenta «${dicha}»: no encontré una sola con ese nombre, elígela en la tarjeta`] };
}

/** La categoría habitual del contacto, con las mismas reglas que `sugerirPorHistorial` pero con identificadores. */
async function categoriaHabitual(tx: Transaccion, ctx: ContextoDeHerramienta, contactoId: string, tipo: string): Promise<string | null> {
  const historial = await categoriasUsadasConContacto(tx, ctx, contactoId, tipo);
  const total = historial.reduce((a, f) => a + f.veces, 0);
  if (total < MINIMO_REGISTROS) return null;
  const maximo = Math.max(...historial.map((f) => f.veces));
  const lideres = historial.filter((f) => f.veces === maximo);
  // Empate en el máximo = no hay dominante.
  if (lideres.length !== 1) return null;
  return maximo / total >= DOMINANCIA_MINIMA ? lideres[0]!.categoriaId : null;
}

/** La categoría de Capaz que corresponde al dictado; si no hay, la habitual del contacto. `null` si no hay ninguna (no siembra). */
export async function resolverCategoria(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  tipo: 'ingreso' | 'egreso',
  categoriaDeCapaz: string | null,
  contactoId: string | null,
): Promise<string | null> {
  if (categoriaDeCapaz) {
    const c = await categoriaConNombre(tx, ctx, tipo, normalizarNombre(categoriaDeCapaz));
    if (c) return c.id;
  }
  return contactoId ? categoriaHabitual(tx, ctx, contactoId, tipo) : null;
}

/** Deudas abiertas del contacto y del tipo, respetando el alcance «propios»; la más antigua primero. */
export async function deudasAbiertasDe(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  contactoId: string,
  tipo: 'por_cobrar' | 'por_pagar',
  hoy: string,
): Promise<Array<Deuda & { codigo: string }>> {
  const { items } = await listarDeudas(tx, ctx, { limite: 100, cursor: null, tipo, estado: 'abiertas', contactoId, hoy }, propietarioDe(ctx));
  return items
    .map((d) => ({ ...d, codigo: codigoDeDeuda(tipo, d.anio, d.numero) }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.numero - b.numero));
}
