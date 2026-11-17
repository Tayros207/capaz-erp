import {
  ESTADOS_DE_COTIZACION, MAXIMO_DE_LINEAS_DE_COTIZACION,
  type Centimos, type CotizacionCompletaDto, type EntradaDe, type LineaDeCotizacionEntrada,
} from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';
import type { Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { limpiarPorcentaje } from './logica.ts';

// Lógica pura de las pantallas de cotizaciones: qué acciones permite cada estado, qué se muestra y cómo se
// arman los argumentos. Los precios y totales los calcula el servidor; aquí no se calcula ninguno.

export type EstadoDeCotizacion = (typeof ESTADOS_DE_COTIZACION)[number];

export const ETIQUETA_DE_ESTADO: Readonly<Record<EstadoDeCotizacion, string>> = {
  borrador: 'Borrador', emitida: 'Emitida', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada', anulada: 'Anulada',
};
export const TONO_DE_ESTADO: Readonly<Record<EstadoDeCotizacion, TonoDeInsignia>> = {
  borrador: 'neutro', emitida: 'info', enviada: 'info', aceptada: 'exito', rechazada: 'aviso', anulada: 'peligro',
};

export type FiltroDeEstado = EntradaDe<'cotizaciones_listar'>['estado'] & string;
export const FILTROS: readonly FiltroDeEstado[] = ['abiertas', 'borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada', 'todas'];
export const etiquetaDeFiltro = (f: FiltroDeEstado): string => (f === 'abiertas' ? 'Abiertas' : f === 'todas' ? 'Todas' : ETIQUETA_DE_ESTADO[f]);

// --- Qué se puede hacer en cada estado (la misma tabla que hace cumplir el servidor) ---

export type AccionDeCotizacion = 'editar' | 'emitir' | 'enviar' | 'aceptar' | 'rechazar' | 'nueva_version' | 'anular' | 'duplicar';

const DESDE: Readonly<Record<AccionDeCotizacion, readonly EstadoDeCotizacion[]>> = {
  editar: ['borrador'],
  emitir: ['borrador'],
  enviar: ['emitida'],
  aceptar: ['emitida', 'enviada'],
  rechazar: ['emitida', 'enviada'],
  nueva_version: ['emitida', 'enviada', 'rechazada'],
  anular: ['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada'],
  duplicar: ESTADOS_DE_COTIZACION,
};
export const sePuede = (accion: AccionDeCotizacion, estado: EstadoDeCotizacion): boolean => DESDE[accion].includes(estado);

export type PermisosDeCotizacion = { editar: boolean; emitir: boolean; costos: boolean };

/** Acciones visibles: el estado las permite y la persona tiene el permiso (editar, o emitir para emitir y anular). */
export function accionesVisibles(estado: EstadoDeCotizacion, permisos: PermisosDeCotizacion): AccionDeCotizacion[] {
  const permiso = (a: AccionDeCotizacion): boolean => (a === 'emitir' || a === 'anular' ? permisos.emitir : permisos.editar);
  return (Object.keys(DESDE) as AccionDeCotizacion[]).filter((a) => sePuede(a, estado) && permiso(a));
}

/** Se puede imprimir o enviar por WhatsApp una cotización que ya salió del borrador y no está anulada. */
export const sePuedeImprimir = (estado: EstadoDeCotizacion): boolean => estado !== 'borrador' && estado !== 'anulada';

// --- Rutas ---

export const rutaDeFicha = (id: string): string => `/m/cotizador/cotizaciones/${id}`;
export const rutaDeDocumento = (id: string): string => `/m/cotizador/cotizaciones/${id}/documento`;

// --- Aceptar, rechazar, emitir, anular ---

/** Aceptar con opciones exige elegir al menos una línea; sin opciones se aceptan todas. */
export function validarAceptacion(conOpciones: boolean, elegidas: ReadonlySet<number>): string | undefined {
  return conOpciones && elegidas.size === 0 ? 'Elige al menos una opción.' : undefined;
}
export function argumentosDeAceptar(id: string, conOpciones: boolean, elegidas: ReadonlySet<number>): EntradaDe<'cotizacion_aceptar'> {
  return conOpciones ? { id, posiciones: [...elegidas].sort((a, b) => a - b) } : { id };
}
export const argumentosDeRechazo = (id: string, motivo: string): EntradaDe<'cotizacion_rechazar'> => (motivo.trim() === '' ? { id } : { id, motivo: motivo.trim() });
export const argumentosDeAnulacion = (id: string, motivo: string): EntradaDe<'cotizacion_anular'> => ({ id, motivo: motivo.trim() });
export const argumentosDeEmision = (id: string, motivoMargenBajo?: string): EntradaDe<'cotizacion_emitir'> =>
  motivoMargenBajo && motivoMargenBajo.trim() !== '' ? { id, motivoMargenBajo: motivoMargenBajo.trim() } : { id };
/** El servidor pide un motivo cuando el margen queda bajo el mínimo: entonces la pantalla lo pregunta y reintenta. */
export const pideMotivoDeMargen = (codigo: string, mensaje: string): boolean => codigo === 'argumentos_invalidos' && /margen/i.test(mensaje);

/** Posiciones que aceptó el cliente, como texto: «Opciones 1 y 3». */
export function textoDeAceptadas(posiciones: readonly number[] | null, totalDeLineas: number): string {
  if (!posiciones || posiciones.length === 0) return '';
  if (posiciones.length === totalDeLineas) return 'Todas las líneas';
  const n = [...posiciones].sort((a, b) => a - b).map((p) => p + 1);
  return n.length === 1 ? `Línea ${n[0]}` : `Líneas ${n.slice(0, -1).join(', ')} y ${n.at(-1)}`;
}

// --- Historial ---

type EventoDeCotizacionDto = CotizacionCompletaDto['historial'][number];

const TEXTO_DE_EVENTO: Readonly<Record<EventoDeCotizacionDto['tipo'], string>> = {
  creada: 'Creada', editada: 'Editada', emitida: 'Emitida', enviada: 'Marcada como enviada', aceptada: 'Aceptada',
  rechazada: 'Rechazada', anulada: 'Anulada', nueva_version: 'Nueva versión',
  vista: 'Vista por el cliente', enlace_generado: 'Enlace generado', enlace_revocado: 'Enlace revocado',
};
export const textoDeEvento = (e: Pick<EventoDeCotizacionDto, 'tipo' | 'version' | 'motivo'> & Partial<Pick<EventoDeCotizacionDto, 'canal'>>): string =>
  `${TEXTO_DE_EVENTO[e.tipo]}${e.canal === 'enlace' ? ' desde el enlace' : ''} (versión ${e.version})${e.motivo ? `: ${e.motivo}` : ''}`;

// --- Formulario de cotización ---

export type LineaDeFormulario = {
  clave: string;
  tipo: 'lista' | 'manual';
  lista: Opcion | null;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number | null;
  precioUnitarioMilesimas: number | null;
};
export type FormularioDeCotizacion = {
  titulo: string;
  cliente: Opcion | null;
  conOpciones: boolean;
  lineas: LineaDeFormulario[];
  notas: string;
  validezDias: string;
  plazoEntrega: string;
  formaPago: string;
  tolerancia: string;
  noIncluye: string;
  costo: Centimos | null;
};
export type ErroresDeFormulario = Partial<Record<'titulo' | 'lineas' | 'validezDias', string>>;

export const lineaVacia = (clave: string, tipo: 'lista' | 'manual' = 'lista'): LineaDeFormulario => ({
  clave, tipo, lista: null, productoId: null, descripcion: '', unidad: 'unidad', cantidadMilesimas: null, precioUnitarioMilesimas: null,
});
export const FORMULARIO_VACIO: FormularioDeCotizacion = {
  titulo: '', cliente: null, conOpciones: false, lineas: [], notas: '', validezDias: '', plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '', costo: null,
};

export type ErroresDeLinea = Partial<Record<'lista' | 'descripcion' | 'cantidad' | 'precio', string>>;
export function validarLinea(l: LineaDeFormulario): ErroresDeLinea {
  const e: ErroresDeLinea = {};
  if (l.tipo === 'lista' && !l.lista) e.lista = 'Elige el producto de tu lista.';
  if (l.tipo === 'manual' && l.descripcion.trim() === '') e.descripcion = 'Escribe la descripción.';
  if (l.cantidadMilesimas === null || l.cantidadMilesimas <= 0) e.cantidad = 'Escribe la cantidad.';
  if (l.tipo === 'manual' && (l.precioUnitarioMilesimas === null || l.precioUnitarioMilesimas <= 0)) e.precio = 'Escribe el precio, sin IGV.';
  return e;
}

export function validarFormulario(f: FormularioDeCotizacion): ErroresDeFormulario {
  const e: ErroresDeFormulario = {};
  if (f.titulo.trim() === '') e.titulo = 'Escribe un título.';
  if (f.lineas.length === 0) e.lineas = 'Agrega al menos una línea.';
  else if (f.lineas.length > MAXIMO_DE_LINEAS_DE_COTIZACION) e.lineas = `Son ${MAXIMO_DE_LINEAS_DE_COTIZACION} líneas como máximo.`;
  else if (f.lineas.some((l) => Object.keys(validarLinea(l)).length > 0)) e.lineas = 'Hay líneas incompletas: ábrelas y complétalas.';
  const d = f.validezDias.trim();
  if (d !== '' && !(/^\d{1,3}$/.test(d) && Number(d) >= 1 && Number(d) <= 365)) e.validezDias = 'Escribe de 1 a 365 días, o déjalo vacío.';
  return e;
}

/** Una línea de lista no lleva precio (lo calcula el servidor); una manual lleva el unitario sin IGV. */
export function lineaParaEnviar(l: LineaDeFormulario): LineaDeCotizacionEntrada {
  const cantidadMilesimas = l.cantidadMilesimas ?? 0;
  if (l.tipo === 'lista') {
    return { tipo: 'lista', listaId: l.lista?.id ?? '', cantidadMilesimas, ...(l.descripcion.trim() !== '' && { descripcion: l.descripcion.trim() }) };
  }
  return {
    tipo: 'manual', descripcion: l.descripcion.trim(), unidad: l.unidad.trim() || 'unidad', cantidadMilesimas,
    precioUnitarioMilesimas: l.precioUnitarioMilesimas ?? 0, ...(l.productoId && { productoId: l.productoId }),
  };
}

function condicionesDe(f: FormularioDeCotizacion) {
  const dias = f.validezDias.trim();
  return { validezDias: dias === '' ? null : Number(dias), plazoEntrega: f.plazoEntrega.trim(), formaPago: f.formaPago.trim(), tolerancia: f.tolerancia.trim(), noIncluye: f.noIncluye.trim() };
}

export function argumentosDeCreacion(f: FormularioDeCotizacion): EntradaDe<'cotizacion_crear'> {
  const c = condicionesDe(f);
  // Lo que se deja vacío no se envía: al emitir se completa con las condiciones de la empresa.
  const condiciones = {
    ...(c.validezDias !== null && { validezDias: c.validezDias }),
    ...(c.plazoEntrega && { plazoEntrega: c.plazoEntrega }),
    ...(c.formaPago && { formaPago: c.formaPago }),
    ...(c.tolerancia && { tolerancia: c.tolerancia }),
    ...(c.noIncluye && { noIncluye: c.noIncluye }),
  };
  return {
    titulo: f.titulo.trim(),
    ...(f.cliente && { clienteId: f.cliente.id }),
    lineas: f.lineas.map(lineaParaEnviar),
    conOpciones: f.conOpciones,
    ...(f.notas.trim() !== '' && { notas: f.notas.trim() }),
    ...(Object.keys(condiciones).length > 0 && { condiciones }),
    ...(f.costo !== null && { costoCentimos: f.costo }),
  };
}

/** Al editar se envía todo lo que se ve: lo vaciado se borra. */
export function argumentosDeEdicion(id: string, f: FormularioDeCotizacion, puedeVerCostos: boolean): EntradaDe<'cotizacion_editar'> {
  return {
    id,
    titulo: f.titulo.trim(),
    clienteId: f.cliente?.id ?? null,
    lineas: f.lineas.map(lineaParaEnviar),
    conOpciones: f.conOpciones,
    notas: f.notas.trim() === '' ? null : f.notas.trim(),
    condiciones: condicionesDe(f),
    ...(puedeVerCostos && { costoCentimos: f.costo }),
  };
}

export function formularioDesdeCotizacion(c: CotizacionCompletaDto, centimos: (n: number) => Centimos): FormularioDeCotizacion {
  return {
    titulo: c.titulo,
    cliente: c.clienteId && c.clienteNombre ? { id: c.clienteId, nombre: c.clienteNombre } : null,
    conOpciones: c.conOpciones,
    lineas: [...c.lineas].sort((a, b) => a.posicion - b.posicion).map((l, i): LineaDeFormulario => ({
      clave: `${c.id}-${i}`,
      tipo: l.tipo === 'lista' && l.listaId ? 'lista' : 'manual',
      lista: l.tipo === 'lista' && l.listaId ? { id: l.listaId, nombre: l.descripcion } : null,
      productoId: l.productoId,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidadMilesimas: l.cantidadMilesimas,
      precioUnitarioMilesimas: l.precioUnitarioMilesimas,
    })),
    notas: c.notas ?? '',
    validezDias: c.condiciones.validezDias === null ? '' : String(c.condiciones.validezDias),
    plazoEntrega: c.condiciones.plazoEntrega,
    formaPago: c.condiciones.formaPago,
    tolerancia: c.condiciones.tolerancia,
    noIncluye: c.condiciones.noIncluye,
    costo: c.costoCentimos === null ? null : centimos(c.costoCentimos),
  };
}

/** Margen para mostrarlo: solo si el servidor lo devolvió (quien no tiene `cotizador:costos` recibe nulo). */
export const textoDeMargen = (margenPct: string | null): string | null => (margenPct === null ? null : `${limpiarPorcentaje(margenPct)} %`);
