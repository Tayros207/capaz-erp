import {
  AVANCES_DE_PEDIDO,
  ESTADOS_ABIERTOS_DE_PEDIDO,
  calcularTotalesDePedido,
  importe,
  type EntradaDe,
  type EstadoDePedido,
  type EventoDePedidoDto,
  type LineaDePedidoDto,
  type PedidoCompletoDto,
  type PedidoDto,
  type TotalesDePedido,
} from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Lógica pura de las pantallas de pedidos: sin React ni red. Los totales y los pasos permitidos salen
// de `@capaz/shared` (los mismos que hace cumplir el servidor); aquí solo se decide qué mostrar.

export const ETIQUETA_DE_ESTADO: Readonly<Record<EstadoDePedido, string>> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  en_proceso: 'En proceso',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const TONO_DE_ESTADO: Readonly<Record<EstadoDePedido, TonoDeInsignia>> = {
  borrador: 'neutro',
  confirmado: 'info',
  en_proceso: 'aviso',
  listo: 'exito',
  entregado: 'exito',
  cancelado: 'peligro',
};

/** Recorrido normal de un pedido, para la barra de estado. Un cancelado no está en el recorrido (−1). */
const RECORRIDO: readonly EstadoDePedido[] = ['borrador', 'confirmado', 'en_proceso', 'listo', 'entregado'];
export const PASOS_DE_PEDIDO: string[] = RECORRIDO.map((e) => ETIQUETA_DE_ESTADO[e]);
export const pasoActual = (estado: EstadoDePedido): number => RECORRIDO.indexOf(estado);

export type Paso = { tipo: 'confirmar'; texto: string } | { tipo: 'estado'; estado: 'confirmado' | 'en_proceso' | 'listo' | 'entregado'; texto: string };

const TEXTO_DE_AVANCE: Readonly<Record<'confirmado' | 'en_proceso' | 'listo' | 'entregado', string>> = {
  confirmado: 'Regresar a confirmado',
  en_proceso: 'Pasar a en proceso',
  listo: 'Marcar como listo',
  entregado: 'Marcar como entregado',
};
const esAvance = (e: EstadoDePedido): e is 'confirmado' | 'en_proceso' | 'listo' | 'entregado' => e in TEXTO_DE_AVANCE;
const pasoA = (estado: EstadoDePedido): Paso[] => (esAvance(estado) ? [{ tipo: 'estado', estado, texto: TEXTO_DE_AVANCE[estado] }] : []);

/** El paso que sigue en el recorrido normal: es el botón principal de la ficha. Nulo si no hay. */
export function siguientePaso(estado: EstadoDePedido): Paso | null {
  if (estado === 'borrador') return { tipo: 'confirmar', texto: 'Confirmar pedido' };
  const siguiente = RECORRIDO[RECORRIDO.indexOf(estado) + 1];
  return siguiente && AVANCES_DE_PEDIDO[estado].includes(siguiente) ? (pasoA(siguiente)[0] ?? null) : null;
}

/** Todos los pasos de estado permitidos (menú «Pasar a…» de las tarjetas y de la ficha). */
export const pasosPermitidos = (estado: EstadoDePedido): Paso[] => AVANCES_DE_PEDIDO[estado].flatMap(pasoA);

/** Los permitidos que no son el botón principal. */
export function otrosPasos(estado: EstadoDePedido): Paso[] {
  const principal = siguientePaso(estado);
  return pasosPermitidos(estado).filter((p) => !(principal?.tipo === 'estado' && p.tipo === 'estado' && p.estado === principal.estado));
}

export const sePuedeCancelar = (estado: EstadoDePedido): boolean => (ESTADOS_ABIERTOS_DE_PEDIDO as readonly string[]).includes(estado);

// --- Días (`AAAA-MM-DD`) ---

