import { describe, expect, it } from 'vitest';
import { aplicarAgregarLinea, aplicarEditarLinea, aplicarQuitarLinea } from './cuadro-comandos-lineas.js';
import { aplicarColumnasAEnviar, aplicarCostoDirecto, aplicarPrecioFinal, aplicarUtilidad } from './cuadro-comandos-directo.js';
import { aplicarImposicion, aplicarTrabajo } from './cuadro-comandos-trabajo.js';
import { configuracionDeMotor } from './cuadro-configuracion.js';
import { cuadroNuevo } from './cuadro-inicial.js';
import { validarCuadro } from './cuadro-calculo.js';
import type { Cuadro, ResultadoDeComando } from './cuadro-tipos.js';
import { configuracionEmpresaSchema } from './motor/base/empresa.js';

const config = configuracionDeMotor(null);
const nuevo = (plantilla: 'volantes' | 'en_blanco' = 'en_blanco'): Cuadro => cuadroNuevo({ plantilla }, config, [{ nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', fija: false }]);
const bien = (r: ResultadoDeComando): Cuadro => {
  if (!r.ok) throw new Error(r.mensaje);
  return r.cuadro;
};
const RECHAZO = (r: ResultadoDeComando) => (r.ok ? null : r.codigo);

describe('configuracionDeMotor', () => {
  it('sin fila usa los valores de partida y es una configuración válida del motor (PEN, es-PE, IGV 18)', () => {
    expect(configuracionEmpresaSchema.safeParse(config).success).toBe(true);
    expect(config).toMatchObject({ moneda: 'PEN', locale: 'es-PE', impuestoPct: '18', utilidadPct: '35', utilidadBase: 'venta', umbralVerdePct: '30', umbralMinimoPct: '15' });
  });
  it('con fila toma los porcentajes (de numeric a texto limpio), la base, el IGV y las condiciones; moneda y locale son fijos', () => {
    const c = configuracionDeMotor({ utilidadPct: '40.500', utilidadBase: 'costo', umbralVerdePct: '25.000', umbralMinimoPct: '10.000', redondeoComercial: '5', igvPorcentaje: 0, condiciones: { validezDias: 15, plazoEntrega: '5 días' }, mensajeWhatsapp: null });
    expect(c).toMatchObject({ utilidadPct: '40.5', utilidadBase: 'costo', umbralVerdePct: '25', umbralMinimoPct: '10', redondeoComercial: '5', impuestoPct: '0', moneda: 'PEN', locale: 'es-PE' });
    expect(c.condiciones).toEqual({ validezDias: 15, plazoEntrega: '5 días', formaPago: '', tolerancia: '', noIncluye: '' });
    expect(configuracionEmpresaSchema.safeParse(c).success).toBe(true);
  });
});

describe('cuadro nuevo', () => {
  it('la plantilla volantes trae el papel y las planchas ligados al motor; en_blanco, ninguna fila; el ítem del taller se copia', () => {
    const v = nuevo('volantes');
    expect(v.lineas.map((l) => l.descripcion)).toEqual(['Papel', 'Planchas', 'Tiraje offset', 'Diseño gráfico', 'Corte y empaque']);
    expect(v.automaticas).toEqual({ papel: 'l1', planchas: 'l2' });
    expect(nuevo().lineas).toEqual([]);
    expect(nuevo().directo?.items.map((i) => i.nombre)).toEqual(['Plastificado']);
    expect(validarCuadro(v).ok).toBe(true);
  });
});

describe('trabajo e imposición', () => {
  it('una cantidad que es columna mueve la base y lo que se envía; otra cantidad deja sin base y sin columnas; no cambia el cliente', () => {
    const c = bien(aplicarTrabajo(nuevo(), { cantidad: '5000' }));
    expect(c.directo?.enviar).toEqual(['5000']);
    const d = bien(aplicarTrabajo(c, { cantidad: '2500', producto: 'X' }));
    expect(d.directo?.enviar).toEqual([]);
    expect(d.trabajo).toMatchObject({ producto: 'X', cantidad: '2500', cliente: '' });
    expect(bien(aplicarTrabajo(d, { cantidad: '100' })).directo?.enviar).toEqual(['100']);
  });
  it('la máquina copia pinza, sangrado, calle, formato máximo y etapas; lo explícito la reemplaza; filaDePapel liga el papel', () => {
    const maquina = { formatoMaximo: { anchoCm: '36', altoCm: '52' }, pinzaCm: '2', sangradoCm: '0.3', calleCm: '0.3', etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }] };
    const c = bien(aplicarImposicion(nuevo('volantes'), { maquina, calleCm: '0.5', filaDePapel: { numero: 1 } }));
    expect(c.imposicion).toMatchObject({ pinzaCm: '2', sangradoCm: '0.3', calleCm: '0.5', formatoMaximo: { anchoCm: '36', altoCm: '52' }, etapas: maquina.etapas });
    expect(c.automaticas.papel).toBe('l1');
    expect(RECHAZO(aplicarImposicion(nuevo('volantes'), { filaDePapel: { numero: 3 } }))).toBe('argumentos_invalidos');
    expect(RECHAZO(aplicarImposicion(nuevo('volantes'), { filaDePapel: { numero: 9 } }))).toBe('no_encontrado');
    const manual = bien(aplicarImposicion(nuevo('volantes'), { filaDePapel: null }));
    expect(manual.automaticas.papel).toBeNull();
  });
});

describe('filas', () => {
  const agregar = (c: Cuadro, factor: 'material' | 'acabado', descripcion: string) => bien(aplicarAgregarLinea(c, { factor, descripcion, cantidad: '1', costoUnitario: '2' }));
  it('se agregan al final de su factor, con la unidad y la escala del factor; el tope es 60', () => {
    let c = agregar(agregar(agregar(nuevo(), 'acabado', 'B'), 'material', 'A'), 'acabado', 'C');
    expect(c.lineas.map((l) => [l.id, l.descripcion, l.unidad, l.escala])).toEqual([['l2', 'A', 'pliego', 'por_pliego'], ['l1', 'B', 'servicio', 'por_pliego'], ['l3', 'C', 'servicio', 'por_pliego']]);
    for (let i = 0; i < 57; i++) c = agregar(c, 'acabado', `F${i}`);
    expect(c.lineas).toHaveLength(60);
    expect(RECHAZO(aplicarAgregarLinea(c, { factor: 'acabado', descripcion: 'X', cantidad: '1', costoUnitario: '1' }))).toBe('conflicto');
  });
  it('de una tarifa copia sus datos y lo explícito los reemplaza', () => {
    const tarifa = { factor: 'impresion' as const, nombre: 'Tiraje', unidad: 'hora', costoUnitario: '30.0000', escalaPorDefecto: 'por_pliego' as const };
    const c = bien(aplicarAgregarLinea(nuevo(), { tarifa, cantidad: '0.8', descripcion: 'Tiraje especial' }));
    expect(c.lineas[0]).toMatchObject({ descripcion: 'Tiraje especial', unidad: 'hora', costoUnitario: '30.0000', escala: 'por_pliego', cantidad: '0.8' });
  });
  it('editar valida con el esquema de la fila, suelta la fila automática al cambiar su cantidad y reordena al cambiar el factor', () => {
    const v = nuevo('volantes');
    expect(RECHAZO(aplicarEditarLinea(v, { numero: 1 }, 'costoUnitario', '0,5'))).toBe('argumentos_invalidos');
    expect(RECHAZO(aplicarEditarLinea(v, { numero: 1 }, 'escala', 'rara'))).toBe('argumentos_invalidos');
    const r = aplicarEditarLinea(v, { texto: 'papel' }, 'cantidad', '10');
    expect(r.ok && r.avisos.map((a) => a.codigo)).toEqual(['fila_manual']);
    expect(bien(r).automaticas.papel).toBeNull();
    const f = bien(aplicarEditarLinea(nuevo('volantes'), { texto: 'planchas' }, 'factor', 'acabado'));
    expect(f.lineas.map((l) => l.factor).at(-1)).toBe('acabado');
  });
  it('un texto que coincide con varias no cambia nada y da las candidatas por número; quitar suelta lo automático', () => {
    const v = nuevo('volantes');
    const ambiguo = aplicarEditarLinea(v, { texto: 'o' }, 'cantidad', '1');
    expect(!ambiguo.ok && ambiguo.candidatas?.length).toBeGreaterThan(1);
    const q = aplicarQuitarLinea(v, { numero: 2 });
    expect(q.ok && q.linea).toMatchObject({ numero: 2, nombre: 'Planchas' });
    expect(bien(q).automaticas.planchas).toBeNull();
    expect(RECHAZO(aplicarQuitarLinea(v, { id: 'zzz' }))).toBe('no_encontrado');
  });
});

describe('cuadro directo', () => {
  it('escribe en céntimos como texto, la fila fija vale para las tres columnas y null la deja sin nada escrito', () => {
    let c = bien(aplicarCostoDirecto(nuevo(), { fijas: [{ fila: 'diseno', fija: false }], celdas: [{ fila: 'material', columna: '1000', importeCentimos: 25_050 }] }));
    expect(c.directo?.factores.material?.celdas).toEqual({ '1000': '250.50' });
    c = bien(aplicarCostoDirecto(c, { celdas: [{ fila: 'planchas', columna: '100', importeCentimos: 4_000 }] }));
    expect(c.directo?.factores.planchas?.celdas).toEqual({ '100': '40.00', '1000': '40.00', '5000': '40.00' });
    c = bien(aplicarCostoDirecto(c, { celdas: [{ fila: 'material', columna: '1000', importeCentimos: null }] }));
    expect(c.directo?.factores.material).toBeUndefined();
    expect(RECHAZO(aplicarCostoDirecto(c, { celdas: [{ fila: 'nada', columna: '100', importeCentimos: 1 }] }))).toBe('no_encontrado');
    expect(bien(aplicarCostoDirecto(c, { celdas: [{ fila: 'i1', columna: '100', importeCentimos: 1 }] })).directo?.items[0]?.celdas).toEqual({ '100': '0.01' });
  });
  it('la base siempre va entre las columnas; sin base no se elige; el precio final no vale con varias', () => {
    const c = bien(aplicarColumnasAEnviar(nuevo(), ['100', '5000']));
    expect(c.directo?.enviar).toEqual(['1000', '100', '5000']);
    expect(RECHAZO(aplicarPrecioFinal(c, 30_000, config))).toBe('conflicto');
    const uno = bien(aplicarColumnasAEnviar(c, ['1000']));
    expect(bien(aplicarPrecioFinal(uno, 30_000, config)).precioFinal).toBe('300.00');
    expect(RECHAZO(aplicarColumnasAEnviar(bien(aplicarTrabajo(uno, { cantidad: '2500' })), ['1000']))).toBe('conflicto');
    const dos = { ...uno, precioFinal: '300.00' };
    expect(RECHAZO(aplicarColumnasAEnviar(dos, ['100']))).toBe('conflicto');
    expect(bien(aplicarPrecioFinal(dos, null, config)).precioFinal).toBeNull();
  });
  it('la utilidad sobre la venta no llega a 100; por columna se pone y se quita; cambiar la base prueba la general', () => {
    expect(RECHAZO(aplicarUtilidad(nuevo(), { pct: '100' }))).toBe('argumentos_invalidos');
    expect(bien(aplicarUtilidad(nuevo(), { pct: '100', base: 'costo' })).utilidad).toEqual({ pct: '100', base: 'costo' });
    const c = bien(aplicarUtilidad(nuevo(), { pct: '20', columna: '5000' }));
    expect(c.directo?.utilidadPct).toEqual({ '5000': '20' });
    expect(bien(aplicarUtilidad(c, { pct: null, columna: '5000' })).directo?.utilidadPct).toEqual({});
    expect(RECHAZO(aplicarUtilidad(bien(aplicarUtilidad(nuevo(), { pct: '120', base: 'costo' })), { base: 'venta' }))).toBe('argumentos_invalidos');
  });
});
