// Reglas de una cotización que no dependen de la base. Puras.
import type { CondicionesDeCotizacion } from '@capaz/shared';
import type { LineaArmada } from './lineas.js';

/** Clave del correlativo (R8): sin serie; el año es el de `hoyDeLaEmpresa`. */
export const CLAVE_DE_CORRELATIVO = 'cotizador.cotizacion';

/** «Borrador» sin número; «COT-2026-0001»; desde la segunda versión «COT-2026-0001 v2». */
export function codigoDeCotizacion(numero: number | null, anio: number | null, version = 1): string {
  if (numero === null || anio === null) return 'Borrador';
  const base = `COT-${anio}-${String(numero).padStart(4, '0')}`;
  return version > 1 ? `${base} v${version}` : base;
}

/** Suma días a un día `AAAA-MM-DD` (calendario, sin zona). */
export function sumarDias(dia: string, dias: number): string {
  const f = new Date(`${dia}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** Lo que la cotización escribió manda; lo vacío o `null` se completa con la configuración de la empresa. */
export function fusionarCondiciones(config: CondicionesDeCotizacion, propias: Partial<CondicionesDeCotizacion>): CondicionesDeCotizacion {
  const texto = (k: 'plazoEntrega' | 'formaPago' | 'tolerancia' | 'noIncluye') => (propias[k] && propias[k] !== '' ? propias[k] : config[k]) ?? '';
  return {
    validezDias: propias.validezDias ?? config.validezDias,
    plazoEntrega: texto('plazoEntrega'),
    formaPago: texto('formaPago'),
    tolerancia: texto('tolerancia'),
    noIncluye: texto('noIncluye'),
  };
}

/** 2500000 → «2.500»; 1500 → «1,5» (separadores del Perú). */
function cantidadLegible(milesimas: number): string {
  const entera = Math.trunc(milesimas / 1000);
  const dec = String(milesimas % 1000).padStart(3, '0').replace(/0+$/, '');
  const miles = String(entera).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec ? `${miles},${dec}` : miles;
}

/** «2.500 unidades · Volantes A5 4/4 couché 150 g» (máximo 300 caracteres). */
export function descripcionDeLineaAceptada(l: Pick<LineaArmada, 'cantidadMilesimas' | 'unidad' | 'descripcion'>): string {
  const unidad = l.unidad === 'unidad' ? (l.cantidadMilesimas === 1000 ? 'unidad' : 'unidades') : l.unidad;
  return `${cantidadLegible(l.cantidadMilesimas)} ${unidad} · ${l.descripcion}`.slice(0, 300);
}

export type LineaDeEvento = { productoId: string | null; descripcion: string; unidad: string; cantidadMilesimas: number; precioUnitarioMilesimas: number; afectoIgv: boolean };

/** Una línea aceptada en el formato de una línea de pedido: un lote, con precio CON IGV (D17). */
export function lineaParaEvento(l: Pick<LineaArmada, 'productoId' | 'cantidadMilesimas' | 'unidad' | 'descripcion' | 'totalCentimos'>, igvPorcentaje: number): LineaDeEvento {
  return {
    productoId: l.productoId,
    descripcion: descripcionDeLineaAceptada(l),
    unidad: 'lote',
    cantidadMilesimas: 1000,
    precioUnitarioMilesimas: l.totalCentimos * 10,
    afectoIgv: igvPorcentaje > 0,
  };
}

/** Qué posiciones se aceptan: por defecto todas; con opciones hay que indicar al menos una. */
export function elegirPosiciones(args: { posiciones?: readonly number[]; conOpciones: boolean; existentes: readonly number[] }): { ok: true; posiciones: number[] } | { ok: false; motivo: string } {
  if (args.posiciones === undefined) {
    return args.conOpciones ? { ok: false, motivo: 'Esta cotización es por opciones: indica cuáles acepta el cliente.' } : { ok: true, posiciones: [...args.existentes] };
  }
  const unicas = [...new Set(args.posiciones)].sort((a, b) => a - b);
  const desconocida = unicas.find((p) => !args.existentes.includes(p));
  if (desconocida !== undefined) return { ok: false, motivo: `La línea ${desconocida + 1} no existe en esta cotización.` };
  return unicas.length > 0 ? { ok: true, posiciones: unicas } : { ok: false, motivo: 'Indica al menos una línea.' };
}
