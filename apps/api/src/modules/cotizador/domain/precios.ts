// Fachada única de las herramientas al motor (R22): convierte céntimos y milésimas a texto con el adaptador,
// llama al motor y devuelve céntimos. Solo este archivo y `lista.ts` importan de `./motor/`.
import { centimosAImporte, importeACentimos, milesimasACantidad, porcentajeDeBase, unitarioAMilesimas } from './adaptador-de-dinero.js';
import { CANTIDADES_DE_LA_TABLA_DE_PRECIOS, type FilaDePrecioDto } from '@capaz/shared';
import { igvDeImporte } from './igv.js';
import { precioDeRapida } from './motor/escala/precio-rapido.js';
import type { Ajuste, VariantePrecio } from './motor/escala/tipos/precio-por-escala.js';
import { validarReferencias } from './motor/escala/validar-referencias.js';

export type ModoIntermedio = 'curva' | 'escalon';
export type RedondeoComercial = 'ninguno' | '1' | '5' | '10';
export type CodigoDeRechazo = 'conflicto' | 'argumentos_invalidos';
export type Rechazo = { ok: false; codigo: CodigoDeRechazo; mensaje: string };

export type ListaParaCotizar = {
  p100Centimos: number;
  p1000Centimos: number;
  p5000Centimos: number;
  modoIntermedio: ModoIntermedio;
  precioMinimoCentimos: number | null;
};
export type AjusteEnCentimos = { tipo: 'ninguno' } | { tipo: 'precio'; importeCentimos: number } | { tipo: 'monto'; importeCentimos: number };
export type PedidoDePrecio = {
  cantidadMilesimas: number;
  /** Porcentaje con signo del cliente como lo guarda la base ('-5.000'); `null` si no tiene. */
  ajusteClientePct: string | null;
  redondeo: RedondeoComercial;
  ajuste: AjusteEnCentimos;
  igvPorcentaje: number;
};
export type PrecioEnCentimos = {
  precioListaCentimos: number;
  importeCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  precioUnitarioMilesimas: number;
  minimoAplicado: boolean;
  ajusteClientePct: string | null;
};

