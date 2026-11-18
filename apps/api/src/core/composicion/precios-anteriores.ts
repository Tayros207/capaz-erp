import {
  coincidenciaDeDescripcion,
  exito,
  normalizarDescripcion,
  raicesDeBusqueda,
  salidaDePreciosAnterioresSchema,
  similitudDeDescripciones,
  type EntradaDe,
  type FilaConCoincidencia,
  type FilaDePrecioAnterior,
  type PrecioAnteriorDto,
  type Respuesta,
} from '@capaz/shared';
import { hoyDeLaEmpresa } from '../empresas/hoy.js';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import type { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { normalizarNombre } from '../clientes/domain/normalizacion.js';
import { buscarClientes, verCliente } from '../clientes/repositories/clientes.repository.js';
import { verProducto } from '../productos/repositories/productos.repository.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// «Precio anterior»: ¿cuánto le cobramos la última vez a este cliente por este producto? El núcleo no lee tablas de ventas:
// descubre las subherramientas `<modulo>_precios_anteriores` de los módulos a los que la persona puede entrar (igual que el
// panel de reportes), les pide filas con las raíces de la descripción y es el único que decide qué es lo mismo.

const SUFIJO = '_precios_anteriores';
type Fuente = FilaDePrecioAnterior['fuente'];
/** Qué fuente de precios aporta cada módulo y cómo se nombra en un aviso. Un módulo que no está aquí no entra. */
const FUENTE_DE_MODULO: Readonly<Record<string, { fuente: Fuente; nombre: string }>> = {
  ordenes: { fuente: 'pedido', nombre: 'pedidos' },
  cotizador: { fuente: 'cotizacion', nombre: 'cotizaciones' },
  produccion: { fuente: 'orden_trabajo', nombre: 'órdenes de trabajo' },
};
const ESTADOS_DE_COTIZACION_ACEPTADA = 'aceptada';
const ANIOS_SIN_CLIENTE = 2;
const DOCUMENTOS_SIN_CLIENTE = 200;

export type CandidatoDeCliente = { id: string; nombre: string; parecido: number };

// --- cliente ---

/** Un solo candidato, un nombre idéntico o uno que destaca con claridad se elige solo; si no, la persona decide. */
export function elegirCliente(texto: string, candidatos: readonly CandidatoDeCliente[]): { elegido: CandidatoDeCliente | null; candidatos: CandidatoDeCliente[] } {
  const ordenados = [...candidatos].sort((a, b) => b.parecido - a.parecido);
  const [primero, segundo] = ordenados;
  if (!primero) return { elegido: null, candidatos: [] };
  const exactos = ordenados.filter((c) => normalizarNombre(c.nombre) === normalizarNombre(texto));
  const elegido = exactos.length === 1 ? exactos[0]! : !segundo ? primero : primero.parecido >= 0.5 && primero.parecido - segundo.parecido >= 0.2 ? primero : null;
  return { elegido, candidatos: elegido ? [] : ordenados };
}

// --- filas ---

/** Pone coincidencia y puntaje; descarta lo que no se parece. `productoId` igual gana siempre. */
export function clasificarFilas(filas: readonly FilaDePrecioAnterior[], busca: { productoId?: string; texto: string }): FilaConCoincidencia[] {
  const salida: FilaConCoincidencia[] = [];
  for (const f of filas) {
    if (busca.productoId && f.productoId === busca.productoId) {
      salida.push({ ...f, coincidencia: 'producto', puntaje: 1 });
      continue;
    }
    const puntaje = similitudDeDescripciones(busca.texto, f.descripcion);
    const coincidencia = coincidenciaDeDescripcion(puntaje);
    if (coincidencia) salida.push({ ...f, coincidencia, puntaje });
  }
  return salida;
}

const masNuevaPrimero = (a: FilaConCoincidencia, b: FilaConCoincidencia): number =>
  b.documento.fecha.localeCompare(a.documento.fecha) || b.puntaje - a.puntaje;
const esExacta = (f: FilaConCoincidencia): boolean => f.coincidencia === 'producto' || f.coincidencia === 'misma_descripcion';

/**
 * Reglas del núcleo. Se oculta la cotización aceptada que ya es origen de un pedido visible (sería contar dos veces lo mismo).
 * «Último» = lo más reciente entre pedidos y órdenes de trabajo con coincidencia exacta; si no hay, la cotización más reciente
 * (la pantalla la marca «Cotizado»). Las «parecidas» solo van al historial.
 */
export function ordenarResultado(filas: readonly FilaConCoincidencia[], limite: number): { ultimo: FilaConCoincidencia | null; historial: FilaConCoincidencia[] } {
  const visibles = sinCotizacionesYaPedidas(filas).sort(masNuevaPrimero);
  const ultimo = visibles.find((f) => f.fuente !== 'cotizacion' && esExacta(f)) ?? visibles.find((f) => f.fuente === 'cotizacion' && esExacta(f)) ?? null;
  return { ultimo, historial: visibles.filter((f) => f !== ultimo).slice(0, limite) };
}

/** Quita la cotización aceptada que ya es origen de un pedido visible (sería contar dos veces lo mismo). */
function sinCotizacionesYaPedidas<T extends FilaDePrecioAnterior>(filas: readonly T[]): T[] {
  const origenes = new Set(filas.flatMap((f) => (f.fuente === 'pedido' && f.origen?.tipo === 'cotizacion' ? [f.origen.id] : [])));
  return filas.filter((f) => !(f.fuente === 'cotizacion' && f.documento.estado === ESTADOS_DE_COTIZACION_ACEPTADA && origenes.has(f.documento.id)));
}

/** Qué es «la misma cosa» en la lista de un cliente: el producto del catálogo o la descripción normalizada, y la unidad. */
const claveDeProducto = (f: FilaDePrecioAnterior): string => {
  const unidad = f.unidad.trim().toLowerCase();
  if (f.productoId) return `p:${f.productoId}|${unidad}`;
  return `d:${normalizarDescripcion(f.descripcion) || f.descripcion.trim().toLowerCase()}|${unidad}`;
};

/**
 * Sin producto buscado: lo último que se le cobró al cliente por cada cosa, una fila por producto (y unidad), de lo más
 * reciente a lo más antiguo. Igual que el «último»: un pedido o una OT ganan a una cotización del mismo producto.
 */
export function ultimosPorProducto(filas: readonly FilaDePrecioAnterior[], limite: number): FilaConCoincidencia[] {
  const grupos = new Map<string, FilaDePrecioAnterior>();
  const porFecha = (a: FilaDePrecioAnterior, b: FilaDePrecioAnterior) => b.documento.fecha.localeCompare(a.documento.fecha);
  for (const f of sinCotizacionesYaPedidas(filas).sort(porFecha)) {
    const clave = claveDeProducto(f);
    const actual = grupos.get(clave);
    if (!actual || (actual.fuente === 'cotizacion' && f.fuente !== 'cotizacion')) grupos.set(clave, f);
  }
  return [...grupos.values()].sort(porFecha).slice(0, limite).map((f) => ({ ...f, coincidencia: 'del_cliente' as const, puntaje: 1 }));
}

const hace = (dia: string, anios: number): string => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  return d.toISOString().slice(0, 10);
};

