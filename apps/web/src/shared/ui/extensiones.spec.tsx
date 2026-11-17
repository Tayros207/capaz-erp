import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { Extensiones, extensionesDe, registrarExtension, vaciarExtensiones } from './extensiones.tsx';

const Hola = ({ nombre }: Record<string, unknown>) => <p>Hola {String(nombre)}</p>;

describe('puntos de extensión', () => {
  afterEach(vaciarExtensiones);

  it('sin piezas registradas no dibuja nada', () => {
    expect(renderToStaticMarkup(<Extensiones punto="ficha-cliente" nombre="Ana" />)).toBe('');
    expect(extensionesDe('ficha-cliente')).toEqual([]);
  });

  it('dibuja las piezas registradas con las props del punto y no duplica un registro repetido', () => {
    registrarExtension('ficha-cliente', Hola);
    registrarExtension('ficha-cliente', Hola);
    expect(extensionesDe('ficha-cliente')).toHaveLength(1);
    expect(renderToStaticMarkup(<Extensiones punto="ficha-cliente" nombre="Ana" />)).toBe('<p>Hola Ana</p>');
    expect(renderToStaticMarkup(<Extensiones punto="ficha-producto" nombre="Ana" />)).toBe('');
  });
});
