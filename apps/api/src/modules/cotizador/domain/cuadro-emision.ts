// De un cuadro a lo que se emite: una línea por cantidad enviada (cantidad, descripción del trabajo y precio SIN IGV en céntimos),
// los totales y la foto (`Emision`) que se congela. El IGV se calcula por línea, como en toda cotización (`igv.ts`).
import { cantidadAMilesimas, importeACentimos, unitarioAMilesimas } from './adaptador-de-dinero.js';
import { igvDeImporte } from './igv.js';
import { totalesDe, type LineaArmada, type Totales } from './lineas.js';
import { CERO, esMayor } from './motor/base/dinero.js';
import { correcto, fallo, type Resultado } from './motor/base/resultado.js';
import type { Emision } from './motor/costeo/tipos/borrador.js';
import type { Calculo } from './motor/costeo/tipos/cotizacion.js';
import { COLUMNAS, type Columna } from './motor/costeo/tipos/cuadro-directo.js';
import { validarPuntos } from './motor/escala/validar-referencias.js';
import type { Cuadro } from './cuadro-tipos.js';
import type { CuadroEvaluado } from './cuadro-calculo.js';

export type CantidadEnviada = { cantidad: string; calculo: Calculo };

/** Las cantidades que se le envían al cliente, de menor a mayor: las columnas elegidas o, sin columna base, la cantidad del trabajo. */
export function cantidadesEnviadas(e: CuadroEvaluado): CantidadEnviada[] {
  const base = e.directo.base;
  if (base === null) return e.rige ? [{ cantidad: e.cuadro.trabajo.cantidad, calculo: e.rige }] : [];
  const enviadas = COLUMNAS.filter((c: Columna) => c === base || e.directo.columnas[c].seEnvia);
  return enviadas.flatMap((c) => {
    const calculo = e.directo.columnas[c].calculo;
    return calculo ? [{ cantidad: c as string, calculo }] : [];
  });
}

const descripcionDeLinea = (c: Cuadro): string => {
  const { producto, descripcion } = c.trabajo;
  return (descripcion ? `${producto} · ${descripcion}` : producto).slice(0, 300);
};

/** Una línea por cantidad enviada, en céntimos enteros; el importe es el precio del cuadro tal cual (no se recalcula cantidad × unitario). */
export function lineasDeCuadro(cuadro: Cuadro, enviadas: readonly CantidadEnviada[], igvPorcentaje: number): LineaArmada[] {
  return enviadas.map(({ cantidad, calculo }) => {
    const importeCentimos = importeACentimos(calculo.precio);
    const igvCentimos = igvDeImporte(importeCentimos, igvPorcentaje);
    return {
      tipo: 'manual',
      productoId: null,
      listaId: null,
      descripcion: descripcionDeLinea(cuadro),
      unidad: 'unidad',
      cantidadMilesimas: cantidadAMilesimas(cantidad),
      precioUnitarioMilesimas: calculo.unitario === null ? 0 : unitarioAMilesimas(calculo.unitario),
      importeCentimos,
      igvCentimos,
      totalCentimos: importeCentimos + igvCentimos,
      detalle: { origen: 'cuadro', opcion: cantidad, cantidad, margenPct: calculo.margenPct, semaforo: calculo.semaforo },
    };
  });
}

/** Lo que el borrador deja en la versión en cada edición: líneas, totales y costo/margen de la cantidad base. `null` si aún no se puede calcular. */
export type ResumenDeVersion = { lineas: LineaArmada[]; totales: Totales; conOpciones: boolean; costoCentimos: number | null; margenPct: string | null };

export function resumenDeBorrador(e: CuadroEvaluado, igvPorcentaje: number): ResumenDeVersion {
  const enviadas = cantidadesEnviadas(e).filter((x) => esMayor(x.calculo.precio, CERO));
  const lineas = lineasDeCuadro(e.cuadro, enviadas, igvPorcentaje);
  const rige = e.rige;
  return {
    lineas,
    totales: totalesDe(lineas),
    conOpciones: lineas.length > 1,
    costoCentimos: rige && lineas.length > 0 ? importeACentimos(rige.costoTotal) : null,
    margenPct: rige && lineas.length > 0 ? rige.margenPct : null,
  };
}

