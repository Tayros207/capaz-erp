import { describe, expect, it } from 'vitest';
import { auditoriaListar } from '../auditoria/herramientas/auditoria-listar.js';
import { empresaActualizarConfiguracion } from '../empresas/herramientas/empresa-actualizar-configuracion.js';
import { empresaVerConfiguracion } from '../empresas/herramientas/empresa-ver-configuracion.js';
import { crearModuloSolicitar } from '../empresas/herramientas/modulo-solicitar.js';
import { manifiestoCore } from '../modulos/manifiesto-core.js';
import { RegistroDeHerramientas } from './registro.js';
import type { HerramientaRegistrada } from './tipos.js';

const h = { nombre: 'clientes_ver' } as HerramientaRegistrada;
// El catálogo no interviene en `agregar`, `obtener` ni `todas`.
const nuevo = () => new RegistroDeHerramientas(undefined as never);

describe('RegistroDeHerramientas', () => {
  it('agrega, obtiene y lista', () => {
    const r = nuevo();
    r.agregar([h]);
    expect(r.obtener('clientes_ver')).toBe(h);
    expect(r.obtener('otra')).toBeUndefined();
    expect(r.todas()).toEqual([h]);
  });
  it('lanza si un nombre se repite', () => {
    const r = nuevo();
    r.agregar([h]);
    expect(() => r.agregar([h])).toThrow(/repetida/);
  });
  it('un contrato sin herramienta impide arrancar', () => {
    const r = new RegistroDeHerramientas({ manifiestos: [{ codigo: 'core', permisos: [] }] } as never);
    expect(() => r.onApplicationBootstrap()).toThrow(/empresa_ver_configuracion.*no tiene herramienta/s);
  });
  it('las herramientas del núcleo de esta fase son válidas frente a sus contratos y al manifiesto', () => {
    const r = new RegistroDeHerramientas({ manifiestos: [manifiestoCore] } as never);
    r.agregar([empresaVerConfiguracion, empresaActualizarConfiguracion, crearModuloSolicitar(undefined as never), auditoriaListar]);
    // Los contratos de otras áreas pueden faltar aquí; los de esta fase no deben dar ningún problema.
    try {
      r.onApplicationBootstrap();
    } catch (e) {
      const propios = String((e as Error).message)
        .split('\n')
        .filter((l) => /empresa_|modulo_solicitar|auditoria_listar/.test(l));
      expect(propios).toEqual([]);
    }
  });
});
