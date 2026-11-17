import { describe, expect, it } from 'vitest';
import type { ConteoDto } from '@capaz/shared';
import { argumentosDeTransferencia, avanceDeConteo, cambiosDeConteo, codigoDeConteo, validarTransferencia, type FormularioDeTransferencia } from './logica-operaciones.ts';

const art = (id: string) => ({ id, nombre: `Artículo ${id}` });
const form = (c: Partial<FormularioDeTransferencia> = {}): FormularioDeTransferencia => ({ origenId: 'a', destinoId: 'b', nota: '', lineas: [{ clave: 1, articulo: art('x'), cantidad: 1000 }], ...c });

describe('validarTransferencia', () => {
  it('una transferencia completa no tiene errores', () => expect(validarTransferencia(form())).toEqual({}));
  it('pide origen, destino distinto y líneas', () => {
    expect(validarTransferencia(form({ origenId: '' })).origenId).toBeDefined();
    expect(validarTransferencia(form({ destinoId: 'a' })).destinoId).toMatch(/distinto/);
    expect(validarTransferencia(form({ lineas: [{ clave: 1, articulo: null, cantidad: null }] })).lineas).toMatch(/al menos un artículo/);
  });
  it('rechaza líneas a medias, cantidades en cero y artículos repetidos', () => {
    expect(validarTransferencia(form({ lineas: [{ clave: 1, articulo: art('x'), cantidad: null }] })).lineas).toMatch(/cantidad/);
    expect(validarTransferencia(form({ lineas: [{ clave: 1, articulo: art('x'), cantidad: 0 }] })).lineas).toMatch(/cantidad/);
    expect(validarTransferencia(form({ lineas: [{ clave: 1, articulo: art('x'), cantidad: 5 }, { clave: 2, articulo: art('x'), cantidad: 6 }] })).lineas).toMatch(/repetirse/);
  });
  it('las líneas vacías sobrantes no estorban', () => {
    expect(validarTransferencia(form({ lineas: [{ clave: 1, articulo: art('x'), cantidad: 5 }, { clave: 2, articulo: null, cantidad: null }] }))).toEqual({});
  });
});

describe('argumentosDeTransferencia', () => {
  it('arma los argumentos sin la nota vacía ni las líneas vacías', () => {
    const a = argumentosDeTransferencia(form({ nota: '  ', lineas: [{ clave: 1, articulo: art('x'), cantidad: 5000 }, { clave: 2, articulo: null, cantidad: null }] }));
    expect(a).toEqual({ origenSucursalId: 'a', destinoSucursalId: 'b', lineas: [{ articuloId: 'x', cantidadMilesimas: 5000 }] });
    expect(argumentosDeTransferencia(form({ nota: ' Camión ' })).nota).toBe('Camión');
  });
});

describe('inventario físico', () => {
  const lineas: ConteoDto['lineas'] = [
    { articuloId: 'p', nombre: 'Papel', unidad: 'u', sistemaMilesimas: 6000, contadaMilesimas: 5000, diferenciaMilesimas: -1000, movimientoId: null },
    { articuloId: 't', nombre: 'Tinta', unidad: 'u', sistemaMilesimas: 3000, contadaMilesimas: null, diferenciaMilesimas: null, movimientoId: null },
  ];
  it('codigoDeConteo rellena el número', () => expect(codigoDeConteo({ numero: 7, anio: 2026 })).toBe('IF-0007-2026'));
  it('avance dice cuántos faltan y si se puede cerrar', () => {
    expect(avanceDeConteo({ totalLineas: 2, lineasContadas: 1 })).toEqual({ faltan: 1, puedeCerrar: true, texto: '1 de 2 contados' });
    expect(avanceDeConteo({ totalLineas: 2, lineasContadas: 0 }).puedeCerrar).toBe(false);
  });
  it('solo envía lo que cambió o lo nuevo, nunca lo vacío', () => {
    const t = new Map<string, number | null>([['p', 5000], ['t', 2500]]);
    expect(cambiosDeConteo(lineas, t)).toEqual([{ articuloId: 't', contadaMilesimas: 2500 }]);
    expect(cambiosDeConteo(lineas, new Map([['p', 4000], ['t', null]]))).toEqual([{ articuloId: 'p', contadaMilesimas: 4000 }]);
    expect(cambiosDeConteo(lineas, new Map())).toEqual([]);
  });
});
