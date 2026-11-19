import { ESTADOS_DE_PEDIDO_PARA_GUIA, MAXIMO_DE_LINEAS_DE_GUIA, MAXIMO_DE_PEDIDOS_POR_GUIA, type EntradaDe, type PedidoDto, type PreparacionDeGuiaDto } from '@capaz/shared';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { mensajeDeRechazo } from './logica.ts';
import type { DatosDeTraslado, GuiaParaImprimir, LineaParaImprimir } from './guias.ts';

// Lógica pura del armado de una guía: qué se marca, qué se valida y qué se envía. Sin React ni red.

export type SeleccionDeLinea = { incluir: boolean; cantidadMilesimas: number | null };
export type LineaLibre = { clave: string; descripcion: string; unidad: string; cantidadMilesimas: number | null };
export type Armado = { selecciones: Readonly<Record<string, SeleccionDeLinea>>; libres: readonly LineaLibre[]; traslado: DatosDeTraslado };

/** Lo que ya se eligió se conserva; una línea nueva entra marcada con su pendiente, si lo hay. */
export function seleccionInicial(prep: PreparacionDeGuiaDto, previa: Readonly<Record<string, SeleccionDeLinea>>): Record<string, SeleccionDeLinea> {
  const salida: Record<string, SeleccionDeLinea> = {};
  for (const pedido of prep.pedidos) {
    for (const l of pedido.lineas) {
      salida[l.pedidoLineaId] = previa[l.pedidoLineaId] ?? { incluir: l.pendienteMilesimas > 0, cantidadMilesimas: l.pendienteMilesimas > 0 ? l.pendienteMilesimas : null };
    }
  }
  return salida;
}

type ElegidaDePedido = { pedidoLineaId: string; pedido: string; descripcion: string; unidad: string; cantidadMilesimas: number; pendienteMilesimas: number };

function elegidasDePedido(prep: PreparacionDeGuiaDto, armado: Armado): ElegidaDePedido[] {
  return prep.pedidos.flatMap((p) =>
    p.lineas.flatMap((l) => {
      const s = armado.selecciones[l.pedidoLineaId];
      if (!s?.incluir) return [];
      return [{ pedidoLineaId: l.pedidoLineaId, pedido: p.codigo, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: s.cantidadMilesimas ?? 0, pendienteMilesimas: l.pendienteMilesimas }];
    }),
  );
}

export type ErroresDeGuia = {
  general?: string;
  traslado: Partial<Record<keyof DatosDeTraslado, string>>;
  /** Por `pedidoLineaId`. */
  lineas: Record<string, string>;
  /** Por `clave` de la línea libre. */
  libres: Record<string, { descripcion?: string; cantidad?: string }>;
};

export const hayErrores = (e: ErroresDeGuia): boolean => !!e.general || Object.keys(e.traslado).length > 0 || Object.keys(e.lineas).length > 0 || Object.keys(e.libres).length > 0;

function erroresDeTraslado(t: DatosDeTraslado): ErroresDeGuia['traslado'] {
  const e: ErroresDeGuia['traslado'] = {};
  if (!t.fechaTraslado) e.fechaTraslado = 'Indica la fecha del traslado.';
  if (!t.puntoPartida.trim()) e.puntoPartida = 'Indica el punto de partida.';
  if (!t.puntoLlegada.trim()) e.puntoLlegada = 'Indica el punto de llegada.';
  if (t.motivo === 'otro' && !t.motivoDetalle.trim()) e.motivoDetalle = 'Con el motivo «Otro», indica cuál.';
  if (t.modalidad === 'publico' && !t.transportista.trim()) e.transportista = 'Con transporte público, indica la empresa transportista.';
  return e;
}

function erroresDeLineas(elegidas: readonly ElegidaDePedido[]): ErroresDeGuia['lineas'] {
  const e: ErroresDeGuia['lineas'] = {};
  for (const l of elegidas) {
    if (l.cantidadMilesimas <= 0) e[l.pedidoLineaId] = 'La cantidad debe ser mayor que cero.';
    else if (l.cantidadMilesimas > l.pendienteMilesimas) e[l.pedidoLineaId] = `Quedan ${formatearCantidad(l.pendienteMilesimas, l.unidad)} por enviar.`;
  }
  return e;
}

function erroresDeLibres(libres: readonly LineaLibre[]): ErroresDeGuia['libres'] {
  const e: ErroresDeGuia['libres'] = {};
  for (const l of libres) {
    const descripcion = l.descripcion.trim() ? undefined : 'Escribe la descripción.';
    const cantidad = (l.cantidadMilesimas ?? 0) > 0 ? undefined : 'La cantidad debe ser mayor que cero.';
    if (descripcion || cantidad) e[l.clave] = { ...(descripcion && { descripcion }), ...(cantidad && { cantidad }) };
  }
  return e;
}

export function validarGuia(prep: PreparacionDeGuiaDto, armado: Armado): ErroresDeGuia {
  const elegidas = elegidasDePedido(prep, armado);
  const total = elegidas.length + armado.libres.length;
  const general = total === 0 ? 'Agrega al menos una línea.' : total > MAXIMO_DE_LINEAS_DE_GUIA ? `Una guía admite hasta ${MAXIMO_DE_LINEAS_DE_GUIA} líneas.` : undefined;
  return { ...(general && { general }), traslado: erroresDeTraslado(armado.traslado), lineas: erroresDeLineas(elegidas), libres: erroresDeLibres(armado.libres) };
}

const vacioANulo = (t: string): string | null => t.trim() || null;

