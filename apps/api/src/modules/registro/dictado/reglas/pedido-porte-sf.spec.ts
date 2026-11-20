// Las 41 frases de las pruebas de SF (dictado-orden.test.ts), con la salida nueva (líneas en milésimas, adelanto en céntimos).
import { describe, expect, test } from 'vitest';
import type { LineaDictada } from './pedido-lineas.js';
import { interpretarPedidoDictado } from './pedido.js';

const HOY = '2026-09-03';
const L = (descripcion: string, unidad: LineaDictada['unidad'], c: number, p: number, forma: LineaDictada['forma'], duda: LineaDictada['duda'] = null): LineaDictada => ({
  descripcion, unidad, cantidadMilesimas: c, precioUnitarioMilesimas: p, forma, duda,
});
/** Una línea «entera»: 1 unidad, el valor del trabajo. */
const E = (descripcion: string, p: number): LineaDictada => L(descripcion, 'unidad', 1000, p, 'entero');

type Caso = [string, string | null, LineaDictada[], (number | null)?, (string | null)?];
const casos: Caso[] = [
  ['Orden para Imprenta Mateo, 01 troquel forma, 45 soles', 'Imprenta Mateo', [E('01 troquel forma', 45000)]],
  ['Orden para Juan, millar de volantes, 240 soles', 'Juan', [E('millar de volantes', 240000)]],
  ['Orden Pepito Grillo, 1 millar de troquel forma 150 soles y 500 tarjetas 90 soles', 'Pepito Grillo', [E('1 millar de troquel forma', 150000), E('500 tarjetas', 90000)]],
  ['Orden para Cristina, 500 tarjetas a 0.36 cada una', 'Cristina', [L('tarjetas', 'unidad', 500000, 360, 'unitario')]],
  ['Orden para Cristina, tarjetas, 240 soles, adelanto 100', 'Cristina', [E('tarjetas', 240000)], 10000],
  ['Orden para Juan, volantes 240 soles, a cuenta 50', 'Juan', [E('volantes', 240000)], 5000],
  ['Orden para Manuel, tarjetas de presentación, 120 soles, para el viernes', 'Manuel', [E('tarjetas de presentación', 120000)], null, '2026-09-04'],
  ['Orden para Cristina, millar de volantes 240 soles y 100 tarjetas 60 soles, adelanto 100, para mañana', 'Cristina', [E('millar de volantes', 240000), E('100 tarjetas', 60000)], 10000, '2026-09-04'],
  ['Orden para Juan, volantes couche 150g, 240 soles', 'Juan', [E('volantes couche 150g', 240000)]],
  ['Orden para Juan, urgente, volantes 240 soles', 'Juan', [E('urgente, volantes', 240000)]],
  ['Orden, cliente Cristina, trabajo a realizar millar de volantes, valor del trabajo 240 soles', 'Cristina', [E('millar de volantes', 240000)]],
  ['Orden cliente Cristina trabajo millar de volantes valor 240 a cuenta 100', 'Cristina', [E('trabajo millar de volantes', 240000)], 10000],
  ['Orden para Juan, adelanto 50, volantes 200 soles', 'Juan', [E('volantes', 200000)], 5000],
  ['Orden para Cristina, millar de volantes 240', 'Cristina', [E('millar de volantes', 240000)]],
  ['Orden para Juan, trabajo de imprenta 300 soles', 'Juan', [E('trabajo de imprenta', 300000)]],
  ['orden de 240 soles de un millar de tarjetas del cliente juanito y adelanto 20 soles', 'Juanito', [E('millar de tarjetas', 240000)], 2000],
  ['Orden para Rosa, 90 soles de un banner', 'Rosa', [E('banner', 90000)]],
  ['Orden para Rosa, banner 90 soles', 'Rosa', [E('banner', 90000)]],
  ['Orden', null, []],
  // Límite conocido: la coma no separa trabajos.
  ['Orden para Juan, volantes 240 soles, tarjetas 90 soles', 'Juan', [E('volantes 240 soles, tarjetas', 90000)]],
  ['Orden para Juan, volantes 240 soles y tarjetas 90 soles', 'Juan', [E('volantes', 240000), E('tarjetas', 90000)]],
  ['Orden para Rosa, banner 90,50', 'Rosa', [E('banner', 90500)]],
  ['orden para Cristina millar de volantes 240 soles adelanto 100 para el viernes', 'Cristina', [E('millar de volantes', 240000)], 10000, '2026-09-04'],
  ['orden para Rosa volantes 350', 'Rosa', [E('volantes', 350000)]],
  ['orden nueva de Pacheco banner de 2 metros 90 soles', 'Pacheco', [E('banner de 2 metros', 90000)]],
  ['orden de Juan un millar de volantes a 240', 'Juan', [L('volantes', 'millar', 1000, 240000, 'unitario')]],
  ['nueva orden cliente Juan Pérez 1000 volantes 450 soles', 'Juan Pérez', [E('1000 volantes', 450000)]],
  ['sabes qué hazme una orden para Rosa volantes 350 me adelantó 100', 'Rosa', [E('volantes', 350000)], 10000],
  ['orden para Juan tarjetas 240 me adelantó 100', 'Juan', [E('tarjetas', 240000)], 10000],
  ['orden para Juan tarjetas 240 con adelanto de 100', 'Juan', [E('tarjetas', 240000)], 10000],
  ['orden para Juan tarjetas 240 y anticipó 50', 'Juan', [E('tarjetas', 240000)], 5000],
  ['anótame una orden para Cristina Neira de tarjetas por 240 soles', 'Cristina Neira', [E('tarjetas', 240000)]],
  ['Orden Juan Pérez, 2 millares de volantes, 480, deja 200', 'Juan Pérez', [E('2 millares de volantes', 480000)], 20000],
  ['Orden Rosa, volantes 350, me dejó 150', 'Rosa', [E('volantes', 350000)], 15000],
  ['Orden Cristina Neira, millar de volantes, doscientos cuarenta soles', 'Cristina Neira', [E('millar de volantes', 240000)]],
  ['Orden Rosa me encargó mil volantes en 350, me dejó 150', 'Rosa', [E('mil volantes', 350000)], 15000],
  ['Orden Mendoza, afiches A3, 200 soles, para el 15', 'Mendoza', [E('afiches A3', 200000)], null, '2026-09-15'],
  ['crea una nueva orden para Cristina de un millar de volantes 240 soles', 'Cristina', [E('millar de volantes', 240000)]],
  ['Orden Mateo, un 1 mll de troquel 45 soles', 'Mateo', [E('1 mll de troquel', 45000)]],
  ['registra una orden de Rosa de 500 tarjetas 180 soles', 'Rosa', [E('500 tarjetas', 180000)]],
  ['crea una orden para Juan de volantes 300 soles', 'Juan', [E('volantes', 300000)]],
];

describe('porte de las pruebas de SF', () => {
  test.each(casos)('%s', (frase, cliente, lineas, adelanto = null, entrega = null) => {
    expect(interpretarPedidoDictado(frase, HOY)).toEqual({ clienteNombre: cliente, lineas, adelantoCentimos: adelanto, entregaEl: entrega });
  });

  test('da igual con comas o sin ellas', () => {
    const conComas = interpretarPedidoDictado('Orden para Cristina, millar de volantes 240 soles, adelanto 100, para el viernes', HOY);
    const sinComas = interpretarPedidoDictado('orden para Cristina millar de volantes 240 soles adelanto 100 para el viernes', HOY);
    expect(sinComas).toEqual(conComas);
  });
});
