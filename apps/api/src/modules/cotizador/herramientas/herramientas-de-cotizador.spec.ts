import { CONTRATOS } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS_DE_COTIZADOR } from './herramientas-de-cotizador.js';
import { manifiestoCotizador } from '../cotizador.manifest.js';

describe('herramientas del Cotizador (s1 y s2)', () => {
  const nombres = HERRAMIENTAS_DE_COTIZADOR.map((h) => h.nombre);

  it('son 11 de s1 y 12 de s2 (R15: máximo 13 por sesión), cada una con contrato, módulo «cotizador» y un permiso del manifiesto', () => {
    expect(nombres).toHaveLength(23);
    expect(new Set(nombres).size).toBe(23);
    for (const h of HERRAMIENTAS_DE_COTIZADOR) {
      expect(h.nombre in CONTRATOS, h.nombre).toBe(true);
      expect(h.modulo).toBe('cotizador');
      expect(manifiestoCotizador.permisos, h.nombre).toContain(h.permiso);
    }
  });

  it('las que escriben son normales o críticas; lista_precio_editar, cotizacion_emitir y cotizacion_anular son críticas y traen resumir', () => {
    const criticas = HERRAMIENTAS_DE_COTIZADOR.filter((h) => h.criticidad === 'critica');
    expect(criticas.map((h) => h.nombre).sort()).toEqual(['cotizacion_anular', 'cotizacion_emitir', 'lista_precio_editar']);
    expect(criticas.every((h) => h.resumir !== null)).toBe(true);
    const lectura = ['cotizador_configuracion_ver', 'listas_precio_listar', 'lista_precio_ver', 'precio_consultar', 'ajustes_cliente_listar', 'cotizacion_ver', 'cotizaciones_listar', 'cotizador_resumen'];
    expect(HERRAMIENTAS_DE_COTIZADOR.filter((h) => h.criticidad === 'lectura').map((h) => h.nombre).sort()).toEqual([...lectura].sort());
  });

  it('los permisos de s2 son los de la ficha: emitir y anular piden cotizador:emitir; ver y listar, cotizador:ver; el resto, cotizador:editar', () => {
    const permiso = (n: string) => HERRAMIENTAS_DE_COTIZADOR.find((h) => h.nombre === n)?.permiso;
    for (const n of ['cotizacion_emitir', 'cotizacion_anular']) expect(permiso(n), n).toBe('cotizador:emitir');
    for (const n of ['cotizacion_ver', 'cotizaciones_listar', 'cotizador_resumen']) expect(permiso(n), n).toBe('cotizador:ver');
    for (const n of ['cotizacion_crear', 'cotizacion_editar', 'cotizacion_nueva_version', 'cotizacion_duplicar', 'cotizacion_marcar_enviada', 'cotizacion_aceptar', 'cotizacion_rechazar']) {
      expect(permiso(n), n).toBe('cotizador:editar');
    }
    expect(HERRAMIENTAS_DE_COTIZADOR.find((h) => h.nombre === 'cotizacion_crear')?.idempotente).toBe(true);
  });

  it('el manifiesto trae cuatro secciones sin construir y el permiso cotizador:configurar en el nivel completo', () => {
    expect(manifiestoCotizador.secciones.map((s) => [s.id, s.construida])).toEqual([['rapida', false], ['cotizaciones', false], ['precios', false], ['ajustes', false]]);
    expect(manifiestoCotizador.permisosPorNivel.completo).toContain('cotizador:configurar');
    expect(manifiestoCotizador.permisosPorNivel.lectura).toEqual(['cotizador:ver']);
  });
});
