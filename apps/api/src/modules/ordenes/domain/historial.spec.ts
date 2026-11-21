import { describe, expect, it } from 'vitest';
import { centimosDeTexto, huellaDeFila, leerHistorial } from './historial.js';

const HOY = '2026-11-20';
const leer = (csv: string, desde = '2022-01-01') => {
  const r = leerHistorial(csv, { desde, hoy: HOY });
  if (!r.ok) throw new Error(r.motivo);
  return r;
};
const cab = 'fecha,cliente,descripcion,total';

describe('historial: lectura', () => {
  it('reconoce los alias del encabezado del archivo 03 y los opcionales', () => {
    const r = leer('fecha,cliente_original,grupo_sugerido,trabajo,total_contratado,cobrado_al_registrar,rubro_sugerido,fuente,extra\n2023-05-04,ANA R,Ana Ruiz,Tarjetas,80,50,imprenta,hoja,x');
    expect(r.columnasIgnoradas).toEqual(['extra']);
    expect(r.filas[0]).toMatchObject({ cliente: 'Ana Ruiz', clienteOriginal: 'ANA R', descripcion: 'Tarjetas', totalCentimos: 8000, cobradoCentimos: 5000, rubro: 'imprenta', fuente: 'hoja' });
  });
  it('falta total: error de archivo', () => {
    const r = leerHistorial('fecha,cliente,descripcion\n2023-05-04,A,B', { desde: '2022-01-01', hoy: HOY });
    expect(r).toEqual({ ok: false, motivo: 'Falta la columna «total» en el encabezado.' });
  });
  it('«80.0» es 8000 y «80,5» es 8050', () => {
    expect(centimosDeTexto('80.0')).toBe(8000);
    expect(centimosDeTexto('80,5')).toBe(8050);
    expect(centimosDeTexto('80.555')).toBeNull();
    const r = leer(`${cab}\n2023-05-04,A,B,80.0\n2023-05-05,A,C,"80,5"`);
    expect(r.filas.map((f) => f.totalCentimos)).toEqual([8000, 8050]);
  });
  it('total inválido, cero y enorme dan su motivo', () => {
    const r = leer(`${cab}\n2023-05-04,A,B,abc\n2023-05-04,A,B,0\n2023-05-04,A,B,1000000.01`);
    expect(r.errores.map((e) => e.motivo)).toEqual([
      'total: usa un monto en soles mayor que cero, por ejemplo 80 o 80.50.',
      'total: usa un monto en soles mayor que cero, por ejemplo 80 o 80.50.',
      'El total pasa de S/ 1,000,000.00: revísalo.',
    ]);
  });
  it('cobrado mayor que el total es error', () => {
    const r = leer(`${cab},cobrado\n2023-05-04,A,B,80,90`);
    expect(r.errores).toEqual([{ fila: 2, motivo: 'Lo cobrado no puede pasar del total.' }]);
  });
  it('fecha mala, futura y vacía de descripción', () => {
    const r = leer(`${cab}\n04/05/2023,A,B,80\n2026-11-21,A,B,80\n2023-05-04,A,,80`);
    expect(r.errores.map((e) => e.motivo)).toEqual(['La fecha debe ir como AAAA-MM-DD.', 'La fecha es futura.', 'Falta la descripción del trabajo.']);
  });
  it('la fecha anterior a «desde» se omite y no es error', () => {
    const r = leer(`${cab}\n2021-12-31,A,B,80\n2022-01-01,A,B,80`);
    expect(r.omitidasPorFecha).toBe(1);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(1);
  });
  it('corta la descripción a 300 y guarda el texto completo en notas', () => {
    const larga = 'x'.repeat(350);
    const f = leer(`${cab}\n2023-05-04,A,${larga},80`).filas[0]!;
    expect(f.descripcion).toBe(`${'x'.repeat(299)}…`);
    expect(f.descripcion).toHaveLength(300);
    expect(f.notas).toBe(larga);
  });
  it('«(sin nombre)» y vacío van a Clientes varios (cliente nulo)', () => {
    const r = leer(`${cab}\n2023-05-04,(sin nombre),B,80\n2023-05-04,,C,80`);
    expect(r.filas.map((f) => f.cliente)).toEqual([null, null]);
  });
});

describe('historial: huella', () => {
  const base = { fecha: '2023-05-04', cliente: 'Ana', descripcion: 'Tarjetas', totalCentimos: 8000, cobradoCentimos: null };
  it('es estable y distinta según n', () => {
    expect(huellaDeFila(base, 1)).toBe(huellaDeFila({ ...base, cliente: ' ANA ' }, 1));
    expect(huellaDeFila(base, 1)).not.toBe(huellaDeFila(base, 2));
  });
  it('dos filas idénticas en el archivo tienen huellas distintas; reimportar da las mismas', () => {
    const csv = `${cab}\n2023-05-04,Ana,Tarjetas,80\n2023-05-04,Ana,Tarjetas,80`;
    const a = leer(csv).filas.map((f) => f.huella);
    expect(new Set(a).size).toBe(2);
    expect(leer(csv).filas.map((f) => f.huella)).toEqual(a);
  });
});
