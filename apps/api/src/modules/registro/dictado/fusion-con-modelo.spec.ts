import { MEDIOS_DE_PAGO } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { textoDeAviso } from './avisos-del-modelo.js';
import { esquemaDelModelo, leerExtraccionDelModelo, MEDIOS_DICTABLES, type ExtraccionDelModelo } from './esquema-del-modelo.js';
import { fechaDeEntregaDicha, fechaPasadaDicha } from './fecha-dicha.js';
import { fusionarConModelo } from './fusion-con-modelo.js';
import { interpretarDictado } from './interpretar-dictado.js';

// Fusión reglas + modelo, sin base: el «modelo» es una extracción escrita a mano.

const HOY = '2026-11-25'; // miércoles
const NADA: ExtraccionDelModelo = {
  intencion: 'otro',
  tipo: null,
  montoCentimos: null,
  adelantoCentimos: null,
  tipoDeDeuda: null,
  contactoNombre: null,
  descripcion: null,
  fechaDicha: null,
  medioDePago: null,
  cuentaNombre: null,
  lineas: [],
  entregaDicha: null,
};
const PEDIDO = 'crea una orden de pedido: cliente juan perez descripcion: fabricacion de un troquel grafico valor de producto 180 soles deja adelanto 90 soles';

function fusionar(texto: string, m: Partial<ExtraccionDelModelo>, modo?: 'ingreso' | 'egreso') {
  const reglas = interpretarDictado(texto, { modo, hoy: HOY });
  return fusionarConModelo(reglas, { ...NADA, ...m }, { texto, hoy: HOY, modo });
}

