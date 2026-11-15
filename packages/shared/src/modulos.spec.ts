import { describe, expect, it } from 'vitest';
import { manifiestoDeModuloSchema, type ManifiestoDeEntrada } from './modulos.js';

const base: ManifiestoDeEntrada = {
  codigo: 'ejemplo',
  nombre: 'Ejemplo',
  descripcion: 'Módulo de ejemplo',
  version: '1.0.0',
  dependeDe: [],
  permisos: ['ejemplo:ver', 'ejemplo:editar'],
  permisosPorNivel: { completo: ['ejemplo:ver', 'ejemplo:editar'], lectura: ['ejemplo:ver'] },
  secciones: [],
  acento: 'cian',
  icono: 'cubo',
};

describe('manifiestoDeModuloSchema', () => {
  it('acepta un manifiesto válido y pone enConstruccion en falso', () => {
    const r = manifiestoDeModuloSchema.parse(base);
    expect(r.enConstruccion).toBe(false);
  });

  it.each([
    ['permiso mal escrito', { permisos: ['Ejemplo ver'], permisosPorNivel: { completo: [], lectura: [] } }],
    ['nivel con permiso no declarado', { permisosPorNivel: { completo: ['otro:ver'], lectura: [] } }],
    ['lectura que no está en completo', { permisosPorNivel: { completo: ['ejemplo:ver'], lectura: ['ejemplo:editar'] } }],
    ['depende de sí mismo', { dependeDe: ['ejemplo'] }],
    ['versión inválida', { version: '1.0' }],
    ['código con mayúsculas', { codigo: 'Ejemplo' }],
  ])('rechaza: %s', (_n, cambio) => {
    expect(manifiestoDeModuloSchema.safeParse({ ...base, ...cambio }).success).toBe(false);
  });
});
