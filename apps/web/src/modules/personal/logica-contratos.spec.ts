import { describe, expect, it } from 'vitest';
import { centimosSchema } from '@capaz/shared';
import { accionesDeVacaciones, textoDeVigencia, validarContrato, validarVacaciones, type FormularioDeContrato } from './logica-contratos.ts';

const contrato = (c: Partial<FormularioDeContrato> = {}): FormularioDeContrato => ({ colaboradorId: 'c', tipo: 'indeterminado', inicio: '2026-03-01', fin: '', remuneracion: centimosSchema.parse(150_000), jornada: '48', ...c });

describe('validarVacaciones', () => {
  it('pide colaborador y fechas, y el orden correcto', () => {
    expect(validarVacaciones({ colaboradorId: 'c', desde: '2026-07-01', hasta: '2026-07-15', motivo: '' })).toEqual({});
    expect(Object.keys(validarVacaciones({ colaboradorId: '', desde: '', hasta: '', motivo: '' })).sort()).toEqual(['colaboradorId', 'desde', 'hasta']);
    expect(validarVacaciones({ colaboradorId: 'c', desde: '2026-07-10', hasta: '2026-07-01', motivo: '' }).hasta).toMatch(/anterior/);
  });
});

describe('validarContrato', () => {
  it('un indeterminado completo es válido', () => expect(validarContrato(contrato())).toEqual({}));
  it('plazo fijo y prácticas exigen fin; el fin no puede ser anterior', () => {
    expect(validarContrato(contrato({ tipo: 'plazo_fijo' })).fin).toMatch(/necesita fecha de fin/);
    expect(validarContrato(contrato({ tipo: 'practicas', fin: '2026-02-01' })).fin).toMatch(/anterior/);
    expect(validarContrato(contrato({ tipo: 'plazo_fijo', fin: '2026-08-31' }))).toEqual({});
  });
  it('pide remuneración y una jornada entera de 1 a 84 horas', () => {
    expect(validarContrato(contrato({ remuneracion: null })).remuneracion).toBeDefined();
    for (const j of ['0', '85', '4.5', 'x']) expect(validarContrato(contrato({ jornada: j })).jornada).toBeDefined();
  });
});

describe('accionesDeVacaciones y textoDeVigencia', () => {
  it('cada estado habilita lo suyo', () => {
    expect(accionesDeVacaciones('solicitada')).toEqual({ resolver: true, anular: true });
    expect(accionesDeVacaciones('aprobada')).toEqual({ resolver: false, anular: true });
    expect(accionesDeVacaciones('rechazada')).toEqual({ resolver: false, anular: false });
    expect(accionesDeVacaciones('anulada')).toEqual({ resolver: false, anular: false });
  });
  it('la vigencia en texto', () => {
    expect(textoDeVigencia({ fin: '2026-08-31' })).toBe('hasta el 31/08/2026');
    expect(textoDeVigencia({ fin: null })).toBe('sin fecha de fin');
  });
});
