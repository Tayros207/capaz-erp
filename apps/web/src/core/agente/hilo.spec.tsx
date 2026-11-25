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

const con = (elementos: ElementoDeHilo[], extra: Partial<Parameters<typeof Hilo>[0]> = {}) =>
  renderToStaticMarkup(<Hilo elementos={elementos} alResolver={() => {}} alElegirSugerencia={() => {}} alNavegar={() => {}} sugerencias={SUGERENCIAS_INICIALES} {...extra} />);

describe('Hilo · diseño dinámico', () => {
  it('con el asistente activo la pantalla vacía saluda según la hora y ofrece cuatro atajos', () => {
    const h = con([], { conAsistente: true, hora: 9 });
    expect(h).toContain('Buenos días');
    for (const t of ['Mi día', '¿Quién me debe?', 'Nuevo pedido', 'Buscar cliente', 'Entregas, cobros y pendientes']) expect(h).toContain(t);
  });

  it('mientras llega la primera palabra se ven los puntos de «pensando»', () => {
    expect(con([{ id: 'a', tipo: 'agente', texto: '', estado: 'escribiendo' }])).toContain('El asistente está pensando');
  });

  it('la respuesta se pinta con formato (negritas y listas) y sin HTML del modelo', () => {
    const h = con([{ id: 'a', tipo: 'agente', texto: 'Tienes **2 pedidos**:\n- Uno\n- Dos\n<script>x</script>', estado: 'completo' }]);
    expect(h).toContain('<strong');
    expect(h).toContain('<ul');
    expect(h).toContain('&lt;script&gt;');
    expect(h).not.toContain('<script>');
  });

  it('las herramientas seguidas se juntan en UNA fila de fichas con su estado', () => {
    const h = con([
      { id: 'h1', tipo: 'herramienta', titulo: 'Buscar clientes', estado: 'listo', nota: '0 resultados' },
      { id: 'h2', tipo: 'herramienta', titulo: 'Listar pedidos', estado: 'en_curso' },
    ]);
    expect(h.match(/aria-label="Lo que el asistente está revisando"/g)).toHaveLength(1);
    expect(h).toContain('Buscar clientes · 0 resultados');
    expect(h).toContain('Listar pedidos…');
  });

  it('lo que el asistente hizo es una tarjeta con «Abrir» cuando hay a dónde ir', () => {
    const ruta = '/m/ordenes/3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';
    const h = con([{ id: 'x', tipo: 'accion', titulo: 'Crear un pedido', ruta }]);
    expect(h).toContain('Hecho');
    expect(h).toContain('Crear un pedido');
    expect(h).toContain('aria-label="Abrir: Crear un pedido"');
    expect(con([{ id: 'y', tipo: 'accion', titulo: 'Archivar', ruta: null }])).not.toContain('Abrir');
  });

  it('una pregunta de sí o no ofrece Sí y No de un toque, pero solo si se puede enviar', () => {
    const e: ElementoDeHilo[] = [{ id: 'a', tipo: 'agente', texto: '¿Lo confirmo ahora?', estado: 'completo' }];
    expect(con(e, { alRespuestaRapida: () => {} })).toContain('>Sí<');
    expect(con(e)).not.toContain('>Sí<');
    expect(con(e, { alRespuestaRapida: () => {}, ocupado: true })).not.toContain('>Sí<');
  });

  it('las herramientas de orientación interna no se muestran (salvo que fallen), y si el trabajo terminó y son muchas se pliegan', () => {
    const interna: ElementoDeHilo = { id: 'i', tipo: 'herramienta', titulo: 'Revisar qué puedo hacer', estado: 'listo', interna: true };
    expect(con([interna])).not.toContain('Revisar qué puedo hacer');
    expect(con([{ ...interna, estado: 'fallo', nota: 'no se pudo' } as ElementoDeHilo])).toContain('Revisar qué puedo hacer');
    const listas: ElementoDeHilo[] = ['A', 'B', 'C'].map((t) => ({ id: t, tipo: 'herramienta', titulo: `Paso ${t}`, estado: 'listo' }));
    const h = con(listas);
    expect(h).toContain('<details');
    expect(h).toContain('Revisó 3 cosas');
    expect(con(listas.slice(0, 2))).not.toContain('<details');
  });
});
