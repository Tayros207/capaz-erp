import { CONTRATOS } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS_DE_COTIZADOR } from './herramientas-de-cotizador.js';
import { manifiestoCotizador } from '../cotizador.manifest.js';

describe('herramientas del Cotizador (s1, s2 y taller)', () => {
  const nombres = HERRAMIENTAS_DE_COTIZADOR.map((h) => h.nombre);

  it('son 11 de s1, 12 de s2 y el buscador del catálogo, más las 18 del taller (cot-s3), las 17 del cuadro por partes (cot-s4) 6 de cot-p3 (cambiar en bloque y restaurar) y el historial de cot-p37, cada una con contrato, módulo «cotizador» y un permiso del manifiesto', () => {
    expect(nombres).toHaveLength(66);
    expect(new Set(nombres).size).toBe(66);
    for (const h of HERRAMIENTAS_DE_COTIZADOR) {
      expect(h.nombre in CONTRATOS, h.nombre).toBe(true);
      expect(h.modulo).toBe('cotizador');
      expect(manifiestoCotizador.permisos, h.nombre).toContain(h.permiso);
    }
  });

  it('las que escriben son normales o críticas; lista_precio_editar, cotizacion_emitir y cotizacion_anular son críticas y traen resumir', () => {
    const criticas = HERRAMIENTAS_DE_COTIZADOR.filter((h) => h.criticidad === 'critica');
    expect(criticas.map((h) => h.nombre).sort()).toEqual(['cotizacion_anular', 'cotizacion_emitir', 'cuadro_guardar_referencias', 'lista_precio_editar', 'listas_precio_ajustar_en_bloque', 'tarifa_editar']);
    expect(criticas.every((h) => h.resumir !== null)).toBe(true);
    const lectura = ['cotizador_configuracion_ver', 'listas_precio_listar', 'lista_precio_ver', 'precio_consultar', 'cotizador_productos_buscar', 'ajustes_cliente_listar', 'cotizacion_ver', 'cotizaciones_listar', 'cotizador_resumen', 'formatos_pliego_listar', 'maquinas_listar', 'tarifas_listar', 'items_cuadro_listar', 'cuadro_ver', 'cuadro_calcular', 'cuadro_generar_referencias', 'lista_precio_historial'];
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

  it('el manifiesto trae seis secciones construidas y el permiso cotizador:configurar en el nivel completo', () => {
    expect(manifiestoCotizador.secciones.map((s) => [s.id, s.construida])).toEqual([['rapida', true], ['cuadro', true], ['cotizaciones', true], ['precios', true], ['ajustes', true], ['taller', true]]);
    expect(manifiestoCotizador.permisosPorNivel.completo).toContain('cotizador:configurar');
    expect(manifiestoCotizador.permisosPorNivel.lectura).toEqual(['cotizador:ver']);
  });
});

describe('herramientas del cuadro (cot-s4)', () => {
  const cuadro = HERRAMIENTAS_DE_COTIZADOR.filter((h) => h.nombre.startsWith('cuadro_'));
  const permiso = (n: string) => cuadro.find((h) => h.nombre === n)?.permiso;
  it('son 17; costos, utilidad y precio final piden cotizador:costos; guardar referencias, configurar; leer, ver; el resto, editar', () => {
    expect(cuadro).toHaveLength(17);
    for (const n of ['cuadro_fijar_costo_directo', 'cuadro_fijar_utilidad', 'cuadro_fijar_precio_final']) expect(permiso(n), n).toBe('cotizador:costos');
    expect(permiso('cuadro_guardar_referencias')).toBe('cotizador:configurar');
    for (const n of ['cuadro_ver', 'cuadro_calcular', 'cuadro_generar_referencias']) expect(permiso(n), n).toBe('cotizador:ver');
    for (const n of ['cuadro_iniciar', 'cuadro_fijar_trabajo', 'cuadro_fijar_imposicion', 'cuadro_linea_agregar', 'cuadro_linea_editar', 'cuadro_linea_quitar', 'cuadro_item_agregar', 'cuadro_item_editar', 'cuadro_item_quitar', 'cuadro_fijar_columnas_a_enviar']) expect(permiso(n), n).toBe('cotizador:editar');
  });
});

describe('herramientas del taller (cot-s3)', () => {
  const taller = HERRAMIENTAS_DE_COTIZADOR.filter((h) => /formato|maquina|tarifa|items?_cuadro|taller/.test(h.nombre));
  it('son 22 (18 de cot-s3 y 4 de restaurar): leer pide cotizador:ver y escribir cotizador:configurar; solo tarifa_editar es crítica', () => {
    expect(taller).toHaveLength(22);
    for (const h of taller) expect(h.permiso, h.nombre).toBe(h.criticidad === 'lectura' ? 'cotizador:ver' : 'cotizador:configurar');
    expect(taller.filter((h) => h.criticidad === 'critica').map((h) => h.nombre)).toEqual(['tarifa_editar']);
  });
});
