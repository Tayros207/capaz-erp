import type { VistaDelCuadroDto } from '@capaz/shared';
import type { TonoDeInsignia } from '../../../shared/ui/insignia.tsx';
import { milesimasATexto } from '../../../shared/formato/milesimas.ts';
import { soles } from '../logica.ts';
import { etiquetaDeFactor, FACTORES, mostrarDecimal, type Factor } from '../logica-taller.ts';

// Lógica pura de la pantalla del cuadro por partes. Todo el cálculo viene del servidor: aquí solo se ordena,
// se rotula y se decide qué mostrar. Nada de sumar ni de multiplicar importes.

export type Vista = VistaDelCuadroDto;
export type Fila = Vista['lineas'][number];
export type FilaDirecta = NonNullable<Vista['directo']['interno']>['filas'][number];
export type Columna = keyof Vista['directo']['columnas'];
export type Origen = FilaDirecta['celdas'][Columna]['origen'];
export type Semaforo = NonNullable<NonNullable<Vista['interno']>['costos']>['semaforo'];

export const COLUMNAS: readonly Columna[] = ['100', '1000', '5000'];
export const ETIQUETA_DE_COLUMNA: Readonly<Record<Columna, string>> = { '100': '100', '1000': '1.000', '5000': '5.000' };

export const RUTA_DE_CUADRO_NUEVO = '/m/cotizador/cuadro/nuevo';
export const rutaDeCuadro = (id: string): string => `/m/cotizador/cuadro/${id}`;

export type Pestana = 'trabajo' | 'costos' | 'precio';
export const PESTANAS: ReadonlyArray<{ id: Pestana; etiqueta: string }> = [
  { id: 'trabajo', etiqueta: 'Trabajo' },
  { id: 'costos', etiqueta: 'Costos' },
  { id: 'precio', etiqueta: 'Precio' },
];

/** El semáforo del margen: el texto va siempre junto al color (no solo color). */
export const ETIQUETA_DE_SEMAFORO: Readonly<Record<NonNullable<Semaforo>, { texto: string; tono: TonoDeInsignia }>> = {
  verde: { texto: 'Margen bueno', tono: 'exito' },
  ambar: { texto: 'Margen justo', tono: 'aviso' },
  rojo: { texto: 'Margen bajo', tono: 'peligro' },
};

/** De dónde sale el valor de una celda del cuadro directo: marca corta y frase de la leyenda. */
export const LEYENDA_DE_ORIGEN: Readonly<Record<Origen, { marca: string; frase: string; tono: TonoDeInsignia }>> = {
  mano: { marca: 'Mano', frase: 'Escrito a mano.', tono: 'info' },
  detalle: { marca: 'Detalle', frase: 'Sale del cuadro por factor.', tono: 'neutro' },
  deducida: { marca: 'Deducido', frase: 'Deducido de otra cantidad (fila fija).', tono: 'neutro' },
  vacia: { marca: 'Vacía', frase: 'Sin dato: escríbelo para completar la columna.', tono: 'aviso' },
  no_calculable: { marca: 'Sin cálculo', frase: 'No se puede calcular todavía.', tono: 'peligro' },
};

export const textoDePorcentaje = (pct: string | null | undefined): string => (pct === null || pct === undefined ? '—' : `${mostrarDecimal(pct)} %`);
export const textoDeImporte = (centimos: number | null): string => (centimos === null ? '—' : soles(centimos));
/** Precio de lote por unidad: viene del servidor en milésimas de sol; aquí solo se rotula. */
export const textoDeUnitario = (milesimas: number | null): string => (milesimas === null ? '—' : `S/ ${milesimasATexto(milesimas)}`);

export type GrupoDeFactor = { factor: Factor; etiqueta: string; filas: Fila[]; subtotalCentimos: number | null };

/** Las filas agrupadas por factor, en el orden fijo del cuadro; el subtotal de cada factor lo da el servidor. */
export function agruparPorFactor(v: Vista): GrupoDeFactor[] {
  const porFactor = v.interno?.costos?.porFactorCentimos;
  return FACTORES.map(({ valor }) => ({
    factor: valor,
    etiqueta: etiquetaDeFactor(valor),
    filas: v.lineas.filter((l) => l.factor === valor),
    subtotalCentimos: porFactor ? (porFactor[valor] ?? 0) : null,
  }));
}

/** Lo que impide calcular la imposición, dicho para una persona. */
export function avisosDeImposicion(v: Vista): string[] {
  const { faltantes, problema } = v.imposicion;
  return [...(faltantes.length ? [`Falta: ${faltantes.join(', ')}.`] : []), ...(problema ? [problema] : [])];
}

export const estaEnBorrador = (v: Vista): boolean => v.estado === 'borrador';
export const sePuedeEmitir = (v: Vista): boolean => estaEnBorrador(v) && v.comercial !== null;
export const semaforoDe = (v: Vista): Semaforo => v.interno?.costos?.semaforo ?? null;
/** Con el semáforo en rojo se pide el motivo antes de emitir. */
export const pideMotivoAntesDeEmitir = (v: Vista): boolean => semaforoDe(v) === 'rojo';

/** La fila que el motor llena con los pliegos madre (el papel), si la hay. */
export const filaDePapel = (v: Vista): Fila | undefined => v.lineas.find((l) => l.automatica === 'papel');

/** Cuántas cantidades se envían al cliente (para el resumen de la barra). */
export const columnasQueSeEnvian = (v: Vista): Columna[] => COLUMNAS.filter((c) => v.directo.columnas[c].seEnvia);
