import { importe, MAXIMO_DE_LINEAS_DE_COTIZACION, quitarIgv, type ConfiguracionDeCotizadorDto, type EntradaDe, type LineaDeCotizacionEntrada } from '@capaz/shared';
import { unidadAlUsar } from '../../../shared/api/logica-precio-anterior.ts';
import { unitarioDeTotal } from '../../../shared/formato/precio-total.ts';
import { leerDecimal, leerPrecio, textoDeDecimal } from './numeros.ts';

// Lógica pura de la hoja «Directa»: la cotización escrita como en papel. Cantidad y precio en milésimas, importe en céntimos.
// Lo último que se escribe (precio o importe) manda y el otro se recalcula.

export type FilaDirecta = {
  clave: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio: string;
  importe: string;
  /** Cuál de los dos escribió la persona por última vez. */
  manda: 'precio' | 'importe';
  /** `true` cuando la persona eligió la unidad: «Usar» un precio anterior ya no la cambia. */
  unidadElegida?: boolean;
};
export type ClienteDeHoja = { id: string; nombre: string };
export type HojaDirecta = {
  cliente: ClienteDeHoja | null;
  referencia: string;
  filas: FilaDirecta[];
  /** `true` si los precios e importes escritos ya incluyen IGV. */
  incluyeIgv: boolean;
  validezDias: number;
  plazoEntrega: string;
  formaPago: string;
};

export const UNIDADES_DE_LA_HOJA = ['unidad', 'millar', 'ciento', 'servicio', 'metro', 'pliego'] as const;
export const VALIDEZ_POR_DEFECTO = 15;
export const IGV_POR_DEFECTO = 18;
const VALIDEZ_BASICA = [7, 15, 30];
const MAXIMO_DE_TITULO = 200;

export const filaVacia = (clave: string): FilaDirecta => ({ clave, descripcion: '', cantidad: '', unidad: 'unidad', precio: '', importe: '', manda: 'precio' });
const estaVacia = (f: FilaDirecta): boolean => [f.descripcion, f.cantidad, f.precio, f.importe].every((t) => t.trim() === '');

