import type { ConversacionDelAgente } from '@capaz/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ListaDeConversaciones } from './lista-de-conversaciones.tsx';
import { agruparConversaciones } from './logica-historial.ts';

const conv = (titulo: string, favorita = false): ConversacionDelAgente => ({ id: `${titulo}-id`, titulo, favorita, actualizadoEn: '2026-11-24T18:00:00Z' });
const grupos = (...c: ConversacionDelAgente[]) => agruparConversaciones(c, new Date('2026-11-24T20:00:00Z'));
const nada = () => {};
const html = (o: Partial<Parameters<typeof ListaDeConversaciones>[0]> = {}) =>
  renderToStaticMarkup(
    <ListaDeConversaciones estado="listo" grupos={grupos(conv('Pedidos de Cristina'))} busqueda="" alBuscar={nada} hayMas={false} cargandoMas={false} alVerMas={nada} alReintentar={nada} activaId={null} alAbrir={nada} alFavorita={nada} alRenombrar={nada} alBorrar={nada} {...o} />,
  );

describe('ListaDeConversaciones', () => {
  it('muestra cada conversación con el título, el grupo de fecha y sus tres acciones', () => {
    const h = html();
    expect(h).toContain('Pedidos de Cristina');
    expect(h).toContain('>Hoy<');
    for (const a of ['Marcar como favorita', 'Renombrar la conversación', 'Borrar la conversación']) expect(h).toContain(`aria-label="${a}"`);
  });

  it('una favorita se marca como presionada y ofrece quitarla', () => {
    const h = html({ grupos: grupos(conv('Fija', true)) });
    expect(h).toContain('>Favoritas<');
    expect(h).toContain('aria-pressed="true"');
    expect(h).toContain('Quitar de favoritas');
  });

  it('la conversación abierta se señala', () => {
    expect(html({ activaId: 'Pedidos de Cristina-id' })).toContain('aria-current="true"');
  });

  it('cargando: muestra marcadores y avisa que está ocupado, sin lista', () => {
    const h = html({ estado: 'cargando' });
    expect(h).toContain('aria-busy="true"');
    expect(h).not.toContain('Pedidos de Cristina');
  });

  it('con error: el mensaje del servidor y un botón para reintentar', () => {
    const h = html({ estado: 'error', mensajeDeError: 'No hay conexión con el servidor.' });
    expect(h).toContain('role="alert"');
    expect(h).toContain('No hay conexión con el servidor.');
    expect(h).toContain('Reintentar');
  });

  it('sin conversaciones lo dice; con una búsqueda sin resultados dice otra cosa', () => {
    expect(html({ grupos: [] })).toContain('Aún no tienes conversaciones.');
    expect(html({ grupos: [], busqueda: 'zzz' })).toContain('Ninguna conversación coincide con la búsqueda.');
  });

  it('«Ver más» solo aparece si hay otra página', () => {
    expect(html()).not.toContain('Ver más');
    expect(html({ hayMas: true })).toContain('Ver más');
  });

  it('un título con HTML se pinta como texto', () => {
    const h = html({ grupos: grupos(conv('<img src=x onerror=alert(1)>')) });
    expect(h).not.toContain('<img');
    expect(h).toContain('&lt;img');
  });
});
