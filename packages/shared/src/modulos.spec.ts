import { describe, expect, it } from 'vitest';
import { FAMILIAS, FAMILIAS_CLASICAS, NOMBRE_DE_FAMILIA, manifiestoDeModuloSchema, type ManifiestoDeEntrada } from './modulos.js';

const base: ManifiestoDeEntrada = {
  codigo: 'ejemplo',
  nombre: 'Ejemplo',
  descripcion: 'Módulo de ejemplo',
  version: '1.0.0',
  dependeDe: [],
  permisos: ['ejemplo:ver', 'ejemplo:editar'],
  permisosPorNivel: { completo: ['ejemplo:ver', 'ejemplo:editar'], lectura: ['ejemplo:ver'] },
  secciones: [],
  familia: 'ventas',
  acento: 'cian',
  icono: 'cubo',
};

describe('manifiestoDeModuloSchema', () => {
  it('acepta un manifiesto válido y pone enConstruccion en falso', () => {
    const r = manifiestoDeModuloSchema.parse(base);
    expect(r.enConstruccion).toBe(false);
    expect(r.orden).toBe(0);
  });

  it('el núcleo tiene familia nula', () => {
    expect(manifiestoDeModuloSchema.safeParse({ ...base, codigo: 'core', familia: null }).success).toBe(true);
  });

  it.each([
    ['permiso mal escrito', { permisos: ['Ejemplo ver'], permisosPorNivel: { completo: [], lectura: [] } }],
    ['nivel con permiso no declarado', { permisosPorNivel: { completo: ['otro:ver'], lectura: [] } }],
    ['lectura que no está en completo', { permisosPorNivel: { completo: ['ejemplo:ver'], lectura: ['ejemplo:editar'] } }],
    ['depende de sí mismo', { dependeDe: ['ejemplo'] }],
    ['versión inválida', { version: '1.0' }],
    ['código con mayúsculas', { codigo: 'Ejemplo' }],
    ['módulo sin familia', { familia: null }],
    ['familia desconocida', { familia: 'otra' }],
    ['núcleo con familia', { codigo: 'core', familia: 'ventas' }],
    ['orden negativo', { orden: -1 }],
  ])('rechaza: %s', (_n, cambio) => {
    expect(manifiestoDeModuloSchema.safeParse({ ...base, ...cambio }).success).toBe(false);
  });
});

describe('familias', () => {
  it('toda familia tiene nombre y las clásicas son un subconjunto', () => {
    for (const f of FAMILIAS) expect(NOMBRE_DE_FAMILIA[f]).toBeTruthy();
    for (const f of FAMILIAS_CLASICAS) expect(FAMILIAS).toContain(f);
    expect(NOMBRE_DE_FAMILIA.produccion).toBe('Producción');
  });
});
