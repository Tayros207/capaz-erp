import { describe, expect, it } from 'vitest';
import { cambiosDeFormulario, formularioDeDatosDesde, lineasDeHuella, validarDatos } from './datos-de-pedido.ts';

const base = { entregaEl: '2026-03-15', responsableId: 'u1', notas: 'Recoge el viernes', fecha: '2026-03-01' };

describe('cambiosDeFormulario', () => {
  it('sin cambios no hay nada que enviar', () => {
    expect(cambiosDeFormulario(base, formularioDeDatosDesde(base))).toBeNull();
    expect(cambiosDeFormulario({ ...base, entregaEl: null, notas: null, responsableId: null }, formularioDeDatosDesde({ ...base, entregaEl: null, notas: null, responsableId: null }))).toBeNull();
  });
  it('envía solo lo que cambió y el motivo recortado', () => {
    const f = { ...formularioDeDatosDesde(base), entregaEl: '2026-03-20', motivo: '  Pidió más tiempo ' };
    expect(cambiosDeFormulario(base, f)).toEqual({ entregaEl: '2026-03-20', motivo: 'Pidió más tiempo' });
  });
  it('vaciar un campo lo quita con null', () => {
    const f = { ...formularioDeDatosDesde(base), entregaEl: '', responsableId: '', notas: '  ' };
    expect(cambiosDeFormulario(base, f)).toEqual({ entregaEl: null, responsableId: null, notas: null });
  });
  it('el motivo solo no es un cambio', () => {
    expect(cambiosDeFormulario(base, { ...formularioDeDatosDesde(base), motivo: 'x' })).toBeNull();
  });
});

describe('validarDatos', () => {
  it('rechaza una entrega anterior al pedido y textos largos', () => {
    const e = validarDatos(base, { ...formularioDeDatosDesde(base), entregaEl: '2026-02-28', motivo: 'a'.repeat(301) });
    expect(e.entregaEl).toMatch(/anterior a la fecha del pedido \(01\/03\/2026\)/);
    expect(e.motivo).toMatch(/300/);
  });
  it('acepta lo correcto', () => {
    expect(validarDatos(base, formularioDeDatosDesde(base))).toEqual({});
  });
});

describe('lineasDeHuella', () => {
  it('muestra antes → después con nombres y el motivo', () => {
    const lineas = lineasDeHuella({
      cambios: [
        { campo: 'entregaEl', antes: '2026-03-15', despues: '2026-03-20' },
        { campo: 'responsableId', antes: 'u1', despues: null, antesEtiqueta: 'Ana' },
        { campo: 'notas', antes: null, despues: 'Puerta lateral' },
      ],
      motivo: 'Pidió más tiempo',
    });
    expect(lineas).toEqual(['Entrega: 15/03/2026 → 20/03/2026', 'Responsable: Ana → sin responsable', 'Notas: — → Puerta lateral', 'Motivo: Pidió más tiempo']);
  });
  it('sin detalle no hay líneas', () => {
    expect(lineasDeHuella(null)).toEqual([]);
  });
  it('un responsable sin nombre se dice con palabras', () => {
    expect(lineasDeHuella({ cambios: [{ campo: 'responsableId', antes: 'u9', despues: 'u1', despuesEtiqueta: 'Luis' }] })[0]).toBe('Responsable: alguien que ya no está en la empresa → Luis');
  });
});
