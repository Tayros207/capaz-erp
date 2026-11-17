import { describe, expect, it } from 'vitest';
import { ModeloNulo } from './modelo-de-lenguaje.js';
import { RegistroDeInterpretes } from './registro-de-interpretes.js';
import type { InterpreteDeCaptura } from './tipos.js';
import { porcentajeSinCorregir } from '../borradores/metricas.js';

const uno = (modulo: string, instrucciones?: string): InterpreteDeCaptura => ({ modulo, instrucciones, interpretar: async () => ({ propuestas: [], faltan: [], pista: null }) });

describe('RegistroDeInterpretes', () => {
  it('agrega y busca; un duplicado lanza', () => {
    const r = new RegistroDeInterpretes();
    const a = uno('registro');
    r.agregar([a]);
    expect(r.para('registro')).toBe(a);
    expect(r.para('crm')).toBeUndefined();
    expect(() => r.agregar([uno('registro')])).toThrow(/registro/);
  });
  it('fijar reemplaza sin protestar', () => {
    const r = new RegistroDeInterpretes();
    r.agregar([uno('registro')]);
    const b = uno('registro', 'otro');
    r.fijar(b);
    expect(r.para('registro')).toBe(b);
  });
});

describe('ModeloNulo', () => {
  it('siempre devuelve null', async () => {
    expect(await new ModeloNulo().extraer()).toBeNull();
  });
});

describe('porcentajeSinCorregir', () => {
  it('0/0 es null', () => expect(porcentajeSinCorregir({ sinCorregir: 0, corregidos: 0, descartados: 0 })).toBeNull());
  it('1 de 3 es 33.3', () => expect(porcentajeSinCorregir({ sinCorregir: 1, corregidos: 1, descartados: 1 })).toBe(33.3));
  it('7 de 10 es 70', () => expect(porcentajeSinCorregir({ sinCorregir: 7, corregidos: 2, descartados: 1 })).toBe(70));
});
