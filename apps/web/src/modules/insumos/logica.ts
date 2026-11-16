import type { ArticuloDto, EntradaDe, ExistenciaDto, MovimientoDeInsumoDto, SucursalDto, TipoDeMovimientoDeInsumo } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';

// Lógica pura de las pantallas de Inventario: textos, validación de las hojas y argumentos de las herramientas.
// Todo en milésimas enteras; la pantalla nunca calcula con decimales.

export type TipoManual = 'entrada' | 'salida';
export type OpcionDeRegistro = { id: string; nombre: string; detalle?: string };
type Tono = 'exito' | 'peligro' | 'aviso' | 'neutro';

export const ETIQUETA_DE_TIPO: Record<TipoDeMovimientoDeInsumo, string> = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' };
export const TONO_DE_TIPO: Record<TipoDeMovimientoDeInsumo, Tono> = { entrada: 'exito', salida: 'peligro', ajuste: 'aviso' };

// --- Textos ---

/** Cantidad con su unidad y signo si es negativa: -2500, «kg» → «-2.5 kg». */
export function textoDeCantidad(milesimas: number, unidad?: string): string {
  const texto = formatearCantidad(Math.abs(milesimas), unidad);
  return milesimas < 0 ? `-${texto}` : texto;
}

/** La cantidad de un movimiento con su signo explícito (también en texto, no solo en color). */
export function cantidadConSigno(m: Pick<MovimientoDeInsumoDto, 'cantidadMilesimas' | 'unidad' | 'tipo'>): { texto: string; tono: Tono } {
  const signo = m.cantidadMilesimas > 0 ? '+' : '';
  return { texto: `${signo}${textoDeCantidad(m.cantidadMilesimas, m.unidad)}`, tono: TONO_DE_TIPO[m.tipo] };
}

/** Costo unitario en milésimas de sol: 12500 → «S/ 12.50»; sin costo, «—». */
export const textoDeCosto = (milesimas: number | null): string => (milesimas === null ? '—' : `S/ ${milesimasATexto(milesimas)}`);

/** Cuánto falta para llegar al mínimo (cero si no está bajo). */
export const faltaParaMinimo = (e: Pick<ExistenciaDto, 'cantidadMilesimas' | 'minimoMilesimas'>): number => Math.max(0, e.minimoMilesimas - e.cantidadMilesimas);

/** Lo que hay del artículo en esa sucursal (cero si nunca tuvo movimiento allí); nulo sin artículo o sin sucursal. */
export function existenciaEn(articulo: Pick<ArticuloDto, 'existencias'> | null | undefined, sucursalId: string): number | null {
  if (!articulo || !sucursalId) return null;
  return articulo.existencias.find((e) => e.sucursalId === sucursalId)?.cantidadMilesimas ?? 0;
}

/** Sucursales donde se puede mover: sin archivar, la principal primero y luego por código. */
export function sucursalesVigentes(sucursales: readonly SucursalDto[]): SucursalDto[] {
  return sucursales.filter((s) => s.archivadoEn === null).sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.codigo.localeCompare(b.codigo));
}

/** Opción del selector de artículos: el nombre y cuánto hay en total. */
export const opcionDeArticulo = (a: Pick<ArticuloDto, 'id' | 'nombre' | 'codigo' | 'existenciaTotalMilesimas' | 'unidad'>): OpcionDeRegistro => ({
  id: a.id,
  nombre: a.nombre,
  detalle: `${a.codigo ? `${a.codigo} · ` : ''}Hay ${textoDeCantidad(a.existenciaTotalMilesimas, a.unidad)}`,
});

const MENSAJES: Record<string, string> = {
  modulo_solo_lectura: 'Tu acceso a Inventario es de solo lectura: no puedes registrar ni cambiar datos.',
  modulo_no_disponible: 'Tu empresa no tiene activo este módulo o no te lo asignaron.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  error_de_red: 'No hay conexión. Revisa tu internet y vuelve a intentarlo.',
  error_interno: 'Algo falló de nuestro lado; no se guardó nada. Vuelve a intentarlo.',
};