/** Lo que recibe `guia_emitir`: pedidos primero, líneas libres después, textos recortados y vacíos en nulo. */
export function argumentosDeEmision(prep: PreparacionDeGuiaDto, armado: Armado): EntradaDe<'guia_emitir'> {
  const t = armado.traslado;
  const deLosPedidos = elegidasDePedido(prep, armado).map((l) => ({ tipo: 'pedido' as const, pedidoLineaId: l.pedidoLineaId, cantidadMilesimas: l.cantidadMilesimas }));
  const libres = armado.libres.map((l) => ({
    tipo: 'libre' as const,
    descripcion: l.descripcion.trim(),
    ...(l.unidad.trim() && { unidad: l.unidad.trim() }),
    cantidadMilesimas: l.cantidadMilesimas ?? 0,
  }));
  return {
    clienteId: prep.cliente.id,
    fechaTraslado: t.fechaTraslado,
    destinatarioDocumento: vacioANulo(t.destinatarioDocumento),
    puntoPartida: t.puntoPartida.trim(),
    puntoLlegada: t.puntoLlegada.trim(),
    motivo: t.motivo,
    motivoDetalle: t.motivo === 'otro' ? vacioANulo(t.motivoDetalle) : null,
    modalidad: t.modalidad,
    transportista: t.modalidad === 'publico' ? vacioANulo(t.transportista) : null,
    conductor: vacioANulo(t.conductor),
    licencia: vacioANulo(t.licencia),
    placa: vacioANulo(t.placa),
    bultos: vacioANulo(t.bultos),
    observaciones: vacioANulo(t.observaciones),
    lineas: [...deLosPedidos, ...libres],
  };
}

/** La hoja tal como saldría ahora: sin código, con lo marcado y lo escrito (las líneas incompletas no salen). */
export function vistaPreviaDeGuia(prep: PreparacionDeGuiaDto, armado: Armado, hoy: string): GuiaParaImprimir {
  const dePedido: LineaParaImprimir[] = elegidasDePedido(prep, armado)
    .filter((l) => l.cantidadMilesimas > 0)
    .map((l) => ({ pedido: l.pedido, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas }));
  const libres: LineaParaImprimir[] = armado.libres
    .filter((l) => l.descripcion.trim() && (l.cantidadMilesimas ?? 0) > 0)
    .map((l) => ({ pedido: null, descripcion: l.descripcion.trim(), unidad: l.unidad.trim() || 'unidad', cantidadMilesimas: l.cantidadMilesimas ?? 0 }));
  return {
    codigo: null,
    estado: 'emitida',
    destinatarioNombre: prep.cliente.nombre,
    fechaEmision: hoy,
    pedidos: prep.pedidos.map((p) => p.codigo),
    traslado: armado.traslado,
    lineas: [...dePedido, ...libres],
    anulacion: null,
  };
}

export type SeleccionParaGuia = { ok: true; pedidoIds: string[] } | { ok: false; mensaje: string };

/** Desde la lista: de 1 a 20 pedidos de un solo cliente y en un estado que admite guía. */
export function seleccionParaGuia(filas: readonly PedidoDto[], seleccion: ReadonlySet<string>): SeleccionParaGuia {
  const elegidos = filas.filter((p) => seleccion.has(p.id));
  if (elegidos.length === 0) return { ok: false, mensaje: 'Marca al menos un pedido.' };
  if (elegidos.length > MAXIMO_DE_PEDIDOS_POR_GUIA) return { ok: false, mensaje: `Una guía lleva hasta ${MAXIMO_DE_PEDIDOS_POR_GUIA} pedidos.` };
  if (new Set(elegidos.map((p) => p.clienteId)).size > 1) return { ok: false, mensaje: 'Una guía lleva pedidos de un solo cliente.' };
  const mal = elegidos.find((p) => !(ESTADOS_DE_PEDIDO_PARA_GUIA as readonly string[]).includes(p.estado));
  if (mal) return { ok: false, mensaje: `El pedido ${mal.codigo} aún no está listo: la guía se emite con el pedido listo o entregado.` };
  return { ok: true, pedidoIds: elegidos.map((p) => p.id) };
}

export const RUTA_DE_GUIAS = '/m/ordenes/guias';

export function rutaDeGuiaNueva(origen: { pedidoIds?: readonly string[]; clienteId?: string }): string {
  if (origen.pedidoIds && origen.pedidoIds.length > 0) return `${RUTA_DE_GUIAS}/nueva?pedidos=${origen.pedidoIds.join(',')}`;
  return origen.clienteId ? `${RUTA_DE_GUIAS}/nueva?cliente=${origen.clienteId}` : `${RUTA_DE_GUIAS}/nueva`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que la ruta pide: los ids válidos, sin repetir y hasta 20, y el cliente si es válido. */
export function leerRutaDeGuiaNueva(params: URLSearchParams): { pedidoIds: string[]; clienteId: string | null } {
  const ids = (params.get('pedidos') ?? '').split(',').map((t) => t.trim()).filter((t) => UUID.test(t));
  const cliente = params.get('cliente')?.trim() ?? '';
  return { pedidoIds: [...new Set(ids)].slice(0, MAXIMO_DE_PEDIDOS_POR_GUIA), clienteId: UUID.test(cliente) ? cliente : null };
}

/** El mensaje del servidor manda también en «no encontrado» (el de pedidos habla de un pedido, aquí puede ser una guía). */
export const mensajeDeRechazoDeGuia = (codigo: string, mensaje: string): string => (codigo === 'no_encontrado' ? mensaje : mensajeDeRechazo(codigo, mensaje));
