import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LanzadorDelAgente } from './lanzador-del-agente.tsx';
import { esAtajoDelAgente } from './logica-lanzador.ts';

const tecla = (o: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }>) => ({ key: 'j', ctrlKey: false, metaKey: false, altKey: false, ...o });

describe('LanzadorDelAgente', () => {
  it('cerrado: pinta el botón accesible de 56 px, sin imprimir', () => {
    const h = renderToStaticMarkup(<LanzadorDelAgente abierto={false} alAbrir={() => {}} />);
    expect(h).toContain('aria-label="Abrir el asistente"');
    expect(h).toContain('aria-haspopup="dialog"');
    expect(h).toContain('aria-expanded="false"');
    expect(h).toContain('size-14');
    expect(h).toContain('print:hidden');
  });

  it('queda encima de la barra inferior en móvil y abajo a la derecha en escritorio', () => {
    const h = renderToStaticMarkup(<LanzadorDelAgente abierto={false} alAbrir={() => {}} />);
    expect(h).toContain('bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)]');
    expect(h).toContain('md:bottom-6');
    expect(h).toContain('md:right-6');
  });

  it('abierto: no pinta nada', () => {
    expect(renderToStaticMarkup(<LanzadorDelAgente abierto alAbrir={() => {}} />)).toBe('');
  });
});

describe('esAtajoDelAgente', () => {
  it('acepta Ctrl+J y Cmd+J, en mayúscula o minúscula', () => {
    expect(esAtajoDelAgente(tecla({ ctrlKey: true }))).toBe(true);
    expect(esAtajoDelAgente(tecla({ metaKey: true }))).toBe(true);
    expect(esAtajoDelAgente(tecla({ ctrlKey: true, key: 'J' }))).toBe(true);
  });

  it('rechaza J sola, Ctrl+Alt+J y otras teclas', () => {
    expect(esAtajoDelAgente(tecla({}))).toBe(false);
    expect(esAtajoDelAgente(tecla({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(esAtajoDelAgente(tecla({ ctrlKey: true, key: 'k' }))).toBe(false);
  });
});
