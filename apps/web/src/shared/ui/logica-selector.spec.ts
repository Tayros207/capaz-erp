import { describe, expect, it } from 'vitest';
import { teclaDelSelector, textoDeCrear } from './logica-selector.ts';

const cerrado = { abierto: false, activo: -1, total: 3 };
const abierto = (activo: number, total = 3) => ({ abierto: true, activo, total });

describe('teclaDelSelector', () => {
  it('flecha abajo abre y resalta la primera; flecha arriba, la última', () => {
    expect(teclaDelSelector(cerrado, 'ArrowDown')).toEqual({ abierto: true, activo: 0, accion: 'ninguna' });
    expect(teclaDelSelector(cerrado, 'ArrowUp')).toEqual({ abierto: true, activo: 2, accion: 'ninguna' });
  });
  it('recorre en círculo', () => {
    expect(teclaDelSelector(abierto(2), 'ArrowDown').activo).toBe(0);
    expect(teclaDelSelector(abierto(0), 'ArrowUp').activo).toBe(2);
    expect(teclaDelSelector(abierto(-1), 'ArrowUp').activo).toBe(2);
  });
  it('sin opciones no resalta nada', () => {
    expect(teclaDelSelector(abierto(-1, 0), 'ArrowDown').activo).toBe(-1);
    expect(teclaDelSelector(abierto(-1, 0), 'Enter').accion).toBe('ninguna');
  });
  it('Inicio y Fin saltan a los extremos', () => {
    expect(teclaDelSelector(abierto(1), 'Home').activo).toBe(0);
    expect(teclaDelSelector(abierto(1), 'End').activo).toBe(2);
  });
  it('Enter elige solo con una opción resaltada', () => {
    expect(teclaDelSelector(abierto(1), 'Enter')).toEqual({ abierto: false, activo: -1, accion: 'elegir' });
    expect(teclaDelSelector(abierto(-1), 'Enter').accion).toBe('ninguna');
    expect(teclaDelSelector(cerrado, 'Enter').accion).toBe('ninguna');
  });
  it('Escape cierra solo si estaba abierto', () => {
    expect(teclaDelSelector(abierto(1), 'Escape')).toEqual({ abierto: false, activo: -1, accion: 'cerrar' });
    expect(teclaDelSelector(cerrado, 'Escape').accion).toBe('ninguna');
  });
  it('otras teclas no cambian nada', () => {
    expect(teclaDelSelector(abierto(1), 'a')).toEqual({ abierto: true, activo: 1, accion: 'ninguna' });
  });
});

describe('textoDeCrear', () => {
  it('no ofrece crear sin alCrear o sin texto', () => {
    expect(textoDeCrear(false, 'Crear cliente', 'Ana')).toBeNull();
    expect(textoDeCrear(true, 'Crear cliente', '')).toBeNull();
    expect(textoDeCrear(true, 'Crear cliente', '   ')).toBeNull();
  });
  it('arma el texto con lo escrito', () => {
    expect(textoDeCrear(true, 'Crear cliente', '  Ana ')).toBe('Crear cliente «Ana»');
  });
});
