import { describe, expect, it } from 'vitest';
import type { ManifiestoDeEntrada } from '@capaz/shared';
import { manifiestoCompras } from '../../modules/compras/compras.manifest.js';
import { manifiestoCrm } from '../../modules/crm/crm.manifest.js';
import { manifiestoInsumos } from '../../modules/insumos/insumos.manifest.js';
import { manifiestoOrdenes } from '../../modules/ordenes/ordenes.manifest.js';
import { manifiestoPersonal } from '../../modules/personal/personal.manifest.js';
import { manifiestoReportes } from '../../modules/reportes/reportes.manifest.js';
import { manifiestoWebhooks } from '../../modules/webhooks/webhooks.manifest.js';
import { manifiestoCotizador } from '../../modules/cotizador/cotizador.manifest.js';
import { manifiestoRegistro } from '../../modules/registro/registro.manifest.js';
import { CatalogoDeModulos, CatalogoInvalido, validarCatalogo } from './catalogo.js';
import { manifiestoCore } from './manifiesto-core.js';

// (Esta prueba importa manifiestos de modules/ y core/ no puede hacerlo en código de producción;
// las pruebas están exentas porque la prueba de arquitectura solo mira archivos que no son *.spec.)

const mod = (codigo: string, extra: Partial<ManifiestoDeEntrada> = {}): ManifiestoDeEntrada => ({
  codigo,
  nombre: `Módulo ${codigo}`,
  descripcion: `Módulo ${codigo}`,
  version: '1.0.0',
  dependeDe: [],
  permisos: [`${codigo}:ver`],
  permisosPorNivel: { completo: [`${codigo}:ver`], lectura: [`${codigo}:ver`] },
  secciones: [],
  familia: 'ventas',
  acento: 'cian',
  icono: codigo,
  ...extra,
});

describe('el catálogo real', () => {
  it('es válido y trae núcleo, Registro y Cotizador', () => {
    const c = new CatalogoDeModulos([manifiestoCore, manifiestoRegistro, manifiestoCotizador]);
    expect(c.manifiestos.map((m) => m.codigo)).toEqual(['core', 'registro', 'cotizador']);
    expect(c.contratables().map((m) => m.codigo)).toEqual(['registro', 'cotizador']);
    expect(c.porDefecto().map((m) => [m.codigo, m.porDefecto.pruebaDias])).toEqual([['registro', 30]]);
  });
});

describe('los nueve manifiestos', () => {
  const todos = [manifiestoCore, manifiestoRegistro, manifiestoCotizador, manifiestoCrm, manifiestoOrdenes, manifiestoCompras, manifiestoInsumos, manifiestoPersonal, manifiestoReportes, manifiestoWebhooks];
  it('forman un catálogo válido: el núcleo y nueve módulos con su familia y orden', () => {
    const c = new CatalogoDeModulos(todos);
    expect(c.contratables()).toHaveLength(9);
    const lista = c.contratables().map((m) => `${m.familia}:${m.orden}:${m.codigo}`).sort();
    expect(lista).toEqual([
      'analisis:1:reportes',
      'compras:1:compras',
      'conexiones:1:webhooks',
      'finanzas:1:registro',
      'inventario:1:insumos',
      'personal:1:personal',
      'ventas:1:crm',
      'ventas:2:ordenes',
      'ventas:3:cotizador',
    ]);
    expect(c.porCodigo('core')?.familia).toBeNull();
  });
  it('los ocho nuevos (menos webhooks) están en construcción y solo «registro» es por defecto', () => {
    const c = new CatalogoDeModulos(todos);
    expect(c.contratables().filter((m) => m.enConstruccion)).toHaveLength(8);
    expect(c.porDefecto().map((m) => m.codigo)).toEqual(['registro']);
  });
});

describe('validarCatalogo: el arranque falla con un catálogo inválido', () => {
  const core = manifiestoCore;
  const ejecutar = (...m: ManifiestoDeEntrada[]) => () => validarCatalogo([core, ...m]);

  it('código repetido', () => expect(ejecutar(mod('a'), mod('a'))).toThrow(/Código repetido/));
  it('dependencia inexistente', () => expect(ejecutar(mod('a', { dependeDe: ['x'] }))).toThrow(/no existe/));
  it('dependencia explícita de core', () => expect(ejecutar(mod('a', { dependeDe: ['core'] }))).toThrow(/implícito/));
  it('ciclo de dependencias', () => {
    expect(ejecutar(mod('a', { dependeDe: ['b'] }), mod('b', { dependeDe: ['c'] }), mod('c', { dependeDe: ['a'] }))).toThrow(/a → b → c → a|b → c → a → b|c → a → b → c/);
  });
  it('un permiso en dos módulos', () => {
    const dup = { permisos: ['a:ver'], permisosPorNivel: { completo: ['a:ver'], lectura: ['a:ver'] } };
    expect(ejecutar(mod('a'), mod('b', dup))).toThrow(/está en «a» y en «b»/);
  });
  it('falta el núcleo', () => expect(() => validarCatalogo([mod('a')])).toThrow(/Falta el módulo «core»/));
  it('un manifiesto mal formado nombra al culpable', () => expect(ejecutar(mod('a', { version: 'x' }))).toThrow(/«a»/));
  it('lanza CatalogoInvalido con todos los problemas juntos', () => {
    try {
      ejecutar(mod('a', { dependeDe: ['z'] }), mod('a'))();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CatalogoInvalido);
      expect((e as CatalogoInvalido).problemas.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('acepta dependencias válidas en cualquier orden', () => {
    expect(ejecutar(mod('b', { dependeDe: ['a'] }), mod('a'))).not.toThrow();
  });
});
