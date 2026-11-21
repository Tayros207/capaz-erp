import { describe, expect, it } from 'vitest';
import type { ConfiguracionDeEmpresa } from '@capaz/shared';
import { cambiosDeEmpresa, conModoDeMontoMinimo, formularioDesde, modoDeMontoMinimo, montoMinimoDelFormulario, textoDeMontoMinimo, validarDatos } from './logica-datos.ts';
import { dimensionesReducidas, elegirLogo, INTENTOS, logoSeguro, validarArchivoDeLogo } from './logica-logo.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const base: ConfiguracionDeEmpresa = {
  zonaHoraria: 'America/Lima', moneda: 'PEN', locale: 'es-PE', razonSocial: 'Mi Empresa', ruc: null, direccionFiscal: null,
  telefono: null, correo: null, pieDeDocumento: null, logoDataUrl: null, montoMinimoCentimos: null, actualizadoEn: '2026-11-16T10:00:00.000Z',
};

describe('cambiosDeEmpresa', () => {
  it('sin cambios devuelve nulo (aunque haya espacios sobrantes)', () => {
    expect(cambiosDeEmpresa(base, formularioDesde(base))).toBeNull();
    expect(cambiosDeEmpresa(base, { ...formularioDesde(base), razonSocial: ' Mi Empresa ' })).toBeNull();
  });
  it('envía solo lo que cambió; vacío borra; el logo va tal cual', () => {
    const f = { ...formularioDesde(base), razonSocial: '', ruc: ' 20123456789 ', logoDataUrl: PNG, zonaHoraria: 'America/Bogota' };
    expect(cambiosDeEmpresa(base, f)).toEqual({ razonSocial: '', ruc: '20123456789', logoDataUrl: PNG, zonaHoraria: 'America/Bogota' });
    const conLogo = { ...base, logoDataUrl: PNG };
    expect(cambiosDeEmpresa(conLogo, { ...formularioDesde(conLogo), logoDataUrl: '' })).toEqual({ logoDataUrl: '' });
  });
});

describe('validarDatos', () => {
  it('RUC de 11 dígitos o vacío; largos máximos', () => {
    const f = formularioDesde(base);
    expect(validarDatos(f)).toEqual({});
    expect(validarDatos({ ...f, ruc: '123' }).ruc).toMatch(/11 dígitos/);
    expect(validarDatos({ ...f, ruc: '20123456789' })).toEqual({});
    expect(validarDatos({ ...f, pieDeDocumento: 'x'.repeat(1001) }).pieDeDocumento).toMatch(/1000/);
  });
});

describe('monto mínimo por trabajo', () => {
  const con = (v: number | null): ConfiguracionDeEmpresa => ({ ...base, montoMinimoCentimos: v });
  it('distingue por defecto (nulo), apagado (0) y personalizado', () => {
    expect([null, 0, 3000].map(modoDeMontoMinimo)).toEqual(['defecto', 'apagado', 'personalizado']);
    expect(formularioDesde(con(3000))).toMatchObject({ montoMinimoModo: 'personalizado', montoMinimoCentimos: 3000 });
    expect(formularioDesde(con(0))).toMatchObject({ montoMinimoModo: 'apagado', montoMinimoCentimos: null });
  });
  it('sin cambios no envía nada; cada modo viaja como nulo, 0 o el valor', () => {
    expect(cambiosDeEmpresa(con(3000), formularioDesde(con(3000)))).toBeNull();
    const f = formularioDesde(base);
    expect(cambiosDeEmpresa(base, conModoDeMontoMinimo(f, 'apagado'))).toEqual({ montoMinimoCentimos: 0 });
    expect(cambiosDeEmpresa(base, { ...conModoDeMontoMinimo(f, 'personalizado'), montoMinimoCentimos: 3000 })).toEqual({ montoMinimoCentimos: 3000 });
    expect(cambiosDeEmpresa(con(3000), conModoDeMontoMinimo(formularioDesde(con(3000)), 'defecto'))).toEqual({ montoMinimoCentimos: null });
    expect(montoMinimoDelFormulario(conModoDeMontoMinimo(f, 'defecto'))).toBeNull();
  });
  it('«personalizado» parte del mínimo de fábrica y exige un monto válido', () => {
    const f = conModoDeMontoMinimo(formularioDesde(base), 'personalizado');
    expect(f.montoMinimoCentimos).toBe(4000);
    expect(validarDatos(f)).toEqual({});
    expect(validarDatos({ ...f, montoMinimoCentimos: null }).montoMinimo).toMatch(/Escribe el monto/);
    expect(validarDatos({ ...f, montoMinimoCentimos: 0 }).montoMinimo).toMatch(/Apagado/);
    expect(validarDatos({ ...f, montoMinimoCentimos: 10_000_001 }).montoMinimo).toMatch(/100,000\.00/);
    expect(validarDatos({ ...f, montoMinimoCentimos: 10_000_000 })).toEqual({});
  });
  it('frase de lectura', () => {
    expect(textoDeMontoMinimo(null)).toBe('S/ 40.00 (el de siempre)');
    expect(textoDeMontoMinimo(0)).toBe('Apagado: no se avisa');
    expect(textoDeMontoMinimo(3000)).toBe('S/ 30.00');
  });
});

describe('logo', () => {
  it('valida tipo y tamaño del archivo', () => {
    expect(validarArchivoDeLogo({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validarArchivoDeLogo({ type: 'image/svg+xml', size: 1000 })).toMatch(/SVG/);
    expect(validarArchivoDeLogo({ type: 'image/png', size: 9 * 1024 * 1024 })).toMatch(/pesa demasiado/);
  });
  it('reduce a 400 px de ancho sin agrandar y sin ceros', () => {
    expect(dimensionesReducidas(1200, 600)).toEqual({ ancho: 400, alto: 200 });
    expect(dimensionesReducidas(200, 100)).toEqual({ ancho: 200, alto: 100 });
    expect(dimensionesReducidas(4000, 1)).toEqual({ ancho: 400, alto: 1 });
    expect(dimensionesReducidas(0, 0)).toEqual({ ancho: 1, alto: 1 });
  });
  it('solo muestra data URL png/jpeg/webp', () => {
    expect(logoSeguro(PNG)).toBe(PNG);
    expect(logoSeguro('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(logoSeguro('https://x.pe/a.png')).toBeNull();
    expect(logoSeguro('')).toBeNull();
  });
  it('elige el primer intento que cabe, salta formatos no soportados y falla si ninguno cabe', () => {
    const llamados: string[] = [];
    const url = elegirLogo(({ tipo, escala }) => {
      llamados.push(`${tipo}@${escala}`);
      if (tipo === 'image/webp') return 'data:image/png;base64,AAAA'; // el navegador no soporta webp
      return `data:${tipo};base64,${'A'.repeat(escala < 1 ? 10 : 500)}`;
    }, 100);
    expect(url).toBe(`data:image/png;base64,${'A'.repeat(10)}`);
    expect(llamados[0]).toBe('image/png@1');
    expect(elegirLogo(({ tipo }) => `data:${tipo};base64,${'A'.repeat(1000)}`, 100)).toBeNull();
    expect(INTENTOS.length).toBeGreaterThan(3);
  });
});