/** 100000 → «100»; 2500000 → «2.500»; 1500 → «1,5» (separadores del Perú). */
function cantidadLegible(milesimas: number): string {
  const [entera, decimales] = milesimasACantidad(milesimas).split('.');
  const miles = (entera ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimales ? `${miles},${decimales}` : miles;
}

const variante = (l: ListaParaCotizar): VariantePrecio => ({
  p100: centimosAImporte(l.p100Centimos),
  p1000: centimosAImporte(l.p1000Centimos),
  p5000: centimosAImporte(l.p5000Centimos),
  modoIntermedio: l.modoIntermedio,
  ...(l.precioMinimoCentimos === null ? {} : { precioMinimo: centimosAImporte(l.precioMinimoCentimos) }),
});

function ajusteDelMotor(a: AjusteEnCentimos): Ajuste {
  if (a.tipo === 'ninguno') return { tipo: 'ninguno' };
  const texto = centimosAImporte(a.importeCentimos);
  return a.tipo === 'precio' ? { tipo: 'precio', precio: texto } : { tipo: 'monto', monto: texto };
}

/** Códigos del motor → rechazo de herramienta (regla 3 de la ficha). */
function rechazoDelMotor(codigo: string, mensaje: string, cantidadMilesimas: number): Rechazo {
  if (codigo === 'fuera_de_rango') {
    return { ok: false, codigo: 'conflicto', mensaje: `${cantidadLegible(cantidadMilesimas)} unidades está fuera de 100 a 5.000 unidades: hay que cotizar aparte.` };
  }
  if (codigo === 'cantidad_invalida' || codigo === 'precio_no_positivo') return { ok: false, codigo: 'argumentos_invalidos', mensaje };
  return { ok: false, codigo: 'conflicto', mensaje };
}

/** Lista → ajuste del cliente → redondeo comercial → ajuste de esta cotización; después el IGV de la línea. Todo sin escribir. */
export function cotizarDesdeLista(lista: ListaParaCotizar, pedido: PedidoDePrecio): { ok: true; valor: PrecioEnCentimos } | Rechazo {
  const ajusteCliente = pedido.ajusteClientePct === null ? null : porcentajeDeBase(pedido.ajusteClientePct);
  let r;
  try {
    r = precioDeRapida(variante(lista), milesimasACantidad(pedido.cantidadMilesimas), ajusteDelMotor(pedido.ajuste), pedido.redondeo, ajusteCliente);
  } catch (e) {
    if (e instanceof RangeError) return { ok: false, codigo: 'argumentos_invalidos', mensaje: e.message };
    throw e;
  }
  if (!r.ok) return rechazoDelMotor(r.error.codigo, r.error.mensaje, pedido.cantidadMilesimas);
  const importeCentimos = importeACentimos(r.valor.precioFinal);
  const igvCentimos = igvDeImporte(importeCentimos, pedido.igvPorcentaje);
  return {
    ok: true,
    valor: {
      precioListaCentimos: importeACentimos(r.valor.precioLista),
      importeCentimos,
      igvCentimos,
      totalCentimos: importeCentimos + igvCentimos,
      precioUnitarioMilesimas: unitarioAMilesimas(r.valor.unitario),
      minimoAplicado: r.valor.minimoAplicado,
      ajusteClientePct: pedido.ajusteClientePct === null ? null : (r.valor.ajusteClientePct ?? ajusteCliente),
    },
  };
}

export type ReferenciasEnCentimos = { p100Centimos: number; p1000Centimos: number; p5000Centimos: number };
/** `bloqueos` (invariante B: el total no crece) impiden guardar; `avisos` (invariante A: el unitario no baja) piden confirmar. */
export type ValidacionDeLista = { bloqueos: string[]; avisos: string[] };

/** Envuelve `validarReferencias` del motor: mismas reglas, mensajes del motor. */
export function validarLista(r: ReferenciasEnCentimos): ValidacionDeLista {
  const v = validarReferencias({ p100: centimosAImporte(r.p100Centimos), p1000: centimosAImporte(r.p1000Centimos), p5000: centimosAImporte(r.p5000Centimos) });
  return { bloqueos: v.bloqueos.map((h) => h.mensaje), avisos: v.avisos.map((h) => h.mensaje) };
}

const REFERENCIAS_EN_MILESIMAS = [100_000, 1_000_000, 5_000_000] as const;

/** La cantidad no es 100, 1.000 ni 5.000: el precio sale de interpolar (o del escalón), no de una referencia. */
export const esEstimacion = (cantidadMilesimas: number): boolean => !REFERENCIAS_EN_MILESIMAS.some((r) => r === cantidadMilesimas);

/** Modo escalón: la cantidad (milésimas) de la mayor referencia que no supera la pedida, cuyo unitario rige; con curva, `null`. */
export function escalonDe(modo: ModoIntermedio, cantidadMilesimas: number): number | null {
  if (modo !== 'escalon') return null;
  return [...REFERENCIAS_EN_MILESIMAS].reverse().find((r) => cantidadMilesimas >= r) ?? REFERENCIAS_EN_MILESIMAS[0];
}

/** Precios del lote a las cantidades frecuentes, con el ajuste del cliente y el redondeo (sin ajuste de cotización). */
export function tablaDePrecios(lista: ListaParaCotizar, base: Omit<PedidoDePrecio, 'cantidadMilesimas' | 'ajuste'>): FilaDePrecioDto[] {
  const filas: FilaDePrecioDto[] = [];
  for (const unidades of CANTIDADES_DE_LA_TABLA_DE_PRECIOS) {
    const cantidadMilesimas = unidades * 1000;
    const r = cotizarDesdeLista(lista, { ...base, cantidadMilesimas, ajuste: { tipo: 'ninguno' } });
    if (r.ok) filas.push({ cantidadMilesimas, importeCentimos: r.valor.importeCentimos, igvCentimos: r.valor.igvCentimos, totalCentimos: r.valor.totalCentimos, precioUnitarioMilesimas: r.valor.precioUnitarioMilesimas });
  }
  return filas;
}
