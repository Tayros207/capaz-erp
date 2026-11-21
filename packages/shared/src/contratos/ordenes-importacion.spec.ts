import { describe, expect, it } from 'vitest';
import { CONTRATOS } from './index.js';
import { CORTE_DE_HISTORIAL_POR_DEFECTO, importarHistorialSchema, SERIE_DE_HISTORIAL } from './ordenes-importacion.js';

describe('contrato del importador del historial', () => {
  it('pone el corte y la casilla por defecto', () => {
    const r = importarHistorialSchema.parse({ contenido: 'a' });
    expect(r).toEqual({ contenido: 'a', desde: CORTE_DE_HISTORIAL_POR_DEFECTO, crearClientesFaltantes: false });
  });
  it('rechaza archivo vacío, fecha mal escrita, separador raro y campos de más', () => {
    expect(importarHistorialSchema.safeParse({ contenido: '' }).success).toBe(false);
    expect(importarHistorialSchema.safeParse({ contenido: 'a', desde: '01/01/2022' }).success).toBe(false);
    expect(importarHistorialSchema.safeParse({ contenido: 'a', separador: '|' }).success).toBe(false);
    expect(importarHistorialSchema.safeParse({ contenido: 'a', otro: 1 }).success).toBe(false);
  });
  it('están en el catálogo de contratos y la serie es HIST', () => {
    expect(Object.keys(CONTRATOS)).toEqual(expect.arrayContaining(['pedidos_importar_historial', 'pedidos_importar_historial_previsualizar']));
    expect(SERIE_DE_HISTORIAL).toBe('HIST');
  });
});
