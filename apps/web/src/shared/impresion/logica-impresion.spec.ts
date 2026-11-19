import { describe, expect, it } from 'vitest';
import {
  AVISO_DOCUMENTO_INTERNO,
  alineacionPorDefecto,
  filasDeTotales,
  formatearCelda,
  lineasDelEncabezado,
  lineasDelPie,
  normalizarEmpresa,
  totalesConIgv,
  totalesDesdeTotal,
} from './logica-impresion.ts';

describe('normalizarEmpresa', () => {
  it('vacío o nulo da todo nulo', () => {
    expect(normalizarEmpresa(null).razonSocial).toBeNull();
    expect(normalizarEmpresa({ ruc: '   ', telefono: '' }).ruc).toBeNull();
  });
  it('recorta espacios y solo acepta logos data:image', () => {
    const e = normalizarEmpresa({ razonSocial: '  Taller SAC ', logoDataUrl: 'https://x/logo.png' });
    expect(e.razonSocial).toBe('Taller SAC');
    expect(e.logoDataUrl).toBeNull();
    expect(normalizarEmpresa({ logoDataUrl: 'data:image/png;base64,AAA' }).logoDataUrl).toContain('data:image/png');
  });
});

describe('orden de bloques', () => {
  it('encabezado: RUC, dirección, contacto; omite lo vacío', () => {
    const e = normalizarEmpresa({ ruc: '20123456789', direccionFiscal: 'Av. Sur 1', telefono: '999', correo: 'a@b.pe' });
    expect(lineasDelEncabezado(e)).toEqual(['RUC 20123456789', 'Av. Sur 1', 'Tel. 999 · a@b.pe']);
    expect(lineasDelEncabezado(normalizarEmpresa({ correo: 'a@b.pe' }))).toEqual(['a@b.pe']);
  });
  it('pie: texto libre y luego el aviso', () => {
    expect(lineasDelPie('Gracias')).toEqual(['Gracias', AVISO_DOCUMENTO_INTERNO]);
    expect(lineasDelPie(null, null)).toEqual([]);
    expect(lineasDelPie(' ', 'Otro aviso')).toEqual(['Otro aviso']);
  });
});

describe('celdas y totales', () => {
  it('formatea según columna', () => {
    expect(formatearCelda(123450, 'soles')).toBe('S/ 1,234.50');
    expect(formatearCelda(null)).toBe('—');
    expect(formatearCelda('Hola')).toBe('Hola');
    expect(formatearCelda(2.5, 'numero')).toBe('2.5');
    expect(alineacionPorDefecto('soles')).toBe('derecha');
    expect(alineacionPorDefecto('texto')).toBe('izquierda');
  });
  it('IGV sobre la base y desde el total', () => {
    expect(totalesConIgv(10000)).toEqual({ subtotal: 10000, igv: 1800, total: 11800 });
    const t = totalesDesdeTotal(11800);
    expect(t).toEqual({ subtotal: 10000, igv: 1800, total: 11800 });
    const r = totalesDesdeTotal(10001);
    expect(r.subtotal + r.igv).toBe(10001);
  });
  it('filas de totales', () => {
    const f = filasDeTotales(totalesConIgv(10000));
    expect(f.map((x) => x.etiqueta)).toEqual(['Subtotal', 'IGV (18%)', 'Total']);
    expect(f[2]).toMatchObject({ valor: 'S/ 118.00', destacado: true });
  });
});

describe('crédito del ERP', () => {
  it('dice quién generó el documento', async () => {
    const { TEXTO_DE_CREDITO } = await import('./logica-impresion.ts');
    expect(TEXTO_DE_CREDITO).toBe('Generado por ERP Capaz, un producto de Datayros');
  });
});
