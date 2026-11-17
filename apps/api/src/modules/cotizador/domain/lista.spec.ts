import { describe, expect, it } from 'vitest';
import { CONFIGURACION_POR_DEFECTO, validarAjusteDeCliente, validarConfiguracion } from './configuracion.js';
import { codificarCursorDeLista, decodificarCursorDeLista } from './cursor.js';
import { cambiaronLosPrecios, corteParaRevisar, diaMas, estaPorRevisar, evaluarReferencias, normalizarNombre, resumenDeCambioDePrecios } from './lista.js';

const PRECIOS = { p100Centimos: 18_000, p1000Centimos: 58_000, p5000Centimos: 120_000, modoIntermedio: 'curva', precioMinimoCentimos: null } as const;

describe('normalizarNombre', () => {
  it('quita tildes, baja a minúsculas y junta espacios', () => {
    expect(normalizarNombre('  Volantes   A5  Couché ')).toBe('volantes a5 couche');
  });
});

describe('por revisar (más de 90 días)', () => {
  it('90 días exactos no están por revisar; 91 sí', () => {
    expect(estaPorRevisar('2026-08-17', '2026-11-15')).toBe(false); // 90 días
    expect(estaPorRevisar('2026-08-16', '2026-11-15')).toBe(true); // 91 días
    expect(estaPorRevisar('2026-11-15', '2026-11-15')).toBe(false);
  });
  it('corteParaRevisar es el día 90 hacia atrás', () => {
    expect(corteParaRevisar('2026-11-15')).toBe('2026-08-17');
    expect(diaMas('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('evaluarReferencias (invariantes B y A)', () => {
  it('B bloquea siempre, aunque se confirme', () => {
    expect(evaluarReferencias({ p100Centimos: 19_000, p1000Centimos: 15_000, p5000Centimos: 40_000 }, true)).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
  });
  it('A sin confirmar es conflicto con «Confirma para guardarlo igual.»; confirmado guarda a_confirmado', () => {
    const refs = { p100Centimos: 19_000, p1000Centimos: 200_000, p5000Centimos: 900_000 };
    const sin = evaluarReferencias(refs, false);
    expect(sin).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(!sin.ok && sin.mensaje.endsWith(' Confirma para guardarlo igual.')).toBe(true);
    expect(evaluarReferencias(refs, true)).toEqual({ ok: true, aConfirmado: true });
  });
  it('sin hallazgos no queda confirmado', () => {
    expect(evaluarReferencias({ p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000 }, false)).toEqual({ ok: true, aConfirmado: false });
  });
});

describe('resumen del cambio de precios', () => {
  it('lista lo que cambia con su valor anterior', () => {
    expect(resumenDeCambioDePrecios('Volantes A5', PRECIOS, { ...PRECIOS, p100Centimos: 19_000 })).toBe(
      'Cambiarás los precios de «Volantes A5»: 100 → S/ 190.00 (antes S/ 180.00). Las cotizaciones nuevas usarán estos precios.',
    );
  });
  it('modo y mínimo también; sin cambios de precio solo habla de los datos', () => {
    expect(resumenDeCambioDePrecios('X', PRECIOS, { ...PRECIOS, modoIntermedio: 'escalon', precioMinimoCentimos: 25_000 })).toContain('escalón (antes curva), mínimo S/ 250.00 (antes sin mínimo)');
    expect(resumenDeCambioDePrecios('X', PRECIOS, PRECIOS)).toBe('Cambiarás los datos de «X».');
  });
  it('cambiaronLosPrecios distingue renombrar de cambiar un precio', () => {
    expect(cambiaronLosPrecios(PRECIOS, { ...PRECIOS })).toBe(false);
    expect(cambiaronLosPrecios(PRECIOS, { ...PRECIOS, p5000Centimos: 130_000 })).toBe(true);
    expect(cambiaronLosPrecios(PRECIOS, { ...PRECIOS, precioMinimoCentimos: 1 })).toBe(true);
  });
});

describe('configuración', () => {
  const base = { utilidadPct: '35', utilidadBase: 'venta', umbralVerdePct: '30', umbralMinimoPct: '15' } as const;
  it('los valores por defecto son válidos y sin fecha', () => {
    expect(validarConfiguracion(CONFIGURACION_POR_DEFECTO)).toBeNull();
    expect(CONFIGURACION_POR_DEFECTO.actualizadoEn).toBeNull();
  });
  it('umbral mínimo menor que el verde', () => {
    expect(validarConfiguracion({ ...base, umbralMinimoPct: '30' })).toMatchObject({ codigo: 'argumentos_invalidos' });
    expect(validarConfiguracion({ ...base, umbralMinimoPct: '31' })).toMatchObject({ codigo: 'argumentos_invalidos' });
  });
  it('con base venta la utilidad es menor que 100; con base costo no hay tope', () => {
    expect(validarConfiguracion({ ...base, utilidadPct: '100' })).toMatchObject({ codigo: 'argumentos_invalidos' });
    expect(validarConfiguracion({ ...base, utilidadPct: '150', utilidadBase: 'costo' })).toBeNull();
  });
});

describe('ajuste de cliente', () => {
  it('null y 0 lo quitan; el rango es de -100 (sin incluir) a 500', () => {
    expect(validarAjusteDeCliente(null)).toEqual({ ok: true, porcentaje: null });
    expect(validarAjusteDeCliente('0')).toEqual({ ok: true, porcentaje: null });
    expect(validarAjusteDeCliente('-0.000')).toEqual({ ok: true, porcentaje: null });
    expect(validarAjusteDeCliente('-5')).toEqual({ ok: true, porcentaje: '-5' });
    expect(validarAjusteDeCliente('500')).toEqual({ ok: true, porcentaje: '500' });
    expect(validarAjusteDeCliente('-100')).toMatchObject({ ok: false });
    expect(validarAjusteDeCliente('501')).toMatchObject({ ok: false });
  });
});

describe('cursor de la lista', () => {
  it('va y vuelve, incluso con «|» en el nombre; un cursor roto es null', () => {
    const c = { nombreNormalizado: 'a|b', id: '0192f0c4-7b1e-7000-8000-000000000001' };
    expect(decodificarCursorDeLista(codificarCursorDeLista(c))).toEqual(c);
    expect(decodificarCursorDeLista('zzz')).toBeNull();
  });
});
