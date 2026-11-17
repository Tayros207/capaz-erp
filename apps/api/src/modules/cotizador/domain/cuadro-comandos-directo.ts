// Comandos del cuadro de costos directo (PRP-007): celdas escritas a mano, filas fijas, columnas que se envían, utilidad y
// precio final. Los importes llegan en céntimos y se pasan al motor como texto con el adaptador (R22).
import { centimosAImporte } from './adaptador-de-dinero.js';
import { CERO, CIEN, aTexto, dividir, esMayor, esMenor, multiplicar, redondear, restar } from './motor/base/dinero.js';
import { evaluarBorrador } from './cuadro-calculo.js';
import { FACTORES, type Factor } from './motor/base/dominio.js';
import { utilidadSchema, type ConfiguracionDeCosteo } from './motor/costeo/tipos/cotizacion.js';
import { COLUMNAS, columnaDe, directoVacio, type Columna, type Directo } from './motor/costeo/tipos/cuadro-directo.js';
import { calcularCuadro } from './motor/costeo/cuadro.js';
import type { Cuadro, ResultadoDeComando } from './cuadro-tipos.js';
import { avisoComercial, avisoInterno, rechazarCuadro } from './cuadro-tipos.js';

/** El cuadro directo para editarlo: si el cuadro no lo tenía, se crea vacío (con la base entre las que se envían). */
function directoParaEditar(cuadro: Cuadro): Directo {
  cuadro.directo ??= directoVacio(columnaDe(cuadro.trabajo.cantidad));
  return cuadro.directo;
}

const esFactor = (clave: string): clave is Factor => (FACTORES as readonly string[]).includes(clave);
const existeLaFila = (d: Directo, clave: string) => esFactor(clave) || d.items.some((i) => i.id === clave);
const filaFija = (d: Directo, clave: string) => (esFactor(clave) ? (d.factores[clave]?.fija ?? false) : (d.items.find((i) => i.id === clave)?.fija ?? false));

/** Marca o desmarca una fila como fija. Marcarla no cambia ningún importe (R5): solo cómo se escribirá desde ahora. */
function marcarFija(d: Directo, clave: string, fija: boolean): void {
  if (esFactor(clave)) {
    const fila = (d.factores[clave] ??= { celdas: {}, fija });
    fila.fija = fija;
    return;
  }
  const item = d.items.find((i) => i.id === clave);
  if (item) item.fija = fija;
}

/** Escribe (o quita, con `null`) el importe de una celda; en una fila fija el mismo importe va a las tres columnas. */
function escribirCelda(d: Directo, clave: string, columna: Columna, importe: string | null): void {
  const columnas: readonly Columna[] = filaFija(d, clave) ? COLUMNAS : [columna];
  const celdas = esFactor(clave) ? (d.factores[clave] ??= { celdas: {}, fija: false }).celdas : d.items.find((i) => i.id === clave)?.celdas;
  if (!celdas) return;
  for (const c of columnas) {
    if (importe === null) delete celdas[c];
    else celdas[c] = importe;
  }
  if (esFactor(clave)) {
    const propia = d.factores[clave];
    if (propia && !propia.fija && Object.keys(propia.celdas).length === 0) delete d.factores[clave];
  }
}

export type DatosDeCostoDirecto = {
  celdas?: { fila: string; columna: Columna; importeCentimos: number | null }[] | undefined;
  fijas?: { fila: string; fija: boolean }[] | undefined;
};

export function aplicarCostoDirecto(cuadro: Cuadro, a: DatosDeCostoDirecto): ResultadoDeComando {
  const directo = directoParaEditar(cuadro);
  const nombradas = [...(a.fijas ?? []).map((f) => f.fila), ...(a.celdas ?? []).map((c) => c.fila)];
  const ausente = nombradas.find((fila) => !existeLaFila(directo, fila));
  if (ausente !== undefined) {
    return rechazarCuadro('no_encontrado', `No hay una fila «${ausente}» en el cuadro: usa material, planchas, impresion, diseno, acabado, indirectos o el id de un ítem.`);
  }
  // Primero las marcas: así una celda escrita en la misma llamada ya cuenta con la fila fija.
  for (const { fila, fija } of a.fijas ?? []) marcarFija(directo, fila, fija);
  for (const { fila, columna, importeCentimos } of a.celdas ?? []) escribirCelda(directo, fila, columna, importeCentimos === null ? null : centimosAImporte(importeCentimos));
  return { ok: true, cuadro, avisos: [] };
}

