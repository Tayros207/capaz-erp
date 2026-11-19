import { describe, expect, it } from 'vitest';
import type { LineaDePedidoDto } from '@capaz/shared';
import { documentosDisponibles, enlaceDeWhatsApp, esTipoDeDocumento, filasDelDocumento, mensajeDeWhatsApp, sePuedeImprimir, telefonoParaWhatsApp, textoDeVigencia, totalesConAdelanto, totalesDelDocumento } from './documentos.ts';

const l = (extra: Partial<LineaDePedidoDto>): LineaDePedidoDto => ({ id: 'a', posicion: 1, productoId: null, descripcion: 'Polo', unidad: 'unidad', cantidadMilesimas: 50_000, precioUnitarioMilesimas: 15_000, afectoIgv: true, importeCentimos: 75_000, ...extra });

describe('estados por documento', () => {
  it('proforma: borrador y confirmado', () => {
    expect(sePuedeImprimir('proforma', 'borrador')).toBe(true);
    expect(sePuedeImprimir('proforma', 'confirmado')).toBe(true);
    expect(sePuedeImprimir('proforma', 'cancelado')).toBe(false);
  });
  it('nota y orden: confirmado o posterior', () => {
    for (const t of ['nota', 'orden-de-trabajo'] as const) {
      expect(sePuedeImprimir(t, 'borrador')).toBe(false);
      expect(sePuedeImprimir(t, 'en_proceso')).toBe(true);
      expect(sePuedeImprimir(t, 'cancelado')).toBe(false);
    }
    expect(documentosDisponibles('borrador')).toEqual(['proforma']);
    expect(esTipoDeDocumento('nota')).toBe(true);
    expect(esTipoDeDocumento('otro')).toBe(false);
  });
});

describe('vigencia', () => {
  it('suma 7 días, incluso cruzando de mes', () => {
    expect(textoDeVigencia('2026-03-01')).toBe('Válida por 7 días desde el 01/03/2026 (hasta el 08/03/2026)');
    expect(textoDeVigencia('2026-11-28')).toContain('hasta el 05/12/2026');
  });
});

describe('filas', () => {
  it('con precios', () => {
    expect(filasDelDocumento([l({})], true)).toEqual([{ n: 1, descripcion: 'Polo', cantidad: '50 unidad', precio: 'S/ 15.00', importe: 'S/ 750.00' }]);
  });
  it('sin precios no filtra ningún importe y ordena por posición', () => {
    const filas = filasDelDocumento([l({ posicion: 2, descripcion: 'B' }), l({ posicion: 1, descripcion: 'A' })], false);
    expect(filas.map((f) => f.descripcion)).toEqual(['A', 'B']);
    expect(JSON.stringify(filas)).not.toMatch(/S\/|precio|importe/);
  });
  it('totales con IGV', () => {
    const t = totalesDelDocumento({ subtotalCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800, igvPorcentaje: 18 });
    expect(t.map((f) => f.valor)).toEqual(['S/ 100.00', 'S/ 18.00', 'S/ 118.00']);
    expect(t[1]?.etiqueta).toBe('IGV (18%)');
  });
});

describe('WhatsApp', () => {
  it('limpia símbolos y agrega 51 a celulares de 9 dígitos', () => {
    expect(telefonoParaWhatsApp('999 000-111')).toBe('51999000111');
    expect(telefonoParaWhatsApp('+51 (999) 000 111')).toBe('51999000111');
    expect(telefonoParaWhatsApp('0051999000111')).toBe('51999000111');
  });
  it('rechaza vacíos y cortos', () => {
    expect(telefonoParaWhatsApp(null)).toBeNull();
    expect(telefonoParaWhatsApp('12-34')).toBeNull();
    expect(enlaceDeWhatsApp('', 'hola')).toBeNull();
  });
  it('arma el enlace con código y total', () => {
    const msg = mensajeDeWhatsApp({ codigo: 'PED-1', clienteNombre: 'Ana', totalCentimos: 11_800, estado: 'confirmado' });
    const url = enlaceDeWhatsApp('999000111', msg)!;
    expect(url.startsWith('https://wa.me/51999000111?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('PED-1');
    expect(decodeURIComponent(url)).toContain('S/ 118.00');
  });
});

describe('adelanto en el documento', () => {
  const base = [{ etiqueta: 'Total', valor: 'S/ 80.00', destacado: true }];
  it('sin adelanto cobrado el documento no cambia', () => {
    expect(totalesConAdelanto(base, null)).toEqual(base);
    expect(totalesConAdelanto(base, { abonadoCentimos: 0, saldoCentimos: 8_000 })).toEqual(base);
  });
  it('con adelanto agrega lo recibido y el saldo por pagar', () => {
    const t = totalesConAdelanto(base, { abonadoCentimos: 3_000, saldoCentimos: 5_000 });
    expect(t.slice(1).map((f) => [f.etiqueta, f.valor])).toEqual([['Adelanto recibido', 'S/ 30.00'], ['Saldo por pagar', 'S/ 50.00']]);
  });
});