// --- subherramientas ---

type Subherramienta = { nombre: string; modulo: string; fuente: Fuente; etiqueta: string; puede: boolean };

/** Las subherramientas registradas de módulos conocidos, con si la persona puede usarlas (módulo y permiso). */
export function subherramientasDe(registro: RegistroDeHerramientas, ctx: ContextoDeHerramienta): Subherramienta[] {
  return registro
    .todas()
    .filter((h) => h.nombre === `${h.modulo}${SUFIJO}` && h.modulo !== 'core' && FUENTE_DE_MODULO[h.modulo])
    .map((h) => {
      const acceso = ctx.modulos.find((m) => m.codigo === h.modulo);
      const f = FUENTE_DE_MODULO[h.modulo]!;
      const puede = !!acceso?.puedeEntrar && (h.permiso === null || ctx.permisos.includes(h.permiso));
      return { nombre: h.nombre, modulo: h.modulo, fuente: f.fuente, etiqueta: f.nombre, puede };
    });
}

type Consulta = { clienteId?: string; productoId?: string; raices: string[]; desde?: string; limiteDocumentos?: number };

async function consultarSubherramienta(ejecutor: EjecutorDeHerramientas, tx: Transaccion, ctx: ContextoDeHerramienta, s: Subherramienta, c: Consulta) {
  const r = await ejecutor.ejecutarDentro(tx, s.nombre, c, { ctx });
  if (!r.ok || !('datos' in r)) return { filas: [] as FilaDePrecioAnterior[], aviso: `no incluye ${s.etiqueta}: no se pudo consultar` };
  const salida = salidaDePreciosAnterioresSchema.safeParse(r.datos);
  if (!salida.success) return { filas: [] as FilaDePrecioAnterior[], aviso: `no incluye ${s.etiqueta}: respuesta no válida` };
  return { filas: salida.data.filas, aviso: null };
}

// --- la herramienta ---

type Entrada = EntradaDe<'precio_anterior_consultar'>;
const vacio = (cliente: PrecioAnteriorDto['cliente'], candidatos: CandidatoDeCliente[], fuentes: PrecioAnteriorDto['fuentesConsultadas']): PrecioAnteriorDto => ({
  cliente,
  candidatosDeCliente: candidatos,
  ultimo: null,
  historial: [],
  fuentesConsultadas: fuentes,
});

