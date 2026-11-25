import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AccionDelAgente, ConfiguracionDelAgente, Leccion } from '@capaz/shared';
import { ControlDelAsistente } from './control-del-asistente.tsx';
import { ListaDeAcciones } from './lista-de-acciones.tsx';
import { ListaDeLecciones } from './lista-de-lecciones.tsx';

const configuracion: ConfiguracionDelAgente = {
  modelo: null, modeloEfectivo: 'a/b', topeMensualMicrousd: null, topeEfectivoMicrousd: 5_000_000, escrituraDirecta: true, dineroDirecto: true, topePorOperacionCentimos: 100_000, internet: true, gastoDelMesMicrousd: 0,
};
const accion = (o: Partial<AccionDelAgente> = {}): AccionDelAgente => ({
  id: 'a1', creadoEn: '2026-11-24T19:05:00.000Z', usuarioId: 'u', modelo: 'x/y', conversacionId: 'c', turnoId: 't', ronda: 1, indice: 0, herramienta: 'movimiento_registrar',
  politica: 'directo', resultado: 'ok', codigo: null, args: { montoCentimos: 25_000 }, antes: null, despues: null, resumenConfirmado: null, ...o,
});
const leccion = (o: Partial<Leccion> = {}): Leccion => ({
  id: 'l1', alcance: 'persona', usuarioId: 'u', tipo: 'preferencia', clave: 'k', texto: 'Cobrar con IGV incluido.', herramienta: null, estado: 'por_revisar', origen: 'modelo',
  conversacionId: null, turnoId: null, usos: 0, ultimaVez: null, creadoEn: '2026-11-24T19:05:00.000Z', ...o,
});

describe('ControlDelAsistente', () => {
  const html = (o: Partial<Parameters<typeof ControlDelAsistente>[0]> = {}) => renderToStaticMarkup(<ControlDelAsistente configuracion={configuracion} puedeConfigurar ocupado={false} alCambiar={vi.fn()} {...o} />);

  it('muestra los tres interruptores activos y el tope actual en soles', () => {
    const h = html();
    expect(h).toContain('Puede buscar en internet');
    expect(h).toContain('Puede hacer cambios por sí solo');
    expect(h).toContain('Puede mover dinero por sí solo');
    expect(h.match(/checked=""/g)).toHaveLength(3);
    expect(h).toContain('Por encima de S/ 1,000.00 el dinero queda como borrador.');
    expect(h).toContain('value="1000"');
  });

  it('con un freno apagado el interruptor aparece sin marcar', () => {
    expect(html({ configuracion: { ...configuracion, dineroDirecto: false } }).match(/checked=""/g)).toHaveLength(2);
  });

  it('quien no administra la empresa lo ve todo bloqueado y con una nota', () => {
    const h = html({ puedeConfigurar: false });
    expect(h).toContain('Solo quien administra la empresa cambia esto.');
    expect(h.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(5);
  });
});

describe('ListaDeAcciones', () => {
  const base = { titulo: (h: string) => `Título de ${h}`, hayMas: false, alVerMas: vi.fn(), alReintentar: vi.fn() };
  it('muestra qué hizo, cómo terminó, con qué datos y con qué modelo', () => {
    const h = renderToStaticMarkup(<ListaDeAcciones estado="listo" acciones={[accion(), accion({ id: 'a2', resultado: 'rechazada', codigo: 'conflicto', args: {} })]} {...base} />);
    expect(h).toContain('Título de movimiento_registrar');
    expect(h).toContain('Hecho · Lo hizo solo');
    expect(h).toContain('No se pudo · Lo hizo solo · conflicto');
    expect(h).toContain('montoCentimos: 25000');
    expect(h).toContain('Modelo: x/y');
  });
  it('vacía, con error y con más páginas', () => {
    expect(renderToStaticMarkup(<ListaDeAcciones estado="listo" acciones={[]} {...base} />)).toContain('Todavía no hizo nada.');
    expect(renderToStaticMarkup(<ListaDeAcciones estado="error" mensajeDeError="Sin permiso" acciones={[]} {...base} />)).toContain('Sin permiso');
    expect(renderToStaticMarkup(<ListaDeAcciones estado="listo" acciones={[accion()]} {...base} hayMas />)).toContain('Ver más');
    expect(renderToStaticMarkup(<ListaDeAcciones estado="cargando" acciones={[]} {...base} />)).toContain('aria-busy="true"');
  });
});

describe('ListaDeLecciones', () => {
  const base = { puedeCompartir: true, ocupado: false, alAprobar: vi.fn(), alArchivar: vi.fn(), alReintentar: vi.fn() };
  const html = (lecciones: Leccion[], o: Partial<typeof base> = {}) => renderToStaticMarkup(<ListaDeLecciones estado="listo" lecciones={lecciones} {...base} {...o} />);

  it('una lección que propuso el modelo espera aprobación y dice de dónde salió', () => {
    const h = html([leccion()]);
    expect(h).toContain('Por revisar · La propuso el asistente · Solo tuya · usada 0 veces');
    expect(h).toContain('>Aprobar<');
    expect(h).toContain('>Archivar<');
  });
  it('una vigente se puede compartir con la empresa solo si hay permiso', () => {
    expect(html([leccion({ estado: 'vigente', origen: 'persona' })])).toContain('Compartir con la empresa');
    expect(html([leccion({ estado: 'vigente' })], { puedeCompartir: false })).not.toContain('Compartir con la empresa');
  });
  it('una archivada no ofrece acciones; vacía lo explica', () => {
    expect(html([leccion({ estado: 'archivada' })])).not.toContain('<button');
    expect(html([])).toContain('Todavía no aprendió nada');
  });
});
