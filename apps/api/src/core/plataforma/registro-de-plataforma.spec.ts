import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CONTRATOS_DE_PLATAFORMA } from '@capaz/shared';
import { AYUDAS } from './ayudas.js';
import { RegistroDePlataformaInvalido, validarHerramientasDePlataforma } from './registro-de-plataforma.js';
import { herramientasDeEmpresas } from './herramientas-de-empresas.js';
import { herramientasDeModulos } from './herramientas-de-modulos.js';
import { herramientasDePlanes, herramientasDeSolicitudes } from './herramientas-de-planes.js';
import type { HerramientaDePlataformaRegistrada } from './tipos.js';

const falsa = (nombre: string, extra: Partial<HerramientaDePlataformaRegistrada> = {}): HerramientaDePlataformaRegistrada => ({
  nombre,
  criticidad: 'lectura',
  ayuda: AYUDAS.planesListar,
  entrada: z.strictObject({}),
  salida: z.strictObject({}),
  resumir: null,
  auditar: null,
  ejecutar: async () => ({ ok: true, datos: {}, avisos: [] }),
  ...extra,
});

describe('validación del registro de plataforma', () => {
  it('detecta un contrato sin herramienta, un nombre ajeno, una crítica sin resumen y argumentos reservados', () => {
    const intento = () =>
      validarHerramientasDePlataforma([
        falsa('empresas_listar'),
        falsa('plataforma_empresas_ver', { criticidad: 'critica' }),
        falsa('plataforma_x', { entrada: z.strictObject({ empresaId: z.string() }) }),
      ]);
    expect(intento).toThrow(RegistroDePlataformaInvalido);
    try {
      intento();
    } catch (e) {
      const p = (e as RegistroDePlataformaInvalido).problemas.join('\n');
      expect(p).toContain('debe llamarse «plataforma_…»');
      expect(p).toContain('es crítica y debe definir «resumir»');
      expect(p).toContain('reservado a la sesión');
      expect(p).toContain('no tiene contrato');
      expect(p).toContain('plataforma_modulo_activar» no tiene herramienta');
    }
  });

  it('las herramientas reales cubren exactamente los contratos, y todo lo que cambia algo es crítico', () => {
    const catalogo = { porDefecto: () => [] };
    const todas = [
      ...herramientasDeEmpresas({ auth: {} as never, catalogo }),
      ...herramientasDeModulos(),
      ...herramientasDePlanes(),
      ...herramientasDeSolicitudes(),
    ];
    const nombres = todas.map((h) => h.nombre);
    // Falta solo la de contraseña, que necesita Better Auth y se prueba por HTTP.
    expect(Object.keys(CONTRATOS_DE_PLATAFORMA).filter((n) => !nombres.includes(n))).toEqual(['plataforma_restablecer_contrasena']);
    const lecturas = ['plataforma_empresas_listar', 'plataforma_empresas_ver', 'plataforma_planes_listar', 'plataforma_solicitudes_listar'];
    for (const h of todas) expect(h.criticidad, h.nombre).toBe(lecturas.includes(h.nombre) ? 'lectura' : 'critica');
  });
});
