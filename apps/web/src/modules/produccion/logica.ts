import {
  importe,
  type Centimos,
  type EntradaDe,
  type EstadoDeOrdenDeProduccion,
  type EstadoDePagoDeOrden,
  type LineaDeOrdenDto,
  type OrdenDeProduccionCompletaDto,
} from '@capaz/shared';
import type { Opcion } from '../../shared/ui/selector-de-registro.tsx';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Lógica pura de las pantallas de producción: sin React ni red. Los estados y los montos salen de `@capaz/shared` (los
// mismos que hace cumplir el servidor); aquí solo se decide qué mostrar y qué validar antes de enviar.

export const ETIQUETA_DE_ESTADO: Readonly<Record<EstadoDeOrdenDeProduccion, string>> = {
  pendiente: 'Pendiente',
  en_maquina: 'En máquina',
  listo: 'Listo',
  entregado: 'Entregado',
  anulada: 'Anulada',
};

export const TONO_DE_ESTADO: Readonly<Record<EstadoDeOrdenDeProduccion, TonoDeInsignia>> = {
  pendiente: 'aviso',
  en_maquina: 'info',
  listo: 'exito',
  entregado: 'neutro',
  anulada: 'peligro',
};

export const ETIQUETA_DE_PAGO: Readonly<Record<EstadoDePagoDeOrden, string>> = { sin_adelanto: 'Sin adelanto', con_adelanto: 'Con adelanto', pagado: 'Pagado' };

export const FILTROS = {
  en_cola: 'En cola',
  pendiente: 'Por hacer',
  en_maquina: 'En máquina',
  listo: 'Listo',
  entregado: 'Entregadas',
  anulada: 'Anuladas',
  todas: 'Todas',
} as const;
export type FiltroDeOrdenes = keyof typeof FILTROS;

/** El botón grande de avance de una orden y a qué estado lleva; `null` si ya no avanza. */
export function avanceDe(estado: EstadoDeOrdenDeProduccion): { texto: string; a: 'pendiente' | 'en_maquina' | 'listo' | 'entregado'; confirma: boolean } | null {
  switch (estado) {
    case 'pendiente': return { texto: 'Pasar a máquina', a: 'en_maquina', confirma: false };
    case 'en_maquina': return { texto: 'Marcar lista', a: 'listo', confirma: false };
    case 'listo': return { texto: 'Marcar entregada', a: 'entregado', confirma: true };
    case 'anulada': return { texto: 'Retomar este trabajo', a: 'pendiente', confirma: false };
    default: return null;
  }
}

/** Qué se puede hacer con una orden según su estado (quién puede lo decide el permiso). */
export const accionesDeOrden = (o: Pick<OrdenDeProduccionCompletaDto, 'estado' | 'saldoCentimos'>) => ({
  editar: o.estado === 'pendiente' || o.estado === 'en_maquina' || o.estado === 'listo',
  anular: o.estado === 'pendiente' || o.estado === 'en_maquina' || o.estado === 'listo',
  cobrar: o.estado !== 'anulada' && o.saldoCentimos > 0,
});

const MS_POR_DIA = 86_400_000;
export const hoyLocal = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
export const sumarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T12:00:00Z`) + n * MS_POR_DIA).toISOString().slice(0, 10);
const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / MS_POR_DIA);
const corta = (dia: string): string => dia.split('-').reverse().join('/');

/** «Atrasada 3 días», «Entrega hoy», «Entrega mañana», «Entrega el 20/03/2026», «Sin fecha de entrega». */
export function textoDeEntrega(o: Pick<OrdenDeProduccionCompletaDto, 'estado' | 'entregaEl' | 'entregadoEn'>, hoy: string): string {
  if (o.estado === 'anulada') return 'Anulada';
  if (o.estado === 'entregado') return o.entregadoEn ? `Entregada el ${corta(o.entregadoEn.slice(0, 10))}` : 'Entregada';
  if (!o.entregaEl) return 'Sin fecha de entrega';
  const d = diasEntre(hoy, o.entregaEl);
  if (d < 0) return `Atrasada ${-d} ${-d === 1 ? 'día' : 'días'}`;
  if (d === 0) return 'Entrega hoy';
  if (d === 1) return 'Entrega mañana';
  return `Entrega el ${corta(o.entregaEl)}`;
}

/** Los atajos de fecha de entrega del formulario. */
export const atajosDeEntrega = (hoy: string): Array<{ texto: string; dia: string }> => [
  { texto: 'Hoy', dia: hoy },
  { texto: 'Mañana', dia: sumarDias(hoy, 1) },
  { texto: 'En 3 días', dia: sumarDias(hoy, 3) },
  { texto: 'En una semana', dia: sumarDias(hoy, 7) },
];

// --- Formulario de la orden ---

export type LineaDeFormulario = {
  clave: number;
  descripcion: string;
  cantidad: number | null;
  /** Valor unitario en milésimas de sol. */
  precio: number | null;
  material: string;
  medida: string;
  colores: string;
  acabado: string;
};
export type FormularioDeOrden = { cliente: Opcion | null; lineas: LineaDeFormulario[]; adelanto: Centimos | null; entregaEl: string; notas: string };
export type ErroresDeOrden = { cliente?: string; lineas?: string; adelanto?: string; entregaEl?: string };

export const lineaVacia = (clave: number): LineaDeFormulario => ({ clave, descripcion: '', cantidad: null, precio: null, material: '', medida: '', colores: '', acabado: '' });
const llena = (l: LineaDeFormulario) => l.descripcion.trim() !== '' || l.cantidad !== null || l.precio !== null;

/** Subtotal de una línea redondeado al céntimo, igual que el servidor; 0 si falta cantidad o valor. */
export const subtotalDeLinea = (l: Pick<LineaDeFormulario, 'cantidad' | 'precio'>): number => (l.cantidad && l.precio && l.cantidad > 0 && l.precio > 0 ? importe(l.cantidad, l.precio) : 0);
export const totalDeFormulario = (f: Pick<FormularioDeOrden, 'lineas'>): number => f.lineas.filter(llena).reduce((s, l) => s + subtotalDeLinea(l), 0);
/** Lo que falta cancelar: total menos adelanto (nunca negativo en pantalla). */
export const faltaCancelar = (f: Pick<FormularioDeOrden, 'lineas' | 'adelanto'>): number => Math.max(0, totalDeFormulario(f) - (f.adelanto ?? 0));

export function validarOrden(f: FormularioDeOrden, hoy: string): ErroresDeOrden {
  const e: ErroresDeOrden = {};
  if (!f.cliente) e.cliente = 'Escribe el nombre del cliente.';
  const llenas = f.lineas.filter(llena);
  if (llenas.length === 0) e.lineas = 'Agrega al menos un trabajo con su cantidad y su valor.';
  else if (llenas.some((l) => !l.descripcion.trim())) e.lineas = 'Cada trabajo necesita su descripción.';
  else if (llenas.some((l) => !l.cantidad || l.cantidad <= 0)) e.lineas = 'Cada trabajo necesita una cantidad mayor que cero.';
  else if (llenas.some((l) => !l.precio || l.precio <= 0)) e.lineas = 'Escribe cuánto vale cada trabajo.';
  if ((f.adelanto ?? 0) > totalDeFormulario(f) && !e.lineas) e.adelanto = 'El adelanto no puede ser mayor que el total del trabajo.';
  if (f.entregaEl && f.entregaEl < hoy) e.entregaEl = 'La fecha de entrega no puede ser anterior a hoy.';
  return e;
}

const aEntrada = (l: LineaDeFormulario): NonNullable<EntradaDe<'produccion_orden_crear'>['lineas']>[number] => ({
  descripcion: l.descripcion.trim(),
  cantidadMilesimas: l.cantidad!,
  precioUnitarioMilesimas: l.precio!,
  ...(l.material.trim() && { material: l.material.trim() }),
  ...(l.medida.trim() && { medida: l.medida.trim() }),
  ...(l.colores.trim() && { colores: l.colores.trim() }),
  ...(l.acabado.trim() && { acabado: l.acabado.trim() }),
});

export function argumentosDeCrear(f: FormularioDeOrden): EntradaDe<'produccion_orden_crear'> {
  return {
    clienteId: f.cliente!.id,
    lineas: f.lineas.filter(llena).map(aEntrada),
    adelantoCentimos: f.adelanto ?? 0,
    ...(f.entregaEl && { entregaEl: f.entregaEl }),
    ...(f.notas.trim() && { notas: f.notas.trim() }),
  };
}

/** Al corregir se envía todo: las líneas reemplazan a las anteriores y «sin fecha» borra la entrega. */
export function argumentosDeEditar(id: string, f: FormularioDeOrden): EntradaDe<'produccion_orden_editar'> {
  return {
    id,
    clienteId: f.cliente!.id,
    lineas: f.lineas.filter(llena).map(aEntrada),
    adelantoCentimos: f.adelanto ?? 0,
    entregaEl: f.entregaEl || null,
    notas: f.notas.trim() || null,
  };
}

export function formularioDesde(o: OrdenDeProduccionCompletaDto, centimos: (n: number) => Centimos): FormularioDeOrden {
  return {
    cliente: { id: o.clienteId, nombre: o.clienteNombre },
    lineas: o.lineas.map((l: LineaDeOrdenDto, i) => ({
      clave: i + 1,
      descripcion: l.descripcion,
      cantidad: l.cantidadMilesimas,
      precio: l.precioUnitarioMilesimas,
      material: l.material ?? '',
      medida: l.medida ?? '',
      colores: l.colores ?? '',
      acabado: l.acabado ?? '',
    })),
    adelanto: o.adelantoCentimos > 0 ? centimos(o.adelantoCentimos) : null,
    entregaEl: o.entregaEl ?? '',
    notas: o.notas ?? '',
  };
}

const MENSAJES: Readonly<Record<string, string>> = {
  conflicto: 'Eso ya cambió: actualiza la pantalla y vuelve a intentarlo.',
  no_encontrado: 'No encontramos esa orden.',
  sin_permiso: 'No tienes permiso para hacer eso.',
};

/** El mensaje del servidor, salvo los códigos genéricos que se dicen mejor. */
export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_permiso' && mensaje.startsWith('Tu acceso')) return mensaje;
  return codigo === 'conflicto' ? mensaje || MENSAJES.conflicto! : (MENSAJES[codigo] ?? mensaje);
}

/** Busca sin tildes ni mayúsculas en cliente, código y resumen. */
export function coincide(o: Pick<OrdenDeProduccionCompletaDto, 'clienteNombre' | 'codigo' | 'resumen' | 'notas'>, texto: string): boolean {
  const limpio = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = limpio(texto.trim());
  return q === '' || [o.clienteNombre, o.codigo, o.resumen, o.notas ?? ''].some((c) => limpio(c).includes(q));
}
