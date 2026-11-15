import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { contrato, type ContratoDeHerramienta } from '@capaz/shared';
import { RegistroInvalido, validarHerramientas } from './registro.js';
import type { HerramientaRegistrada } from './tipos.js';

const ayuda = {
  titulo: 'Probar',
  paraQueSirve: 'Prueba',
  cuandoUsarla: 'Siempre',
  campos: [],
  ejemploTecleado: 'probar',
  ejemploHablado: 'prueba',
  erroresComunes: ['Ninguno'],
  relacionadas: [],
};
const manifiestos = [
  { codigo: 'core', permisos: ['clientes:ver'] },
  { codigo: 'registro', permisos: ['registro:ver'] },
];
const entrada = z.strictObject({ id: z.string() });
const contratos: Record<string, ContratoDeHerramienta> = {
  clientes_ver: contrato(entrada, z.strictObject({})),
};

const herramienta = (
  extra: Partial<HerramientaRegistrada> = {},
): HerramientaRegistrada => ({
  nombre: 'clientes_ver',
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  idempotente: false,
  mueveDinero: false,
  ayuda,
  entrada,
  salida: z.strictObject({}),
  resumir: null,
  auditar: null,
  ejecutar: async () => ({ ok: true, datos: {}, avisos: [] }),
  ...extra,
});

const validar =
  (...h: HerramientaRegistrada[]) =>
  () =>
    validarHerramientas(h, { contratos, manifiestos });

describe('validarHerramientas', () => {
  it('acepta un registro coherente', () =>
    expect(validar(herramienta())).not.toThrow());

  it('una crítica sin «resumir» falla', () => {
    expect(validar(herramienta({ criticidad: 'critica' }))).toThrow(
      /debe definir «resumir»/,
    );
  });
  it('una no crítica con «resumir» falla', () => {
    expect(
      validar(
        herramienta({
          resumir: async () => ({
            ok: true,
            resumen: { resumen: 'x', huella: 'y' },
          }),
        }),
      ),
    ).toThrow(/no es crítica/);
  });
  it('un permiso fuera del manifiesto de su módulo falla', () => {
    expect(validar(herramienta({ permiso: 'registro:ver' }))).toThrow(
      /no está en el manifiesto de «core»/,
    );
  });
  it('un módulo inexistente falla', () => {
    expect(validar(herramienta({ modulo: 'fantasma' }))).toThrow(
      /«fantasma», que no existe/,
    );
  });
  it('un contrato sin herramienta falla, y una herramienta sin contrato también', () => {
    expect(() => validarHerramientas([], { contratos, manifiestos })).toThrow(
      /no tiene herramienta registrada/,
    );
    expect(validar(herramienta({ nombre: 'otra_cosa' }))).toThrow(
      /sin contrato|no tiene contrato/,
    );
  });
  it('una ayuda inválida o con relacionadas inexistentes falla', () => {
    expect(
      validar(herramienta({ ayuda: { ...ayuda, erroresComunes: [] } })),
    ).toThrow(/ayuda válida/);
    expect(
      validar(
        herramienta({ ayuda: { ...ayuda, relacionadas: ['no_existe'] } }),
      ),
    ).toThrow(/no existe/);
  });
  it('un argumento de contexto en la entrada falla', () => {
    const e = z.strictObject({ empresaId: z.string() });
    expect(() =>
      validarHerramientas([herramienta({ entrada: e })], {
        contratos: { clientes_ver: contrato(e, z.strictObject({})) },
        manifiestos,
      }),
    ).toThrow(/sale de la sesión/);
  });
  it('junta todos los problemas en un RegistroInvalido', () => {
    try {
      validar(herramienta({ criticidad: 'critica', modulo: 'fantasma' }))();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RegistroInvalido);
      expect((e as RegistroInvalido).problemas.length).toBeGreaterThanOrEqual(
        2,
      );
    }
  });
});