/** Las unidades del selector: las de la hoja y, después, las de la empresa que no se repiten. */
export function opcionesDeUnidad(config?: Pick<ConfiguracionDeCotizadorDto, 'unidades'> | null): string[] {
  const vistas = new Set<string>();
  return [...UNIDADES_DE_LA_HOJA, ...(config?.unidades ?? [])].filter((u) => {
    const clave = u.trim().toLowerCase();
    if (clave === '' || vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

// --- Cálculo por fila ---

export type FilaCalculada = {
  cantidadMilesimas: number | null;
  /** Precio unitario en milésimas, tal como se escribió o deducido del importe. Puede no caber al céntimo (`exacto`). */
  precioMilesimas: number | null;
  /** Importe escrito o calculado, en céntimos, con el IGV que traiga la hoja. */
  importeBrutoCentimos: number | null;
  /** Lo que el unitario guardado reproduce al céntimo. */
  exacto: boolean;
  /** Texto del campo que no manda, para mostrar (nunca se vuelve a leer). */
  textoDelOtro: string;
  /** Importe sin IGV, IGV y total de la línea; `null` mientras falte algo. */
  neto: number | null;
  igv: number | null;
  total: number | null;
};
const VACIA: FilaCalculada = { cantidadMilesimas: null, precioMilesimas: null, importeBrutoCentimos: null, exacto: true, textoDelOtro: '', neto: null, igv: null, total: null };

/** IGV de una línea: importe × igv / 100, mitad hacia arriba (igual que el servidor). */
const igvDeLinea = (neto: number, igv: number): number => Math.floor((2 * neto * igv + 100) / 200);

/** Cantidad, precio e importe de una fila, el que no manda recalculado, y su IGV por línea. */
export function calcularFila(f: FilaDirecta, incluyeIgv: boolean, igvPorcentaje: number = IGV_POR_DEFECTO): FilaCalculada {
  const cantidad = leerDecimal(f.cantidad, 3);
  if (cantidad === null || cantidad < 1) return { ...VACIA, cantidadMilesimas: null };
  let precio: number | null = null;
  let bruto: number | null = null;
  let exacto = true;
  let textoDelOtro = '';
  if (f.manda === 'precio') {
    precio = leerPrecio(f.precio);
    if (precio !== null && precio >= 1) {
      try {
        bruto = importe(cantidad, precio);
        textoDelOtro = textoDeDecimal(bruto, 2, 2);
      } catch {
        bruto = null;
      }
    }
  } else {
    const escrito = leerDecimal(f.importe, 2);
    const u = escrito === null || escrito < 1 ? null : unitarioDeTotal(escrito, cantidad);
    if (u && escrito !== null) {
      precio = u.precioUnitarioMilesimas;
      bruto = escrito;
      exacto = u.exacto;
      textoDelOtro = precio < 1 ? '' : textoDeDecimal(precio, 3, 2);
    }
  }
  if (bruto === null || bruto < 1) return { ...VACIA, cantidadMilesimas: cantidad, precioMilesimas: precio, textoDelOtro };
  const neto = incluyeIgv ? quitarIgv(bruto, igvPorcentaje) : bruto;
  const igv = igvDeLinea(neto, igvPorcentaje);
  return { cantidadMilesimas: cantidad, precioMilesimas: precio, importeBrutoCentimos: bruto, exacto, textoDelOtro, neto, igv, total: neto + igv };
}

export type Totales = { subtotalCentimos: number; igvCentimos: number; totalCentimos: number };

/** Suma línea por línea, como el servidor (el IGV se redondea en cada una). Solo cuentan las filas completas. */
export function totalesDeHoja(filas: readonly FilaDirecta[], incluyeIgv: boolean, igvPorcentaje: number = IGV_POR_DEFECTO): Totales {
  const t = { subtotalCentimos: 0, igvCentimos: 0, totalCentimos: 0 };
  for (const f of filas) {
    const c = calcularFila(f, incluyeIgv, igvPorcentaje);
    if (f.descripcion.trim() === '' || c.neto === null || c.igv === null || c.total === null) continue;
    t.subtotalCentimos += c.neto;
    t.igvCentimos += c.igv;
    t.totalCentimos += c.total;
  }
  return t;
}

// --- Filas ---

/** Enter en el importe de la última fila agrega otra; en las demás no hace nada. `foco` es la fila que debe recibir el cursor. */
export function alEnterEnImporte(filas: readonly FilaDirecta[], clave: string, claveNueva: string): { filas: FilaDirecta[]; foco: string | null } {
  if (filas.length >= MAXIMO_DE_LINEAS_DE_COTIZACION || filas[filas.length - 1]?.clave !== clave) return { filas: [...filas], foco: null };
  return { filas: [...filas, filaVacia(claveNueva)], foco: claveNueva };
}

/** Quita una fila; siempre queda al menos una. */
export const quitarFila = (filas: readonly FilaDirecta[], clave: string): FilaDirecta[] => (filas.length <= 1 ? [...filas] : filas.filter((f) => f.clave !== clave));

/** «Usar» un precio anterior: pone el unitario (manda el precio) y, si la persona no eligió la unidad, la del precio anterior. */
export function usarPrecioAnterior(f: FilaDirecta, precioTexto: string, unidadDelPrecio: string): FilaDirecta {
  return { ...f, precio: precioTexto, manda: 'precio', unidad: unidadAlUsar(f.unidad, f.unidadElegida === true, unidadDelPrecio) };
}

/**
 * Cómo se leyó el precio que escribió la persona, para mostrarlo junto al campo: así «1.250» se ve como S/ 1.25 antes de
 * emitir. `null` si el precio no lo escribió la persona (manda el importe) o está vacío; `'ilegible'` si no se entiende.
 */
export function precioLeido(f: Pick<FilaDirecta, 'precio' | 'manda'>): number | 'ilegible' | null {
  if (f.manda !== 'precio' || f.precio.trim() === '') return null;
  return leerPrecio(f.precio) ?? 'ilegible';
}

// --- Condiciones ---

export type CondicionesDeHoja = Pick<HojaDirecta, 'validezDias' | 'plazoEntrega' | 'formaPago'>;

/** Las condiciones con que se abre la hoja: las de Ajustes del Cotizador; sin validez allí, 15 días. */
export function condicionesIniciales(config?: Pick<ConfiguracionDeCotizadorDto, 'condiciones'> | null): CondicionesDeHoja {
  return { validezDias: config?.condiciones.validezDias ?? VALIDEZ_POR_DEFECTO, plazoEntrega: config?.condiciones.plazoEntrega ?? '', formaPago: config?.condiciones.formaPago ?? '' };
}

/** 7, 15 y 30 días; si Ajustes trae otro valor, también se ofrece. */
export function opcionesDeValidez(config?: Pick<ConfiguracionDeCotizadorDto, 'condiciones'> | null): number[] {
  const propia = config?.condiciones.validezDias;
  return [...new Set([...VALIDEZ_BASICA, ...(propia ? [propia] : [])])].sort((a, b) => a - b);
}

// --- Validación y envío ---

export type ErroresDeFila = Partial<Record<'descripcion' | 'cantidad' | 'precio' | 'importe', string>>;
export type ErroresDeHoja = { cliente?: string; filas?: string; porFila: Record<string, ErroresDeFila> };

function erroresDeFila(f: FilaDirecta, incluyeIgv: boolean, igv: number): ErroresDeFila {
  const e: ErroresDeFila = {};
  const c = calcularFila(f, incluyeIgv, igv);
  if (f.descripcion.trim() === '') e.descripcion = 'Escribe la descripción.';
  if (c.cantidadMilesimas === null) e.cantidad = 'Escribe una cantidad mayor que cero.';
  else if (f.manda === 'precio' && f.precio.trim() !== '' && leerPrecio(f.precio) === null) e.precio = 'No se entiende el precio: usa números y hasta 3 decimales.';
  else if (f.manda === 'precio' && (leerPrecio(f.precio) ?? 0) < 1) e.precio = 'Escribe el precio o el importe.';
  else if (f.manda === 'importe' && (leerDecimal(f.importe, 2) ?? 0) < 1) e.importe = 'Escribe el precio o el importe.';
  else if (c.neto === null) e[f.manda] = 'El importe no es válido.';
  else if (c.neto < 1) e[f.manda] = 'El importe queda en menos de un céntimo.';
  return e;
}

/** Las filas que cuentan: ni vacías ni a medias. */
export const filasCompletas = (filas: readonly FilaDirecta[], incluyeIgv: boolean, igv: number = IGV_POR_DEFECTO): FilaDirecta[] =>
  filas.filter((f) => !estaVacia(f) && Object.keys(erroresDeFila(f, incluyeIgv, igv)).length === 0);

/** Cliente obligatorio, entre 1 y 100 filas completas; las filas a medias se señalan y las vacías se ignoran. */
export function validarHoja(h: HojaDirecta, igv: number = IGV_POR_DEFECTO): { ok: boolean; errores: ErroresDeHoja } {
  const errores: ErroresDeHoja = { porFila: {} };
  if (!h.cliente) errores.cliente = 'Elige el cliente.';
  let completas = 0;
  for (const f of h.filas) {
    if (estaVacia(f)) continue;
    const e = erroresDeFila(f, h.incluyeIgv, igv);
    if (Object.keys(e).length === 0) completas += 1;
    else errores.porFila[f.clave] = e;
  }
  if (completas === 0 && Object.keys(errores.porFila).length === 0) errores.filas = 'Agrega al menos una fila con descripción, cantidad y precio o importe.';
  else if (completas > MAXIMO_DE_LINEAS_DE_COTIZACION) errores.filas = `Una cotización admite hasta ${MAXIMO_DE_LINEAS_DE_COTIZACION} filas.`;
  else if (Object.keys(errores.porFila).length > 0) errores.filas = 'Completa o borra las filas señaladas.';
  return { ok: !errores.cliente && !errores.filas && Object.keys(errores.porFila).length === 0, errores };
}

/** Título: la referencia o, si no hay, la primera descripción (hasta 200). */
export function tituloDeHoja(h: Pick<HojaDirecta, 'referencia' | 'filas'>): string {
  const base = h.referencia.trim() || h.filas.find((f) => f.descripcion.trim() !== '')?.descripcion.trim() || 'Cotización directa';
  return base.slice(0, MAXIMO_DE_TITULO);
}

/** La línea manual: siempre con el importe tal como se escribió (o calculado del precio) y el unitario si cabe. */
function lineaDeFila(f: FilaDirecta, c: FilaCalculada): LineaDeCotizacionEntrada {
  return {
    tipo: 'manual',
    descripcion: f.descripcion.trim(),
    unidad: f.unidad.trim() || 'unidad',
    cantidadMilesimas: c.cantidadMilesimas ?? 0,
    importeCentimos: c.importeBrutoCentimos ?? 0,
    ...(c.precioMilesimas !== null && c.precioMilesimas >= 1 && { precioUnitarioMilesimas: c.precioMilesimas }),
  };
}

export function argumentosDeHojaDirecta(h: HojaDirecta, igv: number = IGV_POR_DEFECTO): EntradaDe<'cotizacion_crear'> {
  const lineas = filasCompletas(h.filas, h.incluyeIgv, igv).map((f) => lineaDeFila(f, calcularFila(f, h.incluyeIgv, igv)));
  return {
    titulo: tituloDeHoja(h),
    ...(h.cliente && { clienteId: h.cliente.id }),
    lineas,
    preciosIncluyenIgv: h.incluyeIgv,
    condiciones: { validezDias: h.validezDias, plazoEntrega: h.plazoEntrega.trim(), formaPago: h.formaPago.trim() },
  };
}