/** `2026-03-10` → `10/03/2026`, sin pasar por `Date` (un día no tiene zona horaria). */
export function formatearDia(dia: string | null): string {
  const m = dia ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** El día que es `ahora` en esa zona horaria. */
export const diaEnZona = (ahora: Date, zona: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

// --- Líneas ---

export type ProductoElegido = { id: string; nombre: string };
export type LineaDeFormulario = {
  clave: string;
  producto: ProductoElegido | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number | null;
  precioUnitarioMilesimas: number | null;
  afectoIgv: boolean;
  /** Qué se escribió al final: el unitario o el importe. El otro se calcula a partir de ese. */
  manda: 'precio' | 'importe';
  /** El importe tecleado (céntimos); solo cuenta cuando `manda` es `importe`. */
  importeEscritoCentimos: number | null;
  /** `true` si la unidad la eligió la persona (o vino del producto o del pedido guardado): «Usar» un precio anterior no la cambia. */
  unidadElegida?: boolean;
};
export type ErroresDeLinea = Partial<Record<'descripcion' | 'cantidad' | 'precio', string>>;

export const lineaVacia = (clave: string): LineaDeFormulario => ({ clave, producto: null, descripcion: '', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: null, afectoIgv: true, manda: 'precio', importeEscritoCentimos: null });

export const lineaDesdeDto = (l: LineaDePedidoDto): LineaDeFormulario => ({
  clave: l.id,
  producto: l.productoId ? { id: l.productoId, nombre: l.descripcion } : null,
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  precioUnitarioMilesimas: l.precioUnitarioMilesimas,
  afectoIgv: l.afectoIgv,
  manda: 'precio',
  importeEscritoCentimos: null,
  unidadElegida: true,
});

/** Una fila sin nada escrito (ni producto, ni descripción, ni precio): la hoja la ignora al validar y al guardar. */
export const estaEnBlanco = (l: LineaDeFormulario): boolean =>
  l.producto === null && l.descripcion.trim() === '' && l.precioUnitarioMilesimas === null && l.importeEscritoCentimos === null;

export const sinFilasEnBlanco = (lineas: readonly LineaDeFormulario[]): LineaDeFormulario[] => lineas.filter((l) => !estaEnBlanco(l));

/** Al elegir un producto, la línea toma su nombre, unidad, precio y afectación; la cantidad se conserva. */
export function conProducto(l: LineaDeFormulario, p: { id: string; nombre: string; unidad: string; precioUnitarioMilesimas: number; afectoIgv: boolean } | null): LineaDeFormulario {
  if (!p) return { ...l, producto: null };
  return { ...l, producto: { id: p.id, nombre: p.nombre }, descripcion: p.nombre, unidad: p.unidad, precioUnitarioMilesimas: p.precioUnitarioMilesimas, afectoIgv: p.afectoIgv, manda: 'precio', importeEscritoCentimos: null, unidadElegida: true };
}

export function validarLinea(l: LineaDeFormulario): ErroresDeLinea {
  const e: ErroresDeLinea = {};
  if (!l.descripcion.trim()) e.descripcion = 'Elige un producto o escribe qué se pide.';
  else if (l.descripcion.trim().length > 300) e.descripcion = 'Máximo 300 caracteres.';
  if (l.cantidadMilesimas === null || l.cantidadMilesimas <= 0) e.cantidad = 'La cantidad debe ser mayor que cero.';
  if (l.precioUnitarioMilesimas === null) e.precio = 'Indica el precio (ya con IGV).';
  return e;
}

/** Importe de la línea en céntimos con la misma multiplicación del servidor; nulo si falta un dato o no cabe. */
export function importeDeLinea(l: Pick<LineaDeFormulario, 'cantidadMilesimas' | 'precioUnitarioMilesimas'>): number | null {
  if (l.cantidadMilesimas === null || l.precioUnitarioMilesimas === null || l.cantidadMilesimas <= 0) return null;
  try {
    return importe(l.cantidadMilesimas, l.precioUnitarioMilesimas);
  } catch {
    return null;
  }
}

/** Totales en pantalla con la función del servidor. Las líneas incompletas no suman. Nulo si el importe no cabe. */
export function totalesDe(lineas: readonly LineaDeFormulario[], igvPorcentaje: number): TotalesDePedido | null {
  const completas = lineas.flatMap((l) =>
    l.cantidadMilesimas !== null && l.cantidadMilesimas > 0 && l.precioUnitarioMilesimas !== null
      ? [{ cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas, afectoIgv: l.afectoIgv }]
      : [],
  );
  try {
    return calcularTotalesDePedido(completas, igvPorcentaje);
  } catch {
    return null;
  }
}

type LineaDeEntrada = NonNullable<EntradaDe<'pedido_crear'>['lineas']>[number];

/** Solo se llama con líneas que pasaron `validarLinea`. */
export const aLineaDeEntrada = (l: LineaDeFormulario): LineaDeEntrada => ({
  ...(l.producto && { productoId: l.producto.id }),
  descripcion: l.descripcion.trim(),
  unidad: l.unidad.trim() || 'unidad',
  cantidadMilesimas: l.cantidadMilesimas ?? 0,
  precioUnitarioMilesimas: l.precioUnitarioMilesimas ?? 0,
  afectoIgv: l.afectoIgv,
});

// --- Formulario del pedido ---

export type FormularioDePedido = {
  cliente: { id: string; nombre: string } | null;
  entregaEl: string;
  responsableId: string;
  notas: string;
  lineas: LineaDeFormulario[];
};
export type ErroresDePedido = Partial<Record<'cliente' | 'entregaEl' | 'notas' | 'lineas', string>> & {
  /** Errores de cada fila por su clave; solo está si alguna fila los tiene. */
  porLinea?: Record<string, ErroresDeLinea>;
};

export const FORMULARIO_VACIO: FormularioDePedido = { cliente: null, entregaEl: '', responsableId: '', notas: '', lineas: [] };

export const formularioDesde = (p: PedidoCompletoDto): FormularioDePedido => ({
  cliente: { id: p.clienteId, nombre: p.clienteNombre },
  entregaEl: p.entregaEl ?? '',
  responsableId: p.responsableId ?? '',
  notas: p.notas ?? '',
  lineas: p.detalle.map(lineaDesdeDto),
});

/** `fecha` es el día del pedido (hoy en uno nuevo): la entrega no puede ser anterior. */
export function validarPedido(f: FormularioDePedido, fecha: string): ErroresDePedido {
  const e: ErroresDePedido = {};
  if (!f.cliente) e.cliente = 'Elige un cliente de la lista: escribe su nombre y haz clic en la opción que aparece.';
  if (f.entregaEl && f.entregaEl < fecha) e.entregaEl = 'La entrega no puede ser anterior a la fecha del pedido.';
  if (f.notas.trim().length > 4000) e.notas = 'Máximo 4000 caracteres.';
  const lineas = sinFilasEnBlanco(f.lineas);
  if (lineas.length > 100) e.lineas = 'Un pedido admite hasta 100 líneas.';
  else {
    const porLinea: Record<string, ErroresDeLinea> = {};
    for (const l of lineas) {
      const el = validarLinea(l);
      if (Object.keys(el).length > 0) porLinea[l.clave] = el;
    }
    if (Object.keys(porLinea).length > 0) {
      e.lineas = 'Completa o borra las filas señaladas.';
      e.porLinea = porLinea;
    }
  }
  return e;
}

/** Para confirmar, además de lo anterior, hace falta al menos una fila con algo escrito. */
export function validarParaConfirmar(f: FormularioDePedido, fecha: string): ErroresDePedido {
  const e = validarPedido(f, fecha);
  if (!e.lineas && sinFilasEnBlanco(f.lineas).length === 0) e.lineas = 'Agrega al menos una fila para confirmar el pedido.';
  return e;
}

export function argumentosDeCreacion(f: FormularioDePedido): EntradaDe<'pedido_crear'> {
  return {
    clienteId: f.cliente?.id ?? '',
    ...(f.entregaEl && { entregaEl: f.entregaEl }),
    ...(f.responsableId && { responsableId: f.responsableId }),
    ...(f.notas.trim() && { notas: f.notas.trim() }),
    lineas: sinFilasEnBlanco(f.lineas).map(aLineaDeEntrada),
  };
}

const mismaLinea = (a: LineaDeEntrada, d: LineaDePedidoDto): boolean =>
  (a.productoId ?? null) === d.productoId && a.descripcion === d.descripcion && a.unidad === d.unidad && a.cantidadMilesimas === d.cantidadMilesimas &&
  a.precioUnitarioMilesimas === d.precioUnitarioMilesimas && a.afectoIgv === d.afectoIgv;

/** Solo lo que cambió respecto al pedido guardado; nulo si no cambió nada. Las líneas van todas o ninguna. */
export function argumentosDeEdicion(p: PedidoCompletoDto, f: FormularioDePedido): EntradaDe<'pedido_editar'> | null {
  const args: EntradaDe<'pedido_editar'> = { id: p.id };
  if (f.cliente && f.cliente.id !== p.clienteId) args.clienteId = f.cliente.id;
  if ((f.entregaEl || null) !== p.entregaEl) args.entregaEl = f.entregaEl || null;
  if ((f.responsableId || null) !== p.responsableId) args.responsableId = f.responsableId || null;
  if ((f.notas.trim() || null) !== p.notas) args.notas = f.notas.trim() || null;
  const lineas = sinFilasEnBlanco(f.lineas).map(aLineaDeEntrada);
  if (lineas.length !== p.detalle.length || lineas.some((l, i) => !mismaLinea(l, p.detalle[i]!))) args.lineas = lineas;
  return Object.keys(args).length > 1 ? args : null;
}

// --- Tablero y entregas ---

export type ColumnaDePedidos = { id: EstadoDePedido; titulo: string; resumen: string; filas: PedidoDto[] };

/** Una columna por estado abierto, con el total de sus pedidos como resumen. */
export function columnasDeTablero(pedidos: readonly PedidoDto[]): ColumnaDePedidos[] {
  return ESTADOS_ABIERTOS_DE_PEDIDO.map((estado) => {
    const filas = pedidos.filter((p) => p.estado === estado);
    return { id: estado, titulo: ETIQUETA_DE_ESTADO[estado], resumen: formatearSoles(filas.reduce((s, p) => s + p.totalCentimos, 0)), filas };
  });
}

export type GrupoDeEntregas = { id: 'atrasados' | 'hoy' | 'proximos'; titulo: string; pedidos: PedidoDto[] };

/** Atrasados (según el servidor), los de hoy y los de los próximos siete días; cada grupo por fecha de entrega. */
export function agruparEntregas(pedidos: readonly PedidoDto[], hoy: string): GrupoDeEntregas[] {
  const limite = sumarDias(hoy, 7);
  const porFecha = (a: PedidoDto, b: PedidoDto) => (a.entregaEl ?? '').localeCompare(b.entregaEl ?? '') || a.codigo.localeCompare(b.codigo);
  const de = (filtro: (p: PedidoDto & { entregaEl: string }) => boolean) =>
    pedidos.filter((p): p is PedidoDto & { entregaEl: string } => p.entregaEl !== null).filter(filtro).sort(porFecha);
  return [
    { id: 'atrasados', titulo: 'Atrasados', pedidos: de((p) => p.atrasado) },
    { id: 'hoy', titulo: 'Hoy', pedidos: de((p) => p.entregaEl === hoy) },
    { id: 'proximos', titulo: 'Próximos siete días', pedidos: de((p) => p.entregaEl > hoy && p.entregaEl <= limite) },
  ];
}

// --- Historial y errores ---

const estado = (e: string | null): string => (e && e in ETIQUETA_DE_ESTADO ? ETIQUETA_DE_ESTADO[e as EstadoDePedido] : '—');

export function textoDeEvento(e: Pick<EventoDePedidoDto, 'tipo' | 'estadoAnterior' | 'estadoNuevo' | 'nota'> & Partial<Pick<EventoDePedidoDto, 'guia' | 'detalle'>>): string {
  switch (e.tipo) {
    case 'creado': return 'Se creó el pedido';
    case 'editado': return 'Se editó el borrador';
    case 'confirmado': return 'Se confirmó y recibió su número';
    case 'estado': return `Pasó de ${estado(e.estadoAnterior)} a ${estado(e.estadoNuevo)}`;
    case 'cancelado': return `Se canceló (estaba ${estado(e.estadoAnterior)})`;
    case 'nota': return e.nota ?? 'Nota';
    case 'datos_editados': return 'Se corrigieron los datos del pedido';
    case 'corregido': {
      const c = e.detalle?.correccion;
      return c ? `Se corrigió el pedido: ahora es la versión ${c.versionNueva}` : 'Se corrigió el pedido';
    }
    case 'guia_emitida': return `Se emitió la guía de remisión ${e.guia?.codigo ?? ''}`.trim();
    case 'guia_anulada': return `Se anuló la guía de remisión ${e.guia?.codigo ?? ''}`.trim() + (e.nota ? `: ${e.nota}` : '');
    default: return e.tipo;
  }
}

const MENSAJES: Readonly<Record<string, string>> = {
  modulo_solo_lectura: 'Tu acceso a Pedidos es de solo lectura.',
  modulo_no_disponible: 'Tu empresa no tiene Pedidos activo o no tienes acceso.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  no_encontrado: 'Ese pedido ya no existe o no está a tu cargo.',
};

/** El mensaje del servidor manda, salvo en los códigos de acceso, que se explican en palabras de la pantalla. */
export const mensajeDeRechazo = (codigo: string, mensaje: string): string => MENSAJES[codigo] ?? mensaje;