describe('fusionarConModelo · movimientos', () => {
  it('«Ingreso 500 soles, cliente Juan Pérez, flyers»: el modelo coincide, nada que avisar', () => {
    const f = fusionar('Ingreso 500 soles, cliente Juan Pérez, flyers', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000, contactoNombre: 'Juan Pérez', descripcion: 'flyers' });
    expect(f.dictado).toMatchObject({ intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000, contactoNombre: 'Juan Pérez', descripcion: 'Flyers', faltan: [], pista: null });
    expect(f.avisos).toEqual([]);
  });

  it('«me pagó Rosa 80»: la descripción no es la frase entera', () => {
    const texto = 'me pagó Rosa 80';
    expect(interpretarDictado(texto, { hoy: HOY }).descripcion).toBe(texto);
    const f = fusionar(texto, { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 8000, contactoNombre: 'Rosa' });
    expect(f.dictado).toMatchObject({ intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 8000, contactoNombre: 'Rosa', descripcion: null });
  });

  it('monto distinto: quedan las reglas y se avisa', () => {
    const f = fusionar('Ingreso 500 soles, cliente Juan Pérez, flyers', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 5000 });
    expect(f.dictado.montoCentimos).toBe(50000);
    expect(f.avisos).toEqual([{ motivo: 'distinto', campo: 'el monto', reglas: { tipo: 'centimos', valor: 50000 }, modelo: { tipo: 'centimos', valor: 5000 } }]);
    expect(textoDeAviso(f.avisos[0]!)).toBe('El monto: en lo dictado se lee S/ 500.00 y el asistente entendió S/ 50.00; quedó S/ 500.00, revísalo');
  });

  it('tipo distinto: queda el de las reglas y se avisa; el chip manda sin avisar', () => {
    const f = fusionar('pagué 120 de tinta', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 12000 });
    expect(f.dictado.tipo).toBe('egreso');
    expect(f.avisos.map((a) => a.campo)).toEqual(['si entró o salió']);
    expect(fusionar('350 de cartulina', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 35000 }, 'egreso').avisos).toEqual([]);
  });

  it('las reglas no saben si entró o salió: el modelo lo completa y se vuelve a clasificar', () => {
    const texto = '350 de cartulina';
    expect(interpretarDictado(texto, { hoy: HOY }).intencion).toBe('incompleto');
    const f = fusionar(texto, { intencion: 'movimiento', tipo: 'egreso', montoCentimos: 35000, descripcion: 'cartulina' });
    expect(f.dictado).toMatchObject({ intencion: 'movimiento', tipo: 'egreso', montoCentimos: 35000, descripcion: 'Cartulina', categoriaDeCapaz: 'Compras', faltan: [], pista: null });
  });

  it('las reglas no encuentran el monto: el del modelo se usa, y si no está tal cual en el texto se avisa', () => {
    const f = fusionar('cobré a Juan Pérez lo de los flyers', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000, contactoNombre: 'Juan Pérez', descripcion: 'flyers' });
    expect(f.dictado).toMatchObject({ intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000 });
    expect(f.avisos).toEqual([{ motivo: 'no_aparece', campo: 'el monto', modelo: { tipo: 'centimos', valor: 50000 } }]);
    // En palabras sí aparece: sin aviso.
    expect(fusionar('cobré quinientos soles a Juan', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000 }).avisos).toEqual([]);
  });

  it('un nombre que no está en lo dictado no se usa', () => {
    const f = fusionar('Ingreso 500 soles, cliente Juan Pérez, flyers', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000, contactoNombre: 'Juan Pérez Gómez' });
    expect(f.dictado.contactoNombre).toBe('Juan Pérez');
  });

  it('fecha: el modelo copia la expresión y el servidor la resuelve; si choca con las reglas, quedan las reglas', () => {
    expect(fusionar('el lunes pagué 120 de tinta', { intencion: 'movimiento', tipo: 'egreso', montoCentimos: 12000, fechaDicha: 'el lunes' }).dictado.fecha).toBe('2026-11-23');
    const choque = fusionar('ayer pagué 120 de tinta', { intencion: 'movimiento', tipo: 'egreso', montoCentimos: 12000, fechaDicha: 'anteayer' });
    expect(choque.dictado.fecha).toBe('2026-11-24');
    expect(choque.avisos).toEqual([{ motivo: 'distinto', campo: 'la fecha', reglas: { tipo: 'dia', valor: '2026-11-24' }, modelo: { tipo: 'dia', valor: '2026-11-23' } }]);
    const rara = fusionar('pagué 120 de tinta', { intencion: 'movimiento', tipo: 'egreso', montoCentimos: 12000, fechaDicha: 'el día de la madre' });
    expect(rara.dictado.fecha).toBeNull();
    expect(textoDeAviso(rara.avisos[0]!)).toBe('No entendí la fecha «el día de la madre»: ponla a mano');
  });

  it('medio de pago y cuenta pasan tal cual (la cuenta la resuelve el intérprete); un texto vacío es null', () => {
    const f = fusionar('pagué 120 de tinta por yape', { intencion: 'movimiento', tipo: 'egreso', montoCentimos: 12000, medioDePago: 'yape', cuentaNombre: '  ' });
    expect(f).toMatchObject({ medioDePago: 'yape', cuentaNombre: null });
  });

  it('deuda: el adelanto del modelo la vuelve deuda con adelanto', () => {
    const f = fusionar('Cristina Neira me quedó debiendo 240', { intencion: 'deuda', montoCentimos: 24000, adelantoCentimos: 4000, contactoNombre: 'Cristina Neira' });
    expect(f.dictado).toMatchObject({ intencion: 'deuda_con_adelanto', montoCentimos: 24000, adelantoCentimos: 4000, tipoDeDeuda: 'por_cobrar' });
    expect(f.avisos.map((a) => a.motivo)).toEqual(['no_aparece']);
  });

  it('una proforma sigue fuera de alcance aunque el modelo diga otra cosa', () => {
    const f = fusionar('Hazle una proforma a Juan por 500 tarjetas a 180 soles', { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 18000 });
    expect(f.dictado.intencion).toBe('fuera_de_alcance');
  });
});