export function aplicarColumnasAEnviar(cuadro: Cuadro, columnas: readonly Columna[]): ResultadoDeComando {
  const base = columnaDe(cuadro.trabajo.cantidad);
  if (base === null) {
    return rechazarCuadro('conflicto', `Primero elige la cantidad del trabajo entre ${COLUMNAS.join(', ')}: es la que siempre se envía. Con otra cantidad el cuadro se cotiza solo a esa.`);
  }
  const elegidas = COLUMNAS.filter((c) => columnas.includes(c) || c === base);
  if (elegidas.length > 1 && cuadro.precioFinal !== null) {
    return rechazarCuadro('conflicto', 'Hay un precio final fijado a mano: vale para una sola cantidad. Quítalo antes de enviar más de una.');
  }
  const avisos = columnas.includes(base) ? [] : [avisoComercial('base_agregada', `La cantidad base (${base}) siempre se envía: se agregó.`)];
  directoParaEditar(cuadro).enviar = [base, ...elegidas.filter((c) => c !== base)];
  return { ok: true, cuadro, avisos };
}

export type DatosDeUtilidad = { pct?: string | null | undefined; base?: 'venta' | 'costo' | undefined; columna?: Columna | undefined };

export function aplicarUtilidad(cuadro: Cuadro, a: DatosDeUtilidad): ResultadoDeComando {
  const pct = a.pct === null ? undefined : a.pct;
  // Una utilidad por columna se prueba con la base de la cotización: sobre la venta no puede llegar a 100.
  const valida = utilidadSchema.safeParse({ pct: pct ?? cuadro.utilidad.pct, base: a.base ?? cuadro.utilidad.base });
  if (!valida.success) return rechazarCuadro('argumentos_invalidos', valida.error.issues[0]?.message ?? 'Utilidad imposible.');
  if (a.columna === undefined) {
    cuadro.utilidad = valida.data;
    return { ok: true, cuadro, avisos: [] };
  }
  const directo = directoParaEditar(cuadro);
  if (pct === undefined) delete directo.utilidadPct[a.columna];
  else directo.utilidadPct[a.columna] = pct;
  return { ok: true, cuadro, avisos: [] };
}

/** Si el precio deja el margen bajo el mínimo (semáforo rojo) se avisa: lo comercial sin cifras, el margen solo como aviso interno. */
function avisosDeMargen(cuadro: Cuadro, config: ConfiguracionDeCosteo) {
  const r = calcularCuadro(cuadro, config);
  if (!r.ok || r.valor.calculo.semaforo !== 'rojo') return [];
  return [
    avisoComercial('precio_bajo_minimo', 'El precio queda por debajo del mínimo aceptable: al emitir se pedirá un motivo.'),
    avisoInterno('margen_bajo_minimo', `El margen queda en ${r.valor.calculo.margenPct ?? '0'} %, por debajo del mínimo de ${config.umbralMinimoPct} %.`),
  ];
}

/** Un descuento sobre el precio SUGERIDO (se negocia el precio, no el margen): `descuentoPct` mayor que 0 y menor que 100. */
function conDescuento(cuadro: Cuadro, descuentoPct: string, config: ConfiguracionDeCosteo): string | ReturnType<typeof rechazarCuadro> {
  if (!esMayor(descuentoPct, CERO) || !esMenor(descuentoPct, CIEN)) return rechazarCuadro('argumentos_invalidos', 'El descuento debe ser mayor que 0 y menor que 100.');
  const e = evaluarBorrador({ ...cuadro, precioFinal: null }, config as Parameters<typeof evaluarBorrador>[1]);
  const sugerido = e.ok ? e.valor.rige?.precioSugerido : undefined;
  if (!e.ok) return rechazarCuadro('argumentos_invalidos', e.error.mensaje);
  if (!sugerido || !esMayor(sugerido, CERO)) return rechazarCuadro('conflicto', 'Todavía no hay un precio sugerido sobre el que aplicar un descuento.');
  return aTexto(redondear(dividir(multiplicar(sugerido, restar(CIEN, descuentoPct)), CIEN), 2), 2);
}

export type DatosDePrecioFinal = { precioCentimos?: number | null | undefined; descuentoPct?: string | undefined };

export function aplicarPrecioFinal(cuadro: Cuadro, a: DatosDePrecioFinal, config: ConfiguracionDeCosteo): ResultadoDeComando {
  if (a.precioCentimos === null) {
    cuadro.precioFinal = null;
    return { ok: true, cuadro, avisos: [] };
  }
  // R8 (PRP-007): un precio fijado a mano vale para una sola cantidad.
  if ((cuadro.directo?.enviar.length ?? 0) > 1) {
    return rechazarCuadro('conflicto', 'Se están enviando varias cantidades: el precio final a mano vale para una sola. Deja una sola cantidad para enviar y vuelve a intentarlo.');
  }
  if (a.descuentoPct !== undefined) {
    const p = conDescuento(cuadro, a.descuentoPct, config);
    if (typeof p !== 'string') return p;
    cuadro.precioFinal = p;
  } else {
    cuadro.precioFinal = centimosAImporte(a.precioCentimos as number);
  }
  return { ok: true, cuadro, avisos: avisosDeMargen(cuadro, config) };
}
