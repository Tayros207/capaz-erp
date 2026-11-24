import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VistaDeHistorial } from './vista-de-historial.tsx';

describe('VistaDeHistorial', () => {
  const h = renderToStaticMarkup(<VistaDeHistorial alVolver={() => {}} />);

  it('muestra el estado vacío de la fase 1', () => {
    expect(h).toContain('Sin conversaciones todavía');
    expect(h).toContain('Aquí aparecerán tus conversaciones cuando el asistente esté activo.');
  });

  it('ofrece volver a la conversación', () => {
    expect(h).toContain('Volver');
  });

  it('con el asistente activo muestra la lista real que le pasa el panel, en lugar del estado vacío', () => {
    const con = renderToStaticMarkup(<VistaDeHistorial alVolver={() => {}} contenido={<p>Lista real</p>} />);
    expect(con).toContain('Lista real');
    expect(con).not.toContain('Sin conversaciones todavía');
  });

  it('es una región con nombre', () => {
    expect(h).toContain('aria-label="Historial de conversaciones"');
  });
});
