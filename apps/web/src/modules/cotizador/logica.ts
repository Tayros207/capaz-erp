import {
  CANTIDAD_MAXIMA_DE_LISTA_MILESIMAS, CANTIDAD_MINIMA_DE_LISTA_MILESIMAS, centimosSchema, formatearSoles,
  type Centimos, type ConfiguracionDeCotizadorDto, type EntradaDe, type LineaDeCotizacionEntrada, type ListaDePrecioDto, type ProductoCotizableDto,
} from '@capaz/shared';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { lineaManualDeCatalogo } from './logica-catalogo.ts';

// Lógica pura del Cotizador (sin React): formularios, validación y armado de argumentos. Los precios y totales
// los calcula el servidor; aquí solo se da formato y se prepara lo que se envía.

export type ModoIntermedio = 'curva' | 'escalon';
export const ETIQUETA_DE_MODO: Readonly<Record<ModoIntermedio, string>> = { curva: 'Curva (baja poco a poco)', escalon: 'Escalón (cambia por tramos)' };
export const REFERENCIAS = [
  { clave: 'p100', cantidad: 100, etiqueta: '100 unidades' },
  { clave: 'p1000', cantidad: 1000, etiqueta: '1.000 unidades' },
  { clave: 'p5000', cantidad: 5000, etiqueta: '5.000 unidades' },
] as const;
export type ClaveDeReferencia = (typeof REFERENCIAS)[number]['clave'];

// --- Lista de precios ---

export type FormularioDeLista = {
  /** Producto del catálogo al que se enlaza (opcional). */
  producto: { id: string; nombre: string } | null;
  nombre: string;
  unidad: string;
  p100: Centimos | null;
  p1000: Centimos | null;
  p5000: Centimos | null;
  modo: ModoIntermedio;
  minimo: Centimos | null;
};
export type ErroresDeLista = Partial<Record<'nombre' | 'unidad' | 'p100' | 'p1000' | 'p5000' | 'minimo', string>>;

export const LISTA_VACIA: FormularioDeLista = { producto: null, nombre: '', unidad: 'unidad', p100: null, p1000: null, p5000: null, modo: 'curva', minimo: null };

export function formularioDeLista(l: ListaDePrecioDto): FormularioDeLista {
  return {
    producto: l.productoId ? { id: l.productoId, nombre: l.productoNombre ?? l.nombre } : null,
    nombre: l.nombre,
    unidad: l.unidad,
    p100: centimosSchema.parse(l.p100Centimos),
    p1000: centimosSchema.parse(l.p1000Centimos),
    p5000: centimosSchema.parse(l.p5000Centimos),
    modo: l.modoIntermedio,
    minimo: l.precioMinimoCentimos === null ? null : centimosSchema.parse(l.precioMinimoCentimos),
  };
}

export function validarLista(f: FormularioDeLista): ErroresDeLista {
  const e: ErroresDeLista = {};
  if (f.nombre.trim() === '') e.nombre = 'El nombre es obligatorio.';
  if (f.unidad.trim() === '') e.unidad = 'Indica la unidad.';
  for (const r of REFERENCIAS) {
    const v = f[r.clave];
    if (v === null || v <= 0) e[r.clave] = 'El precio debe ser mayor que cero.';
  }
  if (f.minimo !== null && f.minimo <= 0) e.minimo = 'El mínimo debe ser mayor que cero.';
  return e;
}

/**
 * El precio de una unidad en cada referencia (precio de la referencia ÷ su cantidad), solo para mostrar en el formulario.
 * Es aritmética de presentación; el precio que se cobra siempre lo da el servidor.
 */
export function unitarioDeReferencia(centimos: number | null, cantidad: number): string {
  if (centimos === null || centimos <= 0) return '—';
  // céntimos → décimas de milésima de sol por unidad, con redondeo normal a 4 decimales.
  const diezMilesimas = Math.round((centimos * 100) / cantidad);
  const enteros = Math.trunc(diezMilesimas / 10_000);
  const dec = String(diezMilesimas % 10_000).padStart(4, '0');
  return `S/ ${enteros.toLocaleString('en-US')}.${dec}`;
}

export function argumentosDeCreacionDeLista(f: FormularioDeLista, confirmar: boolean): EntradaDe<'lista_precio_crear'> {
  return {
    nombre: f.nombre.trim(),
    unidad: f.unidad.trim(),
    ...(f.producto && { productoId: f.producto.id }),
    p100Centimos: f.p100 ?? 0,
    p1000Centimos: f.p1000 ?? 0,
    p5000Centimos: f.p5000 ?? 0,
    modoIntermedio: f.modo,
    ...(f.minimo !== null && { precioMinimoCentimos: f.minimo }),
    confirmarUnitarioNoBaja: confirmar,
  };
}

