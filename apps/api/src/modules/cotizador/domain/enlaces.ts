// Reglas puras del enlace público de una cotización (B3): token, vigencia y el detalle que ve el cliente.
// El detalle se arma con una LISTA BLANCA: solo salen los campos nombrados aquí. Nunca costo, margen, lista de
// precios, ajuste del cliente, notas internas ni el detalle del cálculo (FICHAS-COTIZADOR-B2-B3, regla 4).
import { createHash, randomBytes } from 'node:crypto';
import { codigoDeCotizacion } from './cotizacion.js';
import type { EstadoDeCotizacion } from './estados.js';

export const BYTES_DE_TOKEN = 32;
/** 32 bytes en base64url sin relleno miden 43 caracteres. */
const FORMA_DE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const VENTANA_DE_VISTA_MS = 3_600_000;
const MS_POR_DIA = 86_400_000;

export const nuevoToken = (): string => randomBytes(BYTES_DE_TOKEN).toString('base64url');
export const hashDeToken = (token: string): string => createHash('sha256').update(token).digest('hex');
export const pareceToken = (valor: string): boolean => FORMA_DE_TOKEN.test(valor);

export type EstadoDeEnlace = 'vigente' | 'vencido' | 'revocado';

export function estadoDeEnlace(e: { venceEn: Date; revocadoEn: Date | null }, ahora: Date): EstadoDeEnlace {
  if (e.revocadoEn) return 'revocado';
  return e.venceEn.getTime() <= ahora.getTime() ? 'vencido' : 'vigente';
}

export const vencimientoDe = (ahora: Date, dias: number): Date => new Date(ahora.getTime() + dias * MS_POR_DIA);

/** La vista se cuenta si nunca se contó o si pasó una hora desde la última. */
export function contarVista(ultimaVistaEn: Date | null, ahora: Date): boolean {
  return ultimaVistaEn === null || ahora.getTime() - ultimaVistaEn.getTime() >= VENTANA_DE_VISTA_MS;
}

/** El enlace sigue a la versión que se envió: si la cotización volvió a borrador o pasó a otra versión, ya no sirve. */
export function enlaceAplica(e: { version: number }, c: { versionActual: number; estado: string }): boolean {
  return e.version === c.versionActual && c.estado !== 'borrador';
}

/** Con el enlace se puede aprobar o rechazar solo mientras la cotización está abierta. */
export const admiteDecision = (estado: string): boolean => estado === 'emitida' || estado === 'enviada';

// --- Detalle público ---

export type EntradaDeDetalle = {
  empresa: { razonSocial: string | null; ruc: string | null; direccionFiscal: string | null; telefono: string | null; correo: string | null; pieDeDocumento: string | null; logoDataUrl: string | null } | null;
  cotizacion: { numero: number | null; anio: number | null; estado: string; titulo: string; clienteNombre: string | null; validaHasta: string | null; lineasAceptadas: unknown };
  version: { version: number; conOpciones: boolean; igvPorcentaje: number; subtotalCentimos: number; igvCentimos: number; totalCentimos: number; condiciones: unknown };
  lineas: ReadonlyArray<{ posicion: number; descripcion: string; unidad: string; cantidadMilesimas: number; totalCentimos: number }>;
};

export type DetallePublico = {
  empresa: { razonSocial: string; ruc: string | null; direccion: string | null; telefono: string | null; correo: string | null; pie: string | null; logo: string | null };
  codigo: string;
  version: number;
  estado: EstadoDeCotizacion;
  titulo: string;
  cliente: string | null;
  validaHasta: string | null;
  conOpciones: boolean;
  igvPorcentaje: number;
  lineas: Array<{ posicion: number; descripcion: string; cantidad: string; totalCentimos: number; aceptada: boolean }>;
  subtotalCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  condiciones: Array<{ etiqueta: string; valor: string }>;
  puedeDecidir: boolean;
};

const ESTADOS: readonly string[] = ['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada'];
const LOGO_PERMITIDO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const ETIQUETAS_DE_CONDICION = [
  ['plazoEntrega', 'Plazo de entrega'],
  ['formaPago', 'Forma de pago'],
  ['tolerancia', 'Tolerancia'],
  ['noIncluye', 'No incluye'],
] as const;

/** 2500000 → «2.500»; 1500 → «1,5». */
export function cantidadLegible(milesimas: number, unidad: string): string {
  const entera = Math.trunc(milesimas / 1000);
  const dec = String(milesimas % 1000).padStart(3, '0').replace(/0+$/, '');
  const miles = String(entera).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${dec ? `${miles},${dec}` : miles} ${unidad}`;
}

function condicionesVisibles(crudas: unknown): DetallePublico['condiciones'] {
  const k = (crudas && typeof crudas === 'object' ? crudas : {}) as Record<string, unknown>;
  return ETIQUETAS_DE_CONDICION.flatMap(([clave, etiqueta]) => (texto(k[clave]) ? [{ etiqueta, valor: texto(k[clave]) }] : []));
}

function posicionesAceptadas(crudas: unknown): number[] {
  return Array.isArray(crudas) ? crudas.filter((p): p is number => Number.isInteger(p)) : [];
}

/** Arma lo que ve el cliente. Cada campo de salida se copia por su nombre: lo que no se nombra aquí no sale. */
export function armarDetallePublico(e: EntradaDeDetalle): DetallePublico {
  const estado = (ESTADOS.includes(e.cotizacion.estado) ? e.cotizacion.estado : 'anulada') as EstadoDeCotizacion;
  const aceptadas = posicionesAceptadas(e.cotizacion.lineasAceptadas);
  const emp = e.empresa;
  return {
    empresa: {
      razonSocial: texto(emp?.razonSocial) || 'Empresa',
      ruc: texto(emp?.ruc) || null,
      direccion: texto(emp?.direccionFiscal) || null,
      telefono: texto(emp?.telefono) || null,
      correo: texto(emp?.correo) || null,
      pie: texto(emp?.pieDeDocumento) || null,
      logo: emp?.logoDataUrl && LOGO_PERMITIDO.test(emp.logoDataUrl) ? emp.logoDataUrl : null,
    },
    codigo: codigoDeCotizacion(e.cotizacion.numero, e.cotizacion.anio, e.version.version),
    version: e.version.version,
    estado,
    titulo: e.cotizacion.titulo,
    cliente: texto(e.cotizacion.clienteNombre) || null,
    validaHasta: e.cotizacion.validaHasta,
    conOpciones: e.version.conOpciones,
    igvPorcentaje: e.version.igvPorcentaje,
    lineas: [...e.lineas]
      .sort((a, b) => a.posicion - b.posicion)
      .map((l) => ({ posicion: l.posicion, descripcion: l.descripcion, cantidad: cantidadLegible(l.cantidadMilesimas, l.unidad), totalCentimos: l.totalCentimos, aceptada: aceptadas.includes(l.posicion) })),
    subtotalCentimos: e.version.subtotalCentimos,
    igvCentimos: e.version.igvCentimos,
    totalCentimos: e.version.totalCentimos,
    condiciones: condicionesVisibles(e.version.condiciones),
    puedeDecidir: admiteDecision(estado),
  };
}
