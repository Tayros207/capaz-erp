// La vista del cuadro para el DTO (herramientas y `cotizacion_ver`): costos y margen solo con `cotizador:costos`, en céntimos.
// Sin ese permiso las claves `interno` ni siquiera existen. Es el único lugar donde el texto del motor pasa a céntimos.
import type { Aviso, ReciboDelCuadroDto, VistaDelCuadroDto } from '@capaz/shared';
import { importeACentimos, unitarioAMilesimas } from './adaptador-de-dinero.js';
import { FACTORES, type Factor } from './motor/base/dominio.js';
import type { Calculo } from './motor/costeo/tipos/cotizacion.js';
import type { Columna, CuadroDirectoCalculado } from './motor/costeo/tipos/cuadro-directo.js';
import type { ImposicionCalculada } from './motor/costeo/tipos/imposicion.js';
import type { CuadroCalculado } from './motor/costeo/cuadro.js';
import type { CuadroEvaluado } from './cuadro-calculo.js';
import { conImpuesto } from './motor/base/impuesto.js';
import { avisoComercial, type ConfiguracionEmpresa } from './cuadro-tipos.js';

type PrecioComercial = NonNullable<VistaDelCuadroDto['comercial']>;
type CostosDelPrecio = NonNullable<NonNullable<VistaDelCuadroDto['interno']>['costos']>;
type Directo = VistaDelCuadroDto['directo'];

const aCentimos = (importe: string | null): number | null => (importe === null ? null : importeACentimos(importe));
const unitario = (u: string | null): number | null => (u === null ? null : unitarioAMilesimas(u));

/** Lo que ve el cliente de un precio; el impuesto sale de la configuración. */
function comercialDe(calculo: Calculo, impuesto: { nombre: string; pct: string; monto: string } | null, totalConImpuesto: string): PrecioComercial {
  return {
    precioCentimos: importeACentimos(calculo.precio),
    unitarioMilesimas: unitario(calculo.unitario),
    impuesto: impuesto ? { nombre: impuesto.nombre, pct: impuesto.pct, montoCentimos: importeACentimos(impuesto.monto) } : null,
    totalConImpuestoCentimos: importeACentimos(totalConImpuesto),
  };
}

function costosDe(c: Calculo): CostosDelPrecio {
  return {
    costoCentimos: importeACentimos(c.costoTotal),
    utilidadCentimos: importeACentimos(c.utilidad),
    precioSugeridoCentimos: importeACentimos(c.precioSugerido),
    margenPct: c.margenPct,
    semaforo: c.semaforo,
    porFactorCentimos: Object.fromEntries(FACTORES.map((f: Factor) => [f, importeACentimos(c.porFactor[f])])) as CostosDelPrecio['porFactorCentimos'],
  };
}

function columnaDe(d: CuadroDirectoCalculado, c: Columna, verCostos: boolean): Directo['columnas'][Columna] {
  const x = d.columnas[c];
  const calculo = x.calculo;
  return {
    cantidad: x.cantidad,
    esBase: x.esBase,
    seEnvia: x.seEnvia,
    completa: x.completa,
    motivo: x.motivo,
    comercial: calculo && x.totalConImpuesto !== null ? comercialDe(calculo, x.impuesto, x.totalConImpuesto) : null,
    ...(verCostos && calculo
      ? { interno: { ...costosDe(calculo), utilidadPct: x.utilidad.pct, utilidadDeColumna: x.utilidad.deColumna, baseDeUtilidad: x.utilidad.base, equivalentePct: x.utilidad.equivalentePct } }
      : {}),
  };
}

function directoDe(d: CuadroDirectoCalculado, verCostos: boolean): Directo {
  const celda = (f: CuadroDirectoCalculado['filas'][number], c: Columna) => {
    const x = f.celdas[c];
    return { valorCentimos: aCentimos(x.valor), origen: x.origen, delDetalleCentimos: aCentimos(x.delDetalle), motivo: x.motivo, ...(x.desde ? { desde: x.desde } : {}) };
  };
  return {
    base: d.base,
    columnas: { '100': columnaDe(d, '100', verCostos), '1000': columnaDe(d, '1000', verCostos), '5000': columnaDe(d, '5000', verCostos) },
    coherencia: d.coherencia
      ? { bloqueos: d.coherencia.bloqueos.map((h) => ({ codigo: h.codigo, mensaje: h.mensaje })), avisos: d.coherencia.avisos.map((h) => ({ codigo: h.codigo, mensaje: h.mensaje })) }
      : null,
    ...(verCostos
      ? {
          interno: {
            filas: d.filas.map((f) => ({
              clave: f.clave, nombre: f.nombre, esItem: f.esItem, factor: f.factor, fija: f.fija,
              celdas: { '100': celda(f, '100'), '1000': celda(f, '1000'), '5000': celda(f, '5000') },
            })),
          },
        }
      : {}),
  };
}

