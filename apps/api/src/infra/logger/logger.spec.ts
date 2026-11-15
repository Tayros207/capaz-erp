import { describe, expect, it } from 'vitest';
import { crearLogger } from './logger.js';

function capturar() {
  const lineas: string[] = [];
  return { lineas, salida: { write: (s: string) => void lineas.push(s) } };
}

describe('crearLogger', () => {
  it('escribe JSON con el servicio y la hora', () => {
    const { lineas, salida } = capturar();
    crearLogger('production', salida).info({ requestId: 'r1' }, 'hola');
    const r = JSON.parse(lineas[0]!);
    expect(r).toMatchObject({ servicio: 'capaz-api', requestId: 'r1', msg: 'hola' });
    expect(r.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('oculta contraseñas, tokens y cookies', () => {
    const { lineas, salida } = capturar();
    crearLogger('production', salida).info(
      { usuario: { password: 'clave-123', token: 'tok-456' }, req: { headers: { cookie: 'sesion=abc' } } },
      'x',
    );
    const texto = lineas[0]!;
    for (const secreto of ['clave-123', 'tok-456', 'sesion=abc']) expect(texto).not.toContain(secreto);
    expect(texto).toContain('[oculto]');
  });

  it('en pruebas no escribe nada', () => {
    const { lineas, salida } = capturar();
    crearLogger('test', salida).error('no debe salir');
    expect(lineas).toHaveLength(0);
  });
});