/** Mensaje para la persona según el código del rechazo; los de negocio (faltante, archivado) ya vienen redactados. */
export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_permiso' && mensaje.startsWith('Tu acceso')) return mensaje;
  return MENSAJES[codigo] ?? mensaje;
}

// --- Hoja «Entrada / Salida» ---

export type FormularioDeMovimiento = {
  tipo: TipoManual;
  articulo: OpcionDeRegistro | null;
  sucursalId: string;
  cantidad: number | null;
  costo: number | null;
  motivo: string;
};
export type ErroresDeMovimiento = Partial<Record<'articulo' | 'sucursalId' | 'cantidad' | 'costo' | 'motivo', string>>;

export const formularioDeMovimiento = (tipo: TipoManual, articulo: OpcionDeRegistro | null, sucursalId: string): FormularioDeMovimiento => ({
  tipo, articulo, sucursalId, cantidad: null, costo: null, motivo: '',
});

/** `disponible`: lo que hay en la sucursal elegida, si se conoce; una salida mayor se avisa antes de enviar. */
export function validarMovimiento(f: FormularioDeMovimiento, disponible: number | null, unidad?: string): ErroresDeMovimiento {
  const e: ErroresDeMovimiento = {};
  if (!f.articulo) e.articulo = 'Elige el artículo.';
  if (!f.sucursalId) e.sucursalId = 'Elige la sucursal.';
  if (f.cantidad === null || f.cantidad <= 0) e.cantidad = 'Escribe una cantidad mayor que cero.';
  else if (f.tipo === 'salida' && disponible !== null && f.cantidad > disponible) {
    e.cantidad = `No alcanza: hay ${textoDeCantidad(disponible, unidad)} y faltan ${textoDeCantidad(f.cantidad - disponible, unidad)}.`;
  }
  if (f.motivo.trim().length > 300) e.motivo = 'El motivo admite hasta 300 caracteres.';
  return e;
}

export function argumentosDeMovimiento(f: FormularioDeMovimiento): EntradaDe<'existencia_mover'> {
  return {
    articuloId: f.articulo?.id ?? '',
    tipo: f.tipo,
    cantidadMilesimas: f.cantidad ?? 0,
    ...(f.sucursalId && { sucursalId: f.sucursalId }),
    ...(f.motivo.trim() && { motivo: f.motivo.trim() }),
    ...(f.tipo === 'entrada' && f.costo !== null && { costoUnitarioMilesimas: f.costo }),
  };
}

/** Tras guardar, la hoja queda lista para el siguiente: mismo tipo y sucursal; el artículo solo si venía fijo. */
export const siguienteFormulario = (f: FormularioDeMovimiento, articuloFijo: boolean): FormularioDeMovimiento =>
  formularioDeMovimiento(f.tipo, articuloFijo ? f.articulo : null, f.sucursalId);

// --- Ajuste a lo contado (crítica) ---

export type FormularioDeAjuste = { sucursalId: string; contada: number | null; motivo: string };
export type ErroresDeAjuste = Partial<Record<'sucursalId' | 'contada' | 'motivo', string>>;

export function validarAjuste(f: FormularioDeAjuste, actual: number | null): ErroresDeAjuste {
  const e: ErroresDeAjuste = {};
  if (!f.sucursalId) e.sucursalId = 'Elige la sucursal.';
  if (f.contada === null) e.contada = 'Escribe lo que contaste (puede ser cero).';
  else if (actual !== null && f.contada === actual) e.contada = 'Es lo mismo que hay: no hay nada que ajustar.';
  if (!f.motivo.trim()) e.motivo = 'Indica por qué no coincidía.';
  else if (f.motivo.trim().length > 300) e.motivo = 'El motivo admite hasta 300 caracteres.';
  return e;
}

/** «Se registrará un ajuste de -2.5 kg.»; vacío si todavía no hay con qué comparar. */
export function textoDeDiferencia(actual: number | null, contada: number | null, unidad: string): string {
  if (actual === null || contada === null || actual === contada) return '';
  const d = contada - actual;
  return `Se registrará un ajuste de ${d > 0 ? '+' : ''}${textoDeCantidad(d, unidad)}.`;
}