const pliegosDe = (i: ImposicionCalculada | null): ReciboDelCuadroDto['pliegos'] =>
  i === null
    ? null
    : {
        poses: i.poses, columnas: i.columnas, filas: i.filas, girada: i.girada, pliegosNetos: i.pliegosNetos,
        etapas: i.etapas.map((e) => ({ nombre: e.nombre, mermaPct: e.mermaPct, arranque: e.arranque, salida: e.salida, trasPorcentaje: e.trasPorcentaje, entrada: e.entrada })),
        pliegosDeMaquina: i.pliegosDeMaquina, pliegosPorMadre: i.pliegosPorMadre, pliegosMadre: i.pliegosMadre,
      };

export type MetaDeVista = { cotizacionId: string; version: number; verCostos: boolean };

/** El precio que rige con su impuesto aparte (IGV de la configuración); `null` si el cuadro aún no se puede calcular. */
function comercialQueRige(e: CuadroEvaluado, config: ConfiguracionEmpresa): PrecioComercial | null {
  if (!e.rige) return null;
  const { impuesto, totalConImpuesto } = conImpuesto(e.rige.precio, config);
  return comercialDe(e.rige, impuesto, totalConImpuesto);
}

export function armarVista(e: CuadroEvaluado, meta: MetaDeVista, config: ConfiguracionEmpresa): VistaDelCuadroDto {
  const { cuadro, calculado } = e;
  const subtotales = new Map(calculado.calculo.lineas.map((l) => [l.id, l.subtotal]));
  return {
    cotizacionId: meta.cotizacionId,
    version: meta.version,
    estado: e.emitida ? 'emitida' : 'borrador',
    trabajo: cuadro.trabajo,
    imposicion: { parametros: cuadro.imposicion, calculada: pliegosDe(calculado.imposicion), faltantes: calculado.faltantes, problema: calculado.problema?.mensaje ?? null },
    lineas: cuadro.lineas.map((l, i) => ({
      id: l.id, numero: i + 1, factor: l.factor, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, escala: l.escala,
      automatica: l.id === cuadro.automaticas.papel ? 'papel' : l.id === cuadro.automaticas.planchas ? 'planchas' : null,
      ...(meta.verCostos ? { interno: { costoUnitario: l.costoUnitario, subtotalCentimos: importeACentimos(subtotales.get(l.id) ?? '0.00') } } : {}),
    })),
    precioFinalCentimos: aCentimos(cuadro.precioFinal),
    moneda: config.moneda,
    comercial: comercialQueRige(e, config),
    directo: directoDe(e.directo, meta.verCostos),
    ...(meta.verCostos ? { interno: { utilidad: { pct: cuadro.utilidad.pct, base: cuadro.utilidad.base }, costos: e.rige ? costosDe(e.rige) : null } } : {}),
  };
}

export function armarRecibo(e: CuadroEvaluado, meta: MetaDeVista, vista: VistaDelCuadroDto): ReciboDelCuadroDto {
  return {
    cotizacionId: meta.cotizacionId,
    version: meta.version,
    cantidad: e.cuadro.trabajo.cantidad,
    moneda: vista.moneda,
    comercial: vista.comercial,
    pliegos: pliegosDe(e.calculado.imposicion),
    faltantes: e.calculado.faltantes,
    directo: vista.directo,
    ...(meta.verCostos ? { interno: vista.interno?.costos ?? null } : {}),
  };
}

/** Lo que el cuadro le dice a quien lo arma sobre el papel y la imposición. */
export function avisosDelCuadro(c: CuadroCalculado): Aviso[] {
  if (c.problema) return [avisoComercial('imposicion_no_calculable', c.problema.mensaje)];
  if (c.faltantes.length > 0 && c.cuadro.automaticas.papel !== null) return [avisoComercial('faltan_datos_imposicion', `Para calcular el papel falta: ${c.faltantes.join(', ')}.`)];
  return [];
}
