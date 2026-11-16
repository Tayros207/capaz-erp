import {
  ESTADOS_CANCELABLES_DE_COMPRA,
  ESTADOS_POR_RECIBIR_DE_COMPRA,
  FILTROS_DE_ESTADO_DE_COMPRA,
  calcularTotalesDeCompra,
  importe,
  type CompraCompletaDto,
  type CompraDto,
  type EntradaDe,
  type EstadoDeCompra,
  type LineaDeCompraDto,
  type TotalesDePedido,
} from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Lógica pura de las pantallas de compras: sin React ni red. Los totales y los estados salen de
// `@capaz/shared` (los mismos que hace cumplir el servidor); aquí solo se decide qué mostrar.

export const ETIQUETA_DE_ESTADO: Readonly<Record<EstadoDeCompra, string>> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  recibida_parcial: 'Recibida en parte',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
};

export const TONO_DE_ESTADO: Readonly<Record<EstadoDeCompra, TonoDeInsignia>> = {
  borrador: 'neutro',
  enviada: 'info',
  recibida_parcial: 'aviso',
  recibida: 'exito',
  cancelada: 'peligro',
};

/** Recorrido normal de una orden, para la barra de estado. Una cancelada no está en el recorrido (−1). */
const RECORRIDO: readonly EstadoDeCompra[] = ['borrador', 'enviada', 'recibida_parcial', 'recibida'];
export const PASOS_DE_COMPRA: string[] = RECORRIDO.map((e) => ETIQUETA_DE_ESTADO[e]);
export const pasoActual = (estado: EstadoDeCompra): number => RECORRIDO.indexOf(estado);

export const porRecibir = (estado: EstadoDeCompra): boolean => (ESTADOS_POR_RECIBIR_DE_COMPRA as readonly string[]).includes(estado);

export type Paso = { tipo: 'enviar' | 'recibir'; texto: string };

/** El botón principal de la ficha: enviar el borrador o registrar lo que llega. Nulo si no hay. */
export function siguientePaso(estado: EstadoDeCompra): Paso | null {
  if (estado === 'borrador') return { tipo: 'enviar', texto: 'Enviar al proveedor' };
  if (porRecibir(estado)) return { tipo: 'recibir', texto: 'Registrar recepción' };
  return null;
}

export type FiltroDeEstado = (typeof FILTROS_DE_ESTADO_DE_COMPRA)[number];
export const FILTROS: readonly FiltroDeEstado[] = FILTROS_DE_ESTADO_DE_COMPRA;
const ETIQUETA_DE_FILTRO: Readonly<Record<'abiertas' | 'por_recibir' | 'todas', string>> = { abiertas: 'Abiertas', por_recibir: 'Por recibir', todas: 'Todas' };
export const etiquetaDeFiltro = (f: FiltroDeEstado): string => (f in ETIQUETA_DE_FILTRO ? ETIQUETA_DE_FILTRO[f as keyof typeof ETIQUETA_DE_FILTRO] : ETIQUETA_DE_ESTADO[f as EstadoDeCompra]);

/** «2 líneas» por recibir; una orden que ya no espera nada muestra «—». */
export function textoPorRecibir(c: Pick<CompraDto, 'estado' | 'lineasPorRecibir'>): string {
  if (!porRecibir(c.estado)) return '—';
  return c.lineasPorRecibir === 1 ? '1 línea' : `${c.lineasPorRecibir} líneas`;
}

/** Valor de todo lo recibido hasta ahora: la suma de las recepciones (cada una ya calculada por el servidor). */
export const recibidoCentimos = (c: Pick<CompraCompletaDto, 'recepciones'>): number => c.recepciones.reduce((s, r) => s + r.importeCentimos, 0);

/** Como el servidor: solo en borrador o enviada y sin recepciones. */
export const sePuedeCancelar = (estado: EstadoDeCompra, recepciones: number): boolean =>
  recepciones === 0 && (ESTADOS_CANCELABLES_DE_COMPRA as readonly string[]).includes(estado);

// --- Días (`AAAA-MM-DD`) ---