/** La lista de un cliente: todas sus líneas recientes (sin prefiltro de descripción) reducidas a una por producto. */
async function ultimosDelCliente(
  ejecutor: EjecutorDeHerramientas,
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  usables: readonly Subherramienta[],
  sinAcceso: PrecioAnteriorDto['fuentesConsultadas'],
  cliente: NonNullable<PrecioAnteriorDto['cliente']>,
  limite: number,
): Promise<PrecioAnteriorDto> {
  const filas: FilaDePrecioAnterior[] = [];
  const fuentes = [...sinAcceso];
  for (const s of usables) {
    const r = await consultarSubherramienta(ejecutor, tx, ctx, s, { clienteId: cliente.id, raices: [] });
    filas.push(...r.filas);
    fuentes.push({ fuente: s.fuente, incluida: r.aviso === null, aviso: r.aviso });
  }
  return { cliente, candidatosDeCliente: [], ultimo: null, historial: ultimosPorProducto(filas, limite), fuentesConsultadas: fuentes };
}

export async function consultarPrecioAnterior(
  ejecutor: EjecutorDeHerramientas,
  registro: RegistroDeHerramientas,
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  args: Entrada & { limite: number },
): Promise<Respuesta<PrecioAnteriorDto>> {
  const subs = subherramientasDe(registro, ctx);
  const sinAcceso: PrecioAnteriorDto['fuentesConsultadas'] = subs.filter((s) => !s.puede).map((s) => ({ fuente: s.fuente, incluida: false, aviso: `no incluye ${s.etiqueta}: sin acceso` }));

  // El cliente: por id o por texto (búsqueda por trigramas del núcleo).
  let cliente: PrecioAnteriorDto['cliente'] = null;
  if (args.clienteId) {
    const f = await verCliente(tx, ctx, args.clienteId);
    if (f) cliente = { id: f.id, nombre: f.nombre };
  } else if (args.clienteTexto) {
    const texto = normalizarNombre(args.clienteTexto);
    const filas = texto ? await buscarClientes(tx, ctx, texto, 6) : [];
    const { elegido, candidatos } = elegirCliente(args.clienteTexto, filas.map((f) => ({ id: f.id, nombre: f.nombre, parecido: Number(f.parecido) })));
    if (!elegido) return exito(vacio(null, candidatos, sinAcceso));
    cliente = { id: elegido.id, nombre: elegido.nombre };
  }
  if ((args.clienteId || args.clienteTexto) && !cliente) return exito(vacio(null, [], sinAcceso));

  const usables = subs.filter((s) => s.puede);
  // Solo el cliente (sin producto): sus últimos precios, uno por producto. El contrato exige cliente o producto.
  if (!args.productoId && !args.texto) {
    return exito(cliente ? await ultimosDelCliente(ejecutor, tx, ctx, usables, sinAcceso, cliente, args.limite) : vacio(null, [], sinAcceso));
  }

  // El producto: lo que se busca es su descripción; con un producto del catálogo, también su id.
  const producto = args.productoId ? await verProducto(tx, ctx, args.productoId) : null;
  const texto = args.texto ?? producto?.nombre ?? '';
  const raices = raicesDeBusqueda(texto);
  if (usables.length === 0 || (raices.length === 0 && !args.productoId)) {
    return exito(vacio(cliente, [], [...sinAcceso, ...usables.map((s) => ({ fuente: s.fuente, incluida: true, aviso: null }))]));
  }

  // Sin cliente: últimos 2 años y hasta 200 documentos por fuente. Con cliente: todo su historial reciente (60 por defecto).
  const hoy = await hoyDeLaEmpresa(tx);
  const consulta: Consulta = {
    ...(cliente && { clienteId: cliente.id }),
    ...(args.productoId && { productoId: args.productoId }),
    raices,
    ...(!cliente && { desde: hace(hoy.dia, ANIOS_SIN_CLIENTE), limiteDocumentos: DOCUMENTOS_SIN_CLIENTE }),
  };
  const filas: FilaDePrecioAnterior[] = [];
  const fuentes = [...sinAcceso];
  for (const s of usables) {
    const r = await consultarSubherramienta(ejecutor, tx, ctx, s, consulta);
    filas.push(...r.filas);
    fuentes.push({ fuente: s.fuente, incluida: r.aviso === null, aviso: r.aviso });
  }
  const { ultimo, historial } = ordenarResultado(clasificarFilas(filas, { ...(args.productoId && { productoId: args.productoId }), texto }), args.limite);
  return exito({ cliente, candidatosDeCliente: [], ultimo, historial, fuentesConsultadas: fuentes });
}
