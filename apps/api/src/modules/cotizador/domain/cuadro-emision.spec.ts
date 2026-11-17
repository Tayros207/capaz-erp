import { describe, expect, it } from 'vitest';
import { evaluarBorrador, evaluarEmitida, evaluarVersion } from './cuadro-calculo.js';
import { configuracionDeMotor } from './cuadro-configuracion.js';
import { cantidadesEnviadas, lineasDeCuadro, prepararEmisionDeCuadro, resumenDeBorrador } from './cuadro-emision.js';
import { generarReferenciasDeCuadro } from './cuadro-referencias.js';
import { armarRecibo, armarVista } from './cuadro-vista.js';
import type { Cuadro } from './cuadro-tipos.js';
import { cuadroDeCotizacionDelCasoDeReferencia } from './motor/costeo/pruebas/caso-de-referencia.js';
import { cuadroSchema } from './motor/costeo/tipos/borrador.js';

// El caso de referencia a nivel de dominio puro (sin base ni HTTP): 2.500 volantes A5 → 225.15 / 346.38 / 172 pliegos madre.

const config = configuracionDeMotor(null);
const caso = (extra: Partial<Cuadro> = {}): Cuadro => ({ ...structuredClone(cuadroDeCotizacionDelCasoDeReferencia), ...extra });
const evaluar = (c: Cuadro) => {
  const e = evaluarBorrador(c, config);
  if (!e.ok) throw new Error(e.error.mensaje);
  return e.valor;
};
const META = { cotizacionId: 'c1', version: 1 };

describe('evaluar el caso de referencia', () => {
  it('costo 225.15, precio 346.38, 172 pliegos madre y semáforo verde', () => {
    const e = evaluar(caso());
    expect(e.rige).toMatchObject({ costoTotal: '225.15', precio: '346.38', margenPct: '35.00', semaforo: 'verde' });
    expect(e.calculado.imposicion?.pliegosMadre).toBe('172');
    expect(e.directo.base).toBeNull();
  });
  it('en céntimos: una línea de 346.38 sin IGV, 62.35 de IGV y 408.73 de total', () => {
    const e = evaluar(caso());
    const r = resumenDeBorrador(e, 18);
    expect(r.lineas).toHaveLength(1);
    expect(r.lineas[0]).toMatchObject({ tipo: 'manual', descripcion: 'Volantes A5', cantidadMilesimas: 2_500_000, precioUnitarioMilesimas: 139, importeCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873 });
    expect(r.totales).toEqual({ subtotalCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873 });
    expect(r).toMatchObject({ conOpciones: false, costoCentimos: 22_515, margenPct: '35.00' });
  });
  it('un cuadro incompleto no tiene precio que rija (papel sin imposición) ni líneas', () => {
    const e = evaluar(caso({ imposicion: { ...caso().imposicion, pinzaCm: null } }));
    expect(e.rige).toBeNull();
    expect(resumenDeBorrador(e, 18)).toMatchObject({ lineas: [], totales: { subtotalCentimos: 0, totalCentimos: 0 }, costoCentimos: null, margenPct: null });
  });
  it('con la utilidad imposible en una columna el motor no calcula', () => {
    const c = caso();
    c.directo = { factores: {}, items: [], utilidadPct: { '100': '100' }, enviar: [], siguienteItem: 1 };
    expect(evaluarBorrador(c, config).ok).toBe(false);
  });
});

describe('prepararEmisionDeCuadro', () => {
  it('arma lo que se congela: configuración, cálculo, imposición y el cuadro directo', () => {
    const p = prepararEmisionDeCuadro(evaluar(caso()), 18, config);
    if (!p.ok) throw new Error(p.error.mensaje);
    expect(p.valor.hayRojo).toBe(false);
    expect(p.valor.emision).toMatchObject({ configuracion: { moneda: 'PEN' }, calculo: { precio: '346.38' }, imposicion: { pliegosMadre: '172' }, motivoMargenBajo: null });
    expect(p.valor.emision.directo?.base).toBeNull();
  });
  it('marca el rojo con un precio bajo el mínimo; el precio cero y la utilidad en 0 con costo cero no se emiten', () => {
    const rojo = prepararEmisionDeCuadro(evaluar(caso({ precioFinal: '250.00' })), 18, config);
    expect(rojo.ok && rojo.valor.hayRojo).toBe(true);
    const cero = prepararEmisionDeCuadro(evaluar(caso({ lineas: [], automaticas: { papel: null, planchas: null } })), 18, config);
    expect(!cero.ok && cero.error.mensaje).toMatch(/no tiene filas/);
  });
  it('cada cosa que falta se dice: producto, pieza, imposición', () => {
    const mensaje = (c: Cuadro) => {
      const p = prepararEmisionDeCuadro(evaluar(c), 18, config);
      return p.ok ? null : p.error.mensaje;
    };
    expect(mensaje(caso({ trabajo: { ...caso().trabajo, producto: ' ' } }))).toMatch(/nombre del producto/);
    expect(mensaje(caso({ trabajo: { ...caso().trabajo, pieza: null } }))).toMatch(/medidas de la pieza/);
    expect(mensaje(caso({ imposicion: { ...caso().imposicion, calleCm: null } }))).toMatch(/imposición: calle/);
    expect(mensaje(caso({ trabajo: { ...caso().trabajo, pieza: { anchoCm: '80', altoCm: '21' } } }))).toMatch(/imposición no se puede calcular/);
  });
  it('con base en una columna y tres enviadas salen tres líneas de menor a mayor; con precio final a mano y varias, no se emite', () => {
    const c = caso({ trabajo: { ...caso().trabajo, cantidad: '1000' } });
    c.directo = { factores: {}, items: [], utilidadPct: {}, enviar: ['1000', '5000', '100'], siguienteItem: 1 };
    const e = evaluar(c);
    expect(cantidadesEnviadas(e).map((x) => x.cantidad)).toEqual(['100', '1000', '5000']);
    const p = prepararEmisionDeCuadro(e, 18, config);
    expect(p.ok && p.valor.lineas.map((l) => l.cantidadMilesimas)).toEqual([100_000, 1_000_000, 5_000_000]);
    expect(p.ok && p.valor.conOpciones).toBe(true);
    const conPrecio = prepararEmisionDeCuadro(evaluar({ ...c, precioFinal: '300.00' }), 18, config);
    expect(!conPrecio.ok && conPrecio.error.mensaje).toMatch(/precio final fijado a mano/);
  });
  it('el IGV se calcula por línea con el porcentaje de la empresa; con 0 no hay IGV', () => {
    const e = evaluar(caso());
    expect(lineasDeCuadro(e.cuadro, cantidadesEnviadas(e), 0)[0]).toMatchObject({ igvCentimos: 0, totalCentimos: 34_638 });
  });
});

