import { CONTRATOS } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS_DE_COTIZADOR } from './herramientas-de-cotizador.js';
import { manifiestoCotizador } from '../cotizador.manifest.js';

describe('herramientas del Cotizador (s1)', () => {
  const nombres = HERRAMIENTAS_DE_COTIZADOR.map((h) => h.nombre);

  it('son 11 (R15: máximo 13), cada una con contrato, módulo «cotizador» y un permiso del manifiesto', () => {
    expect(nombres).toHaveLength(11);
    expect(new Set(nombres).size).toBe(11);
    for (const h of HERRAMIENTAS_DE_COTIZADOR) {
      expect(h.nombre in CONTRATOS, h.nombre).toBe(true);
      expect(h.modulo).toBe('cotizador');
      expect(manifiestoCotizador.permisos, h.nombre).toContain(h.permiso);
    }
  });

  it('las que escriben son normales o críticas; solo lista_precio_editar es crítica y trae resumir', () => {
    const criticas = HERRAMIENTAS_DE_COTIZADOR.filter((h) => h.criticidad === 'critica');
    expect(criticas.map((h) => h.nombre)).toEqual(['lista_precio_editar']);
    expect(criticas.every((h) => h.resumir !== null)).toBe(true);
    const lectura = ['cotizador_configuracion_ver', 'listas_precio_listar', 'lista_precio_ver', 'precio_consultar', 'ajustes_cliente_listar'];
    expect(HERRAMIENTAS_DE_COTIZADOR.filter((h) => h.criticidad === 'lectura').map((h) => h.nombre).sort()).toEqual([...lectura].sort());
  });

  it('el manifiesto trae cuatro secciones sin construir y el permiso cotizador:configurar en el nivel completo', () => {
    expect(manifiestoCotizador.secciones.map((s) => [s.id, s.construida])).toEqual([['rapida', false], ['cotizaciones', false], ['precios', false], ['ajustes', false]]);
    expect(manifiestoCotizador.permisosPorNivel.completo).toContain('cotizador:configurar');
    expect(manifiestoCotizador.permisosPorNivel.lectura).toEqual(['cotizador:ver']);
  });
});
