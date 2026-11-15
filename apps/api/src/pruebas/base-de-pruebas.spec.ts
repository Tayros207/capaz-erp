import { afterEach, describe, expect, it } from 'vitest';
import { baseDePruebas, urlDePruebas } from './base-de-pruebas.js';

const original = process.env.CAPAZ_TEST_DB;
afterEach(() => {
  if (original === undefined) delete process.env.CAPAZ_TEST_DB;
  else process.env.CAPAZ_TEST_DB = original;
});

describe('baseDePruebas', () => {
  it('sin variable (o vacía) usa capaz_test', () => {
    process.env.CAPAZ_TEST_DB = '';
    expect(baseDePruebas()).toBe('capaz_test');
  });
  it('acepta capaz_test_<id>', () => {
    process.env.CAPAZ_TEST_DB = 'capaz_test_s1';
    expect(baseDePruebas()).toBe('capaz_test_s1');
  });
  it.each(['capaz', 'capaz_test_', 'capaz_test_S1', 'capaz_test_a-b', 'otra'])('rechaza «%s»', (nombre) => {
    process.env.CAPAZ_TEST_DB = nombre;
    expect(() => baseDePruebas()).toThrow(/CAPAZ_TEST_DB/);
  });
  it('apunta la URL a esa base', () => {
    process.env.CAPAZ_TEST_DB = 'capaz_test_w4';
    process.env.DATABASE_URL_APP = 'postgres://u:p@localhost:5450/capaz';
    expect(urlDePruebas('DATABASE_URL_APP')).toBe('postgres://u:p@localhost:5450/capaz_test_w4');
  });
});