describe('versión guardada, emitida y vista', () => {
  it('evaluarVersion lee la entrada guardada; una entrada inválida falla; la emitida devuelve su foto, no se recalcula con otra configuración', () => {
    const entrada = JSON.parse(JSON.stringify(caso()));
    expect(evaluarVersion(entrada, null, false, config).ok).toBe(true);
    expect(evaluarVersion({ x: 1 }, null, false, config).ok).toBe(false);
    const p = prepararEmisionDeCuadro(evaluar(caso()), 18, config);
    if (!p.ok) throw new Error('no se pudo preparar');
    const emision = { ...p.valor.emision, emitidaEn: '2026-11-17T00:00:00.000Z', emitidaPor: 'u1' };
    const otraConfig = configuracionDeMotor({ utilidadPct: '10', utilidadBase: 'venta', umbralVerdePct: '30', umbralMinimoPct: '15', redondeoComercial: 'ninguno', igvPorcentaje: 18, condiciones: {}, mensajeWhatsapp: null });
    const congelada = evaluarVersion(entrada, JSON.parse(JSON.stringify(emision)), true, otraConfig);
    expect(congelada.ok && congelada.valor.rige?.precio).toBe('346.38');
    expect(congelada.ok && congelada.valor.emitida).toBe(true);
    const e = evaluarEmitida(cuadroSchema.parse(entrada), emision);
    expect(e.ok && e.valor.calculado.imposicion?.pliegosMadre).toBe('172');
  });
  it('la vista sin costos no trae ninguna clave «interno»; con costos trae costo, utilidad y margen en céntimos', () => {
    const e = evaluar(caso());
    const sin = armarVista(e, { ...META, verCostos: false }, config);
    expect(JSON.stringify(sin)).not.toMatch(/interno|costoUnitario|costoCentimos|margenPct|semaforo|utilidad/);
    expect(sin.comercial).toEqual({ precioCentimos: 34_638, unitarioMilesimas: 139, impuesto: { nombre: 'IGV', pct: '18.00', montoCentimos: 6_235 }, totalConImpuestoCentimos: 40_873 });
    const con = armarVista(e, { ...META, verCostos: true }, config);
    expect(con.interno?.costos).toMatchObject({ costoCentimos: 22_515, utilidadCentimos: 12_123, precioSugeridoCentimos: 34_638, margenPct: '35.00', semaforo: 'verde' });
    expect(con.lineas[0]?.interno).toEqual({ costoUnitario: '0.45', subtotalCentimos: 7_740 });
    expect(armarRecibo(e, { ...META, verCostos: false }, sin).interno).toBeUndefined();
    expect(armarRecibo(e, { ...META, verCostos: true }, con)).toMatchObject({ cantidad: '2500', pliegos: { pliegosMadre: '172', poses: '4' }, interno: { costoCentimos: 22_515 } });
  });
});

describe('referencias', () => {
  it('los tres precios en céntimos, crecientes, con su validación y sus márgenes', () => {
    const c = caso();
    const g = generarReferenciasDeCuadro(c, config);
    if (!g.ok) throw new Error(g.error.mensaje);
    expect(g.valor.p100Centimos).toBeLessThan(g.valor.p1000Centimos);
    expect(g.valor.p1000Centimos).toBeLessThan(g.valor.p5000Centimos);
    expect(g.valor.validacion.bloqueos).toEqual([]);
    expect(g.valor.margenes.map((m) => m.cantidad)).toEqual(['100', '1000', '5000']);
  });
  it('sin imposición y con filas por pliego dice qué falta', () => {
    const g = generarReferenciasDeCuadro(caso({ imposicion: { ...caso().imposicion, pinzaCm: null } }), config);
    expect(!g.ok && g.error.mensaje).toMatch(/completa el papel y la imposición/);
  });
});