export const argumentosDeAjuste = (articuloId: string, f: FormularioDeAjuste): EntradaDe<'existencia_ajustar'> => ({
  articuloId,
  existenciaNuevaMilesimas: f.contada ?? 0,
  motivo: f.motivo.trim(),
  ...(f.sucursalId && { sucursalId: f.sucursalId }),
});

// --- Artículo: controlar un producto o cambiar mínimo y unidad ---

export type FormularioDeArticulo = { producto: OpcionDeRegistro | null; minimo: number | null; unidad: string };
export type ErroresDeArticulo = Partial<Record<'producto' | 'minimo' | 'unidad', string>>;

export const formularioDeArticulo = (a?: Pick<ArticuloDto, 'productoId' | 'nombre' | 'minimoMilesimas' | 'unidad'>): FormularioDeArticulo =>
  a ? { producto: { id: a.productoId, nombre: a.nombre }, minimo: a.minimoMilesimas, unidad: a.unidad } : { producto: null, minimo: null, unidad: '' };

export function validarArticulo(f: FormularioDeArticulo): ErroresDeArticulo {
  const e: ErroresDeArticulo = {};
  if (!f.producto) e.producto = 'Elige el producto.';
  if (f.unidad.trim().length > 20) e.unidad = 'La unidad admite hasta 20 caracteres.';
  return e;
}

/** Sin unidad se usa la del producto; sin mínimo, cero (sin alerta). */
export const argumentosDeActivar = (f: FormularioDeArticulo): EntradaDe<'articulo_activar'> => ({
  productoId: f.producto?.id ?? '',
  ...(f.minimo !== null && { minimoMilesimas: f.minimo }),
  ...(f.unidad.trim() && { unidad: f.unidad.trim() }),
});

/** Solo lo que cambió; nulo si no cambió nada. */
export function argumentosDeEdicion(a: Pick<ArticuloDto, 'id' | 'minimoMilesimas' | 'unidad'>, f: FormularioDeArticulo): EntradaDe<'articulo_editar'> | null {
  const minimo = f.minimo ?? 0;
  const unidad = f.unidad.trim();
  const cambios = {
    ...(minimo !== a.minimoMilesimas && { minimoMilesimas: minimo }),
    ...(unidad && unidad !== a.unidad && { unidad }),
  };
  return Object.keys(cambios).length > 0 ? { id: a.id, ...cambios } : null;
}

// --- Listados ---

export type FiltrosDeExistencias = { buscar: string; sucursalId: string; soloBajoMinimo: boolean };
export const FILTROS_DE_EXISTENCIAS: FiltrosDeExistencias = { buscar: '', sucursalId: '', soloBajoMinimo: false };

export const argumentosDeExistencias = (f: FiltrosDeExistencias, limite: number, cursor?: string): EntradaDe<'existencias_listar'> => ({
  limite,
  soloBajoMinimo: f.soloBajoMinimo,
  ...(f.buscar.trim() && { buscar: f.buscar.trim() }),
  ...(f.sucursalId && { sucursalId: f.sucursalId }),
  ...(cursor && { cursor }),
});

export type FiltrosDeMovimientos = { tipo: '' | TipoDeMovimientoDeInsumo; sucursalId: string };
export const FILTROS_DE_MOVIMIENTOS: FiltrosDeMovimientos = { tipo: '', sucursalId: '' };

export const argumentosDeMovimientos = (f: FiltrosDeMovimientos & { articuloId?: string }, limite: number, cursor?: string): EntradaDe<'existencias_movimientos_listar'> => ({
  limite,
  ...(f.articuloId && { articuloId: f.articuloId }),
  ...(f.tipo && { tipo: f.tipo }),
  ...(f.sucursalId && { sucursalId: f.sucursalId }),
  ...(cursor && { cursor }),
});

/** Detalle de un movimiento para la lista: el motivo o, si vino de otro documento, su origen. */
export function detalleDeMovimiento(m: Pick<MovimientoDeInsumoDto, 'motivo' | 'origenTipo'>): string {
  if (m.motivo) return m.motivo;
  if (m.origenTipo === 'recepcion') return 'Recepción de compra';
  return m.origenTipo ? `Origen: ${m.origenTipo}` : '—';
}
