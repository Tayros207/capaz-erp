import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hilo } from './hilo.tsx';
import { SUGERENCIAS_INICIALES, type ElementoDeHilo } from './logica-hilo.ts';

const html = (elementos: ElementoDeHilo[]) =>
  renderToStaticMarkup(<Hilo elementos={elementos} alResolver={() => {}} alElegirSugerencia={() => {}} alNavegar={() => {}} sugerencias={SUGERENCIAS_INICIALES} />);

describe('Hilo', () => {
  it('es un registro con aviso de lectura amable', () => {
    const h = html([]);
    expect(h).toContain('role="log"');
    expect(h).toContain('aria-live="polite"');
  });

  it('vacío: muestra el saludo y las tres sugerencias', () => {
    const h = html([]);
    expect(h).toContain('Dime qué quieres registrar.');
    for (const s of SUGERENCIAS_INICIALES) expect(h).toContain(s);
  });

  it('con mensajes ya no muestra las sugerencias', () => {
    expect(html([{ id: '1', tipo: 'persona', texto: 'Hola' }])).not.toContain(SUGERENCIAS_INICIALES[0]!);
  });

  it('un aviso de error lleva role="alert" y uno informativo role="status"', () => {
    expect(html([{ id: '1', tipo: 'aviso', tono: 'error', texto: 'Falló' }])).toContain('role="alert"');
    const info = html([{ id: '1', tipo: 'aviso', tono: 'info', texto: 'Ojo' }]);
    expect(info).toContain('role="status"');
    expect(info).not.toContain('role="alert"');
  });

  it('un aviso con enlace pinta el botón del enlace', () => {
    const h = html([{ id: '1', tipo: 'aviso', tono: 'info', texto: 'Mira', enlace: { texto: 'Ver precio anterior', ruta: '/precios' } }]);
    expect(h).toContain('Ver precio anterior');
  });

  it('el texto de la persona sale escapado, nunca como HTML', () => {
    const h = html([{ id: '1', tipo: 'persona', texto: '<img src=x onerror=alert(1)>' }]);
    expect(h).not.toContain('<img');
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('el texto del asistente también sale escapado', () => {
    const h = html([{ id: '1', tipo: 'agente', texto: '<script>x</script>', estado: 'completo' }]);
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });

  it('un borrador ya resuelto se pinta como una línea, no como tarjeta', () => {
    const propuesta = { id: 'b1', herramienta: 'movimiento_registrar', resumen: 'Ingreso de S/ 500', args: {}, sugerencias: [] };
    expect(html([{ id: '1', tipo: 'borrador', propuesta, resuelto: 'aprobado' }])).toContain('Ingreso de S/ 500 · Aprobado');
    expect(html([{ id: '1', tipo: 'borrador', propuesta, resuelto: 'despues' }])).toContain('Queda en la bandeja');
  });

  it('una herramienta en curso se anuncia con puntos suspensivos; terminada, con su nota corta', () => {
    expect(html([{ id: 'h', tipo: 'herramienta', titulo: 'Ver pedidos', estado: 'en_curso' }])).toContain('Ver pedidos…');
    expect(html([{ id: 'h', tipo: 'herramienta', titulo: 'Ver pedidos', estado: 'listo', nota: '12 resultados' }])).toContain('Ver pedidos · 12 resultados');
    expect(html([{ id: 'h', tipo: 'herramienta', titulo: 'Ver pedidos', estado: 'fallo', nota: 'sin permiso' }])).toContain('Ver pedidos · sin permiso');
  });

  it('el botón «Reintentar» solo sale en el aviso del turno que se puede reintentar', () => {
    const T = '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c0d';
    const elementos: ElementoDeHilo[] = [
      { id: `error-${T}`, tipo: 'aviso', tono: 'error', texto: 'Falló.' },
      { id: 'otro', tipo: 'aviso', tono: 'error', texto: 'Otro aviso.' },
    ];
    const con = renderToStaticMarkup(<Hilo elementos={elementos} alResolver={() => {}} alElegirSugerencia={() => {}} alNavegar={() => {}} sugerencias={[]} reintentable={T} alReintentar={() => {}} />);
    expect(con.match(/Reintentar/g)).toHaveLength(1);
    const sin = renderToStaticMarkup(<Hilo elementos={elementos} alResolver={() => {}} alElegirSugerencia={() => {}} alNavegar={() => {}} sugerencias={[]} reintentable={null} alReintentar={() => {}} />);
    expect(sin).not.toContain('Reintentar');
  });

  it('el saludo del hilo vacío se puede cambiar', () => {
    const h = renderToStaticMarkup(<Hilo elementos={[]} alResolver={() => {}} alElegirSugerencia={() => {}} alNavegar={() => {}} sugerencias={['¿Quién me debe?']} saludo="Pregúntame lo que necesites." />);
    expect(h).toContain('Pregúntame lo que necesites.');
    expect(h).toContain('¿Quién me debe?');
  });

  it('un mensaje interrumpido lo dice', () => {
    expect(html([{ id: '1', tipo: 'agente', texto: 'Voy a', estado: 'interrumpido' }])).toContain('La respuesta se interrumpió.');
  });
});