/** Solo lo que cambió (el servidor pide al menos un dato). Devuelve nulo si no hay cambios. */
export function argumentosDeEdicionDeLista(original: ListaDePrecioDto, f: FormularioDeLista, confirmar: boolean): EntradaDe<'lista_precio_editar'> | null {
  const cambios: Record<string, unknown> = {};
  if (f.nombre.trim() !== original.nombre) cambios.nombre = f.nombre.trim();
  if (f.unidad.trim() !== original.unidad) cambios.unidad = f.unidad.trim();
  if ((f.producto?.id ?? null) !== original.productoId) cambios.productoId = f.producto?.id ?? null;
  if (f.p100 !== original.p100Centimos) cambios.p100Centimos = f.p100;
  if (f.p1000 !== original.p1000Centimos) cambios.p1000Centimos = f.p1000;
  if (f.p5000 !== original.p5000Centimos) cambios.p5000Centimos = f.p5000;
  if (f.modo !== original.modoIntermedio) cambios.modoIntermedio = f.modo;
  // `null` quita el mínimo; un número lo cambia.
  if (f.minimo !== original.precioMinimoCentimos) cambios.precioMinimoCentimos = f.minimo;
  if (Object.keys(cambios).length === 0) return null;
  return { id: original.id, ...cambios, confirmarUnitarioNoBaja: confirmar } as EntradaDe<'lista_precio_editar'>;
}

/** El aviso del servidor «el unitario no baja…» se confirma con una casilla; los demás rechazos se muestran tal cual. */
export const pideConfirmarUnitario = (codigo: string, mensaje: string): boolean => codigo === 'conflicto' && /confirma para guardarlo igual/i.test(mensaje);

export function resumenDeLista(l: Pick<ListaDePrecioDto, 'p100Centimos' | 'p1000Centimos' | 'p5000Centimos'>): string {
  return `100 → ${formatearSoles(centimosSchema.parse(l.p100Centimos))} · 1.000 → ${formatearSoles(centimosSchema.parse(l.p1000Centimos))} · 5.000 → ${formatearSoles(centimosSchema.parse(l.p5000Centimos))}`;
}

// --- Cotización rápida ---

export function validarCantidadRapida(milesimas: number | null): string | undefined {
  if (milesimas === null || milesimas <= 0) return 'Escribe la cantidad.';
  if (milesimas < CANTIDAD_MINIMA_DE_LISTA_MILESIMAS || milesimas > CANTIDAD_MAXIMA_DE_LISTA_MILESIMAS) {
    return `La lista cotiza de ${formatearCantidad(CANTIDAD_MINIMA_DE_LISTA_MILESIMAS)} a ${formatearCantidad(CANTIDAD_MAXIMA_DE_LISTA_MILESIMAS)}; fuera de eso se cotiza aparte.`;
  }
  return undefined;
}

export const tituloDeCotizacionRapida = (lista: Pick<ListaDePrecioDto, 'nombre'>, cliente: string | null): string =>
  (cliente ? `${lista.nombre} · ${cliente}` : lista.nombre).slice(0, 200);

/** Con lista (de producto o heredada) la línea es de lista y el servidor calcula el precio; con precio de catálogo, manual con su `productoId`. */
export function argumentosDeCotizacionRapida(elegido: ProductoCotizableDto, cantidadMilesimas: number, cliente: { id: string; nombre: string } | null): EntradaDe<'cotizacion_crear'> {
  const linea: LineaDeCotizacionEntrada = elegido.origen === 'lista' && elegido.listaId ? { tipo: 'lista', listaId: elegido.listaId, cantidadMilesimas } : lineaManualDeCatalogo(elegido, cantidadMilesimas);
  return {
    titulo: tituloDeCotizacionRapida({ nombre: elegido.nombre }, cliente?.nombre ?? null),
    ...(cliente && { clienteId: cliente.id }),
    lineas: [linea],
    conOpciones: false,
  };
}

export const rutaDeCotizacion = (id: string): string => `/m/cotizador/cotizaciones/${id}`;

// --- Ajustes ---

const PORCENTAJE = /^\d{1,4}(\.\d{1,3})?$/;
const PORCENTAJE_CON_SIGNO = /^-?\d{1,3}(\.\d{1,3})?$/;
/** Acepta coma decimal y espacios; devuelve el texto limpio. */
export const limpiarPorcentaje = (t: string): string => t.trim().replace(',', '.').replace(/%$/, '').trim();

export function validarPorcentaje(texto: string, nombre: string): string | undefined {
  return PORCENTAJE.test(limpiarPorcentaje(texto)) ? undefined : `${nombre}: escribe un porcentaje, por ejemplo 25 o 12.5.`;
}

/** Ajuste de un cliente: de -100 a 500; vacío o 0 lo quita. */
export function validarAjusteDeCliente(clienteId: string | null, texto: string): { cliente?: string; porcentaje?: string } {
  const e: { cliente?: string; porcentaje?: string } = {};
  if (!clienteId) e.cliente = 'Elige un cliente.';
  const t = limpiarPorcentaje(texto);
  if (t === '') return e;
  if (!PORCENTAJE_CON_SIGNO.test(t)) e.porcentaje = 'Escribe un porcentaje, por ejemplo -5 (descuento) o 10 (recargo).';
  else if (Number(t) < -100 || Number(t) > 500) e.porcentaje = 'El porcentaje va de -100 a 500.';
  return e;
}