export type EmisionDeCuadro = ResumenDeVersion & {
  /** Lo que aporta quien emite; el instante y la persona los estampa el repositorio. */
  emision: Omit<Emision, 'emitidaPor' | 'emitidaEn'>;
  hayRojo: boolean;
  avisos: string[];
};

const conflicto = (mensaje: string) => fallo('conflicto', mensaje);

/** Lo que falta para poder emitir, en el orden en que se dice. */
function problemaDeCompletitud(e: CuadroEvaluado): string | null {
  const { cuadro, calculado } = e;
  if (cuadro.trabajo.producto.trim() === '') return 'Falta el nombre del producto del trabajo.';
  if (!esMayor(cuadro.trabajo.cantidad, CERO)) return 'Fija la cantidad del trabajo antes de emitir.';
  if (cuadro.trabajo.pieza === null) return 'Faltan las medidas de la pieza del trabajo.';
  if (calculado.faltantes.length > 0) return `Falta completar la imposición: ${calculado.faltantes.join(', ')}.`;
  if (calculado.problema) return `La imposición no se puede calcular: ${calculado.problema.mensaje}`;
  const hayManual = e.directo.filas.some((f) => COLUMNAS.some((c) => f.celdas[c].origen === 'mano'));
  if (cuadro.lineas.length === 0 && !hayManual) return 'El cuadro no tiene filas ni costos escritos: agrega los costos antes de emitir.';
  return null;
}

function problemaDeColumna(e: CuadroEvaluado, c: Columna, soloUna: boolean): string | null {
  const columna = e.directo.columnas[c];
  const con = soloUna ? '' : `Con ${c} unidades: `;
  if (!columna.completa || !columna.calculo) return `${con}${columna.motivo ?? 'el cuadro no se puede calcular'}`;
  if (!esMayor(columna.calculo.precio, CERO)) return `${con}el precio es cero: revisa los costos y la utilidad.`;
  return null;
}

/** Valida y arma lo que se emite. Los fallos son estados del cuadro (`conflicto`) con el mensaje que se le dice a la persona. */
export function prepararEmisionDeCuadro(e: CuadroEvaluado, igvPorcentaje: number, config: Emision['configuracion']): Resultado<EmisionDeCuadro, 'conflicto'> {
  const incompleto = problemaDeCompletitud(e);
  if (incompleto) return conflicto(incompleto);
  const { cuadro } = e;
  const base = e.directo.base;
  if (base === null && e.rige === null) return conflicto('El cuadro aún no se puede calcular: revisa el papel y la imposición.');
  const columnas = base === null ? [] : COLUMNAS.filter((c) => c === base || e.directo.columnas[c].seEnvia);
  if (columnas.length > 1 && cuadro.precioFinal !== null) {
    return conflicto('Hay un precio final fijado a mano y se envían varias cantidades: quita el precio final o deja una sola cantidad.');
  }
  for (const c of columnas) {
    const problema = problemaDeColumna(e, c, columnas.length === 1);
    if (problema) return conflicto(problema);
  }
  const enviadas = cantidadesEnviadas(e);
  const [primera] = enviadas;
  if (!primera || !e.rige) return conflicto('El cuadro aún no se puede calcular.');
  if (base === null && !esMayor(primera.calculo.precio, CERO)) return conflicto('El precio es cero: revisa los costos y la utilidad.');

  const coherencia = validarPuntos(enviadas.map((x) => ({ cantidad: x.cantidad, total: x.calculo.precio })));
  if (coherencia.bloqueos[0]) return conflicto(coherencia.bloqueos[0].mensaje);

  const resumen = resumenDeBorrador(e, igvPorcentaje);
  return correcto({
    ...resumen,
    hayRojo: enviadas.some((x) => x.calculo.semaforo === 'rojo'),
    avisos: coherencia.avisos.map((a) => a.mensaje),
    emision: { configuracion: config, calculo: e.rige, imposicion: e.calculado.imposicion, motivoMargenBajo: null, directo: e.directo },
  });
}