/** `2026-03-10` → `10/03/2026`, sin pasar por `Date` (un día no tiene zona horaria). */
export function formatearDia(dia: string | null): string {
  const m = dia ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** El día que es `ahora` en esa zona horaria. */
export const diaEnZona = (ahora: Date, zona: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

// --- Líneas de la orden ---

export type ProductoElegido = { id: string; nombre: string };
export type LineaDeFormulario = {
  clave: string;
  producto: ProductoElegido | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number | null;
  costoUnitarioMilesimas: number | null;
  afectoIgv: boolean;
};
export type ErroresDeLinea = Partial<Record<'descripcion' | 'cantidad' | 'costo', string>>;

export const lineaVacia = (clave: string): LineaDeFormulario => ({ clave, producto: null, descripcion: '', unidad: 'unidad', cantidadMilesimas: 1000, costoUnitarioMilesimas: null, afectoIgv: true });

export const lineaDesdeDto = (l: LineaDeCompraDto): LineaDeFormulario => ({
  clave: l.id,
  producto: l.productoId ? { id: l.productoId, nombre: l.descripcion } : null,
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  costoUnitarioMilesimas: l.costoUnitarioMilesimas,
  afectoIgv: l.afectoIgv,
});

/** Al elegir un producto, la línea toma su nombre, unidad y afectación. El costo no: el precio del catálogo es de venta. */
export function conProducto(l: LineaDeFormulario, p: { id: string; nombre: string; unidad: string; afectoIgv: boolean } | null): LineaDeFormulario {
  if (!p) return { ...l, producto: null };
  return { ...l, producto: { id: p.id, nombre: p.nombre }, descripcion: p.nombre, unidad: p.unidad, afectoIgv: p.afectoIgv };
}

export function validarLinea(l: LineaDeFormulario): ErroresDeLinea {
  const e: ErroresDeLinea = {};
  if (!l.descripcion.trim()) e.descripcion = 'Elige un producto o escribe qué se compra.';
  else if (l.descripcion.trim().length > 300) e.descripcion = 'Máximo 300 caracteres.';
  if (l.cantidadMilesimas === null || l.cantidadMilesimas <= 0) e.cantidad = 'La cantidad debe ser mayor que cero.';
  if (l.costoUnitarioMilesimas === null) e.costo = 'Indica el costo (ya con IGV).';
  return e;
}

/** Importe en céntimos con la misma multiplicación del servidor; nulo si falta un dato o no cabe. */
export function importeDeLinea(l: Pick<LineaDeFormulario, 'cantidadMilesimas' | 'costoUnitarioMilesimas'>): number | null {
  if (l.cantidadMilesimas === null || l.costoUnitarioMilesimas === null || l.cantidadMilesimas <= 0) return null;
  try {
    return importe(l.cantidadMilesimas, l.costoUnitarioMilesimas);
  } catch {
    return null;
  }
}

/** Totales en pantalla con la función del servidor. Las líneas incompletas no suman. Nulo si el importe no cabe. */
export function totalesDe(lineas: readonly LineaDeFormulario[], igvPorcentaje: number): TotalesDePedido | null {
  const completas = lineas.flatMap((l) =>
    l.cantidadMilesimas !== null && l.cantidadMilesimas > 0 && l.costoUnitarioMilesimas !== null
      ? [{ cantidadMilesimas: l.cantidadMilesimas, costoUnitarioMilesimas: l.costoUnitarioMilesimas, afectoIgv: l.afectoIgv }]
      : [],
  );
  try {
    return calcularTotalesDeCompra(completas, igvPorcentaje);
  } catch {
    return null;
  }
}

type LineaDeEntrada = NonNullable<EntradaDe<'compra_crear'>['lineas']>[number];

/** Solo se llama con líneas que pasaron `validarLinea`. */
export const aLineaDeEntrada = (l: LineaDeFormulario): LineaDeEntrada => ({
  ...(l.producto && { productoId: l.producto.id }),
  descripcion: l.descripcion.trim(),
  unidad: l.unidad.trim() || 'unidad',
  cantidadMilesimas: l.cantidadMilesimas ?? 0,
  costoUnitarioMilesimas: l.costoUnitarioMilesimas ?? 0,
  afectoIgv: l.afectoIgv,
});

// --- Formulario de la orden ---

export type FormularioDeCompra = {
  proveedor: { id: string; nombre: string } | null;
  entregaEl: string;
  notas: string;
  lineas: LineaDeFormulario[];
};
export type ErroresDeCompra = Partial<Record<'proveedor' | 'entregaEl' | 'notas' | 'lineas', string>>;

export const FORMULARIO_VACIO: FormularioDeCompra = { proveedor: null, entregaEl: '', notas: '', lineas: [] };

export const formularioDesde = (c: CompraCompletaDto): FormularioDeCompra => ({
  proveedor: { id: c.proveedorId, nombre: c.proveedorNombre },
  entregaEl: c.entregaEl ?? '',
  notas: c.notas ?? '',
  lineas: c.detalle.map(lineaDesdeDto),
});

/** `fecha` es el día de la orden (hoy en una nueva): la entrega no puede ser anterior. */
export function validarCompra(f: FormularioDeCompra, fecha: string): ErroresDeCompra {
  const e: ErroresDeCompra = {};
  if (!f.proveedor) e.proveedor = 'Elige el proveedor.';
  if (f.entregaEl && f.entregaEl < fecha) e.entregaEl = 'La entrega no puede ser anterior a la fecha de la orden.';
  if (f.notas.trim().length > 4000) e.notas = 'Máximo 4000 caracteres.';
  if (f.lineas.length > 100) e.lineas = 'Una orden de compra admite hasta 100 líneas.';
  else if (f.lineas.some((l) => Object.keys(validarLinea(l)).length > 0)) e.lineas = 'Hay líneas incompletas: ábrelas y complétalas.';
  return e;
}

export function argumentosDeCreacion(f: FormularioDeCompra): EntradaDe<'compra_crear'> {
  return {
    proveedorId: f.proveedor?.id ?? '',
    ...(f.entregaEl && { entregaEl: f.entregaEl }),
    ...(f.notas.trim() && { notas: f.notas.trim() }),
    lineas: f.lineas.map(aLineaDeEntrada),
  };
}

const mismaLinea = (a: LineaDeEntrada, d: LineaDeCompraDto): boolean =>
  (a.productoId ?? null) === d.productoId && a.descripcion === d.descripcion && a.unidad === d.unidad && a.cantidadMilesimas === d.cantidadMilesimas &&
  a.costoUnitarioMilesimas === d.costoUnitarioMilesimas && a.afectoIgv === d.afectoIgv;

/** Solo lo que cambió respecto a la orden guardada; nulo si no cambió nada. Las líneas van todas o ninguna. */
export function argumentosDeEdicion(c: CompraCompletaDto, f: FormularioDeCompra): EntradaDe<'compra_editar'> | null {
  const args: EntradaDe<'compra_editar'> = { id: c.id };
  if (f.proveedor && f.proveedor.id !== c.proveedorId) args.proveedorId = f.proveedor.id;
  if ((f.entregaEl || null) !== c.entregaEl) args.entregaEl = f.entregaEl || null;
  if ((f.notas.trim() || null) !== c.notas) args.notas = f.notas.trim() || null;
  const lineas = f.lineas.map(aLineaDeEntrada);
  if (lineas.length !== c.detalle.length || lineas.some((l, i) => !mismaLinea(l, c.detalle[i]!))) args.lineas = lineas;
  return Object.keys(args).length > 1 ? args : null;
}

// --- Errores ---

const MENSAJES: Readonly<Record<string, string>> = {
  modulo_solo_lectura: 'Tu acceso a Compras es de solo lectura.',
  modulo_no_disponible: 'Tu empresa no tiene Compras activo o no tienes acceso.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  no_encontrado: 'Esa orden de compra ya no existe o no la creaste tú.',
};

/** El mensaje del servidor manda, salvo en los códigos de acceso, que se explican en palabras de la pantalla. */
export const mensajeDeRechazo = (codigo: string, mensaje: string): string => MENSAJES[codigo] ?? mensaje;