describe('fusionarConModelo · pedidos', () => {
  const troquel = { descripcion: 'Fabricación de un troquel gráfico', unidad: 'unidad' as const, cantidadMilesimas: 1000, precioUnitarioMilesimas: 180000 };

  it('el ejemplo del dueño: cliente, trabajo, valor y adelanto bien separados', () => {
    const f = fusionar(PEDIDO, { intencion: 'pedido', contactoNombre: 'Juan Pérez', adelantoCentimos: 9000, lineas: [troquel] });
    expect(f.dictado.pedido).toEqual({
      clienteNombre: 'Juan Pérez',
      lineas: [{ ...troquel, forma: 'entero', duda: null }],
      adelantoCentimos: 9000,
      entregaEl: null,
    });
    expect(f.avisos).toEqual([]);
  });

  it('precio distinto en la misma línea: queda el de las reglas y se avisa', () => {
    const f = fusionar(PEDIDO, { intencion: 'pedido', contactoNombre: 'Juan Pérez', adelantoCentimos: 9000, lineas: [{ ...troquel, precioUnitarioMilesimas: 90000 }] });
    expect(f.dictado.pedido!.lineas[0]!.precioUnitarioMilesimas).toBe(180000);
    expect(textoDeAviso(f.avisos[0]!)).toBe('El precio de «Fabricación de un troquel gráfico»: en lo dictado se lee S/ 180.00 y el asistente entendió S/ 90.00; quedó S/ 180.00, revísalo');
  });

  it('otro número de trabajos: el modelo solo gana si da exactamente el mismo dinero', () => {
    const texto = 'pedido para Rosa 500 tarjetas a 0.365 y 1 millar de volantes a 240';
    const juntas = [{ descripcion: 'tarjetas y volantes', unidad: 'unidad' as const, cantidadMilesimas: 1000, precioUnitarioMilesimas: 422500 }];
    const f = fusionar(texto, { intencion: 'pedido', contactoNombre: 'Rosa', lineas: juntas });
    expect(f.dictado.pedido!.lineas).toHaveLength(1);
    const otra = fusionar(texto, { intencion: 'pedido', contactoNombre: 'Rosa', lineas: [{ ...juntas[0]!, precioUnitarioMilesimas: 400000 }] });
    expect(otra.dictado.pedido!.lineas.map((l) => l.descripcion)).toEqual(['tarjetas', 'volantes']);
    expect(otra.avisos.map((a) => a.campo)).toContain('los trabajos');
  });

  it('un pedido que las reglas no reconocen pero el modelo sí, con la entrega resuelta aquí', () => {
    const texto = 'Juan Pérez me encargó un banner de 90 para el viernes';
    expect(interpretarDictado(texto, { hoy: HOY }).intencion).not.toBe('pedido');
    const f = fusionar('Juan Pérez me encargó un banner', {
      intencion: 'pedido',
      contactoNombre: 'Juan Pérez',
      lineas: [{ descripcion: 'banner', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: null }],
      entregaDicha: 'el viernes',
    });
    expect(f.dictado).toMatchObject({ intencion: 'pedido', faltan: [] });
    expect(f.dictado.pedido).toMatchObject({ clienteNombre: 'Juan Pérez', entregaEl: '2026-11-27', lineas: [{ descripcion: 'banner', precioUnitarioMilesimas: null, duda: 'sin_precio' }] });
  });

  it('con el chip de egreso nunca es pedido', () => {
    const f = fusionar('banner 90', { intencion: 'pedido', lineas: [{ descripcion: 'banner', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 90000 }] }, 'egreso');
    expect(f.dictado.intencion).not.toBe('pedido');
  });
});

describe('esquema y fechas dichas', () => {
  it('los medios de pago son los de movimiento_registrar', () => {
    expect([...MEDIOS_DICTABLES]).toEqual([...MEDIOS_DE_PAGO]);
  });

  it('el esquema rechaza ids, decimales y campos de más', () => {
    expect(leerExtraccionDelModelo({ ...NADA, contactoId: 'x' })).toBeNull();
    expect(leerExtraccionDelModelo({ ...NADA, montoCentimos: 80.5 })).toBeNull();
    expect(leerExtraccionDelModelo(null)).toBeNull();
    expect(esquemaDelModelo.safeParse(NADA).success).toBe(true);
  });

  it('fechas pasadas (hoy miércoles 2026-11-25)', () => {
    const casos: Array<[string, string | null]> = [
      ['ayer', '2026-11-24'],
      ['anteayer', '2026-11-23'],
      ['hoy', HOY],
      ['hace 3 días', '2026-11-22'],
      ['hace una semana', '2026-11-18'],
      ['el lunes', '2026-11-23'],
      ['el miércoles', '2026-11-18'],
      ['el 15', '2026-11-15'],
      ['el 28', '2026-10-28'],
      ['15 de octubre', '2026-10-15'],
      ['15 de diciembre', '2025-12-15'],
      ['20/11', '2026-11-20'],
      ['2026-11-20', '2026-11-20'],
      ['2026-12-20', null],
      ['31 de febrero', null],
      ['algún día', null],
    ];
    for (const [expresion, esperado] of casos) expect([expresion, fechaPasadaDicha(expresion, HOY)]).toEqual([expresion, esperado]);
  });

  it('fechas de entrega', () => {
    expect(fechaDeEntregaDicha('el viernes', HOY)).toBe('2026-11-27');
    expect(fechaDeEntregaDicha('mañana', HOY)).toBe('2026-11-26');
    expect(fechaDeEntregaDicha('en 3 días', HOY)).toBe('2026-11-28');
    expect(fechaDeEntregaDicha('15 de diciembre', HOY)).toBe('2026-12-15');
    expect(fechaDeEntregaDicha('cuando pueda', HOY)).toBeNull();
  });
});
