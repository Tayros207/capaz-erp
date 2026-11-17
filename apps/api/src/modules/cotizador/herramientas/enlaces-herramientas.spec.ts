import { CONTRATOS } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { manifiestoCotizador } from '../cotizador.manifest.js';
import { crearHerramientasDeEnlaces } from './enlaces-herramientas.js';

describe('herramientas del enlace público (B3)', () => {
  const herramientas = crearHerramientasDeEnlaces({ urlBase: 'https://erp.ejemplo.pe/' });

  it('son tres, con contrato, módulo cotizador y permiso cotizador:emitir', () => {
    expect(herramientas.map((h) => h.nombre)).toEqual(['enlace_generar', 'enlaces_listar', 'enlace_revocar']);
    for (const h of herramientas) {
      expect(h.nombre in CONTRATOS, h.nombre).toBe(true);
      expect(h.modulo).toBe('cotizador');
      expect(h.permiso).toBe('cotizador:emitir');
      expect(manifiestoCotizador.permisos).toContain(h.permiso);
    }
  });

  it('solo enlace_generar es crítica y trae resumir; listar es de lectura; revocar es idempotente', () => {
    const por = (n: string) => herramientas.find((h) => h.nombre === n)!;
    expect(por('enlace_generar').criticidad).toBe('critica');
    expect(por('enlace_generar').resumir).not.toBeNull();
    expect(por('enlaces_listar').criticidad).toBe('lectura');
    expect(por('enlace_revocar').criticidad).toBe('normal');
    expect(por('enlace_revocar').idempotente).toBe(true);
  });

  it('el contrato de generar fija 30 días por defecto y no admite fuera de 1 a 365', () => {
    const entrada = CONTRATOS.enlace_generar.entrada;
    const id = '0192f0c4-7b1e-7000-8000-000000000001';
    expect(entrada.parse({ id }).diasDeVigencia).toBe(30);
    expect(entrada.safeParse({ id, diasDeVigencia: 0 }).success).toBe(false);
    expect(entrada.safeParse({ id, diasDeVigencia: 366 }).success).toBe(false);
    expect(entrada.safeParse({ id, empresaId: 'x' }).success).toBe(false);
  });

  it('la auditoría no lleva el token ni el enlace', () => {
    const generar = herramientas[0]!;
    const datos = { enlace: { id: 'e1', version: 2 }, url: 'https://erp.ejemplo.pe/api/v1/c/SECRETO', codigo: 'COT-2026-0001 v2', estadoDeLaCotizacion: 'enviada' };
    const a = generar.auditar!({ id: 'c1', diasDeVigencia: 15 }, datos);
    expect(JSON.stringify(a)).not.toContain('SECRETO');
    expect(a).toMatchObject({ entidadTipo: 'enlace', entidadId: 'e1', resumen: { codigo: 'COT-2026-0001 v2', version: 2, diasDeVigencia: 15 } });
  });
});