export function argumentosDeAjuste(clienteId: string, texto: string, nota: string): EntradaDe<'ajuste_cliente_fijar'> {
  const t = limpiarPorcentaje(texto);
  const quitar = t === '' || Number(t) === 0;
  return { clienteId, porcentaje: quitar ? null : t, ...(!quitar && nota.trim() !== '' && { nota: nota.trim() }) };
}

export const textoDeAjuste = (porcentaje: string): string => {
  const n = Number(porcentaje);
  return n < 0 ? `Descuento de ${Math.abs(n)} %` : n > 0 ? `Recargo de ${n} %` : 'Sin ajuste';
};

export type FormularioDeConfiguracion = {
  utilidadPct: string;
  utilidadBase: ConfiguracionDeCotizadorDto['utilidadBase'];
  umbralVerdePct: string;
  umbralMinimoPct: string;
  redondeoComercial: ConfiguracionDeCotizadorDto['redondeoComercial'];
  igvPorcentaje: 18 | 0;
  validezDias: string;
  plazoEntrega: string;
  formaPago: string;
  tolerancia: string;
  noIncluye: string;
  mensajeWhatsapp: string;
  unidades: string[];
};
export type ErroresDeConfiguracion = Partial<Record<'utilidadPct' | 'umbralVerdePct' | 'umbralMinimoPct' | 'validezDias', string>>;

export function formularioDeConfiguracion(c: ConfiguracionDeCotizadorDto): FormularioDeConfiguracion {
  return {
    utilidadPct: c.utilidadPct,
    utilidadBase: c.utilidadBase,
    umbralVerdePct: c.umbralVerdePct,
    umbralMinimoPct: c.umbralMinimoPct,
    redondeoComercial: c.redondeoComercial,
    igvPorcentaje: c.igvPorcentaje === 0 ? 0 : 18,
    validezDias: c.condiciones.validezDias === null ? '' : String(c.condiciones.validezDias),
    plazoEntrega: c.condiciones.plazoEntrega,
    formaPago: c.condiciones.formaPago,
    tolerancia: c.condiciones.tolerancia,
    noIncluye: c.condiciones.noIncluye,
    mensajeWhatsapp: c.mensajeWhatsapp ?? '',
    unidades: [...c.unidades],
  };
}

export function validarConfiguracion(f: FormularioDeConfiguracion): ErroresDeConfiguracion {
  const e: ErroresDeConfiguracion = {};
  const u = validarPorcentaje(f.utilidadPct, 'Utilidad');
  if (u) e.utilidadPct = u;
  const v = validarPorcentaje(f.umbralVerdePct, 'Margen bueno');
  if (v) e.umbralVerdePct = v;
  const m = validarPorcentaje(f.umbralMinimoPct, 'Margen mínimo');
  if (m) e.umbralMinimoPct = m;
  if (!e.umbralVerdePct && !e.umbralMinimoPct && Number(limpiarPorcentaje(f.umbralMinimoPct)) >= Number(limpiarPorcentaje(f.umbralVerdePct))) {
    e.umbralMinimoPct = 'El margen mínimo debe ser menor que el margen bueno.';
  }
  const d = f.validezDias.trim();
  if (d !== '' && !(/^\d{1,3}$/.test(d) && Number(d) >= 1 && Number(d) <= 365)) e.validezDias = 'Escribe de 1 a 365 días, o déjalo vacío.';
  return e;
}

/** Envía la configuración completa (el servidor acepta todos los campos). Los porcentajes salen limpios. */
export function argumentosDeConfiguracion(f: FormularioDeConfiguracion): EntradaDe<'cotizador_configurar'> {
  const dias = f.validezDias.trim();
  return {
    utilidadPct: limpiarPorcentaje(f.utilidadPct),
    utilidadBase: f.utilidadBase,
    umbralVerdePct: limpiarPorcentaje(f.umbralVerdePct),
    umbralMinimoPct: limpiarPorcentaje(f.umbralMinimoPct),
    redondeoComercial: f.redondeoComercial,
    igvPorcentaje: f.igvPorcentaje,
    condiciones: {
      validezDias: dias === '' ? null : Number(dias),
      plazoEntrega: f.plazoEntrega.trim(),
      formaPago: f.formaPago.trim(),
      tolerancia: f.tolerancia.trim(),
      noIncluye: f.noIncluye.trim(),
    },
    mensajeWhatsapp: f.mensajeWhatsapp.trim() === '' ? null : f.mensajeWhatsapp.trim(),
    unidades: f.unidades,
  };
}

const MENSAJES: Readonly<Record<string, string>> = {
  modulo_solo_lectura: 'Tu acceso al Cotizador es de solo lectura.',
  modulo_no_disponible: 'Tu empresa no tiene el Cotizador activo o no tienes acceso.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  no_encontrado: 'Eso ya no existe.',
};
/** El mensaje del servidor manda, salvo en los códigos de acceso, que se explican en palabras de la pantalla. */
export const mensajeDeRechazo = (codigo: string, mensaje: string): string => MENSAJES[codigo] ?? mensaje;

/** Céntimos enteros del servidor → «S/ 1,234.50». */
export const soles = (centimos: number): string => formatearSoles(centimosSchema.parse(centimos));
