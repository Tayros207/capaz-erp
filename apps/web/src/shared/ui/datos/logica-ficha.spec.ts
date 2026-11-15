import { describe, expect, it } from 'vitest';
import { FICHA_INICIAL, descartarPideConfirmar, reducirFicha, type AccionDeFicha } from './logica-ficha.ts';

const correr = (...acciones: AccionDeFicha[]) => acciones.reduce(reducirFicha, FICHA_INICIAL);

describe('estado de Ficha', () => {
  it('empieza en lectura y pasa a edición', () => {
    expect(FICHA_INICIAL.modo).toBe('lectura');
    expect(correr('editar').modo).toBe('edicion');
  });
  it('ignora cambios en lectura', () => {
    expect(correr('cambio').sucio).toBe(false);
  });
  it('marca sucio al cambiar y limpia al guardar con éxito', () => {
    expect(correr('editar', 'cambio').sucio).toBe(true);
    expect(correr('editar', 'cambio', 'guardar')).toEqual({ modo: 'edicion', sucio: true, guardando: true });
    expect(correr('editar', 'cambio', 'guardar', 'guardado')).toEqual(FICHA_INICIAL);
  });
  it('un fallo conserva la edición y lo escrito', () => {
    expect(correr('editar', 'cambio', 'guardar', 'fallo')).toEqual({ modo: 'edicion', sucio: true, guardando: false });
  });
  it('no descarta mientras guarda', () => {
    expect(correr('editar', 'guardar', 'descartar').guardando).toBe(true);
  });
  it('descartar vuelve a lectura', () => {
    expect(correr('editar', 'cambio', 'descartar')).toEqual(FICHA_INICIAL);
  });
  it('pide confirmar solo con cambios', () => {
    expect(descartarPideConfirmar(correr('editar'))).toBe(false);
    expect(descartarPideConfirmar(correr('editar', 'cambio'))).toBe(true);
    expect(descartarPideConfirmar(FICHA_INICIAL)).toBe(false);
  });
});
