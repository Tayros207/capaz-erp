import { describe, expect, it } from 'vitest';
import * as contratos from './index.js';
import { CONTRATOS, CONTRATOS_DE_PLATAFORMA, EVENTOS } from './index.js';

const AREAS = [
  'Empresa', 'Modulos', 'Auditoria', 'Miembros', 'Clientes', 'Productos', 'Sucursales', 'Borradores', 'Conexiones',
  'Automatizaciones', 'Intercambio', 'Plataforma', 'Registro', 'Crm', 'Ordenes', 'Insumos', 'Compras', 'Personal',
  'Reportes', 'Cotizador',
];

describe('contratos por área', () => {
  it('cada una de las 20 áreas exporta sus contratos y sus eventos', () => {
    const todo = contratos as Record<string, unknown>;
    for (const a of AREAS) {
      expect(todo[`contratosDe${a}`], `contratosDe${a}`).toBeTypeOf('object');
      expect(todo[`eventosDe${a}`], `eventosDe${a}`).toBeTypeOf('object');
    }
  });

  it('ningún nombre de herramienta ni de evento se repite entre áreas', () => {
    const todo = contratos as Record<string, Record<string, unknown>>;
    const vistos = new Map<string, string>();
    for (const a of AREAS) {
      for (const prefijo of ['contratosDe', 'eventosDe']) {
        for (const nombre of Object.keys(todo[`${prefijo}${a}`] ?? {})) {
          const clave = `${prefijo === 'contratosDe' ? 'h' : 'e'}:${nombre}`;
          expect(vistos.has(clave), `«${nombre}» está en ${vistos.get(clave)} y en ${a}`).toBe(false);
          vistos.set(clave, a);
        }
      }
    }
    expect(Object.keys({ ...CONTRATOS, ...CONTRATOS_DE_PLATAFORMA })).toHaveLength(Object.keys(CONTRATOS).length + Object.keys(CONTRATOS_DE_PLATAFORMA).length);
    expect(EVENTOS).toBeTypeOf('object');
  });

  it('los nombres cumplen las convenciones', () => {
    for (const n of [...Object.keys(CONTRATOS), ...Object.keys(CONTRATOS_DE_PLATAFORMA)]) expect(n).toMatch(/^[a-z][a-z0-9]*_[a-z0-9_]+$/);
    for (const n of Object.keys(EVENTOS)) expect(n).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
  });
});
