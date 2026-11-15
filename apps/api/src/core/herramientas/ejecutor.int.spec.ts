import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { exito } from '@capaz/shared';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { acceso, codigoDe, crearEntorno, type Entorno } from './pruebas-del-ejecutor.js';
import { herramientaDePrueba } from './pruebas.js';

// Ejecutor contra PostgreSQL real, con herramientas falsas. Portado de `ejecutar.test.ts` de Cotizín
// (paso normal, contexto, permisos, recibo y salida); la confirmación, la idempotencia y la
// transacción única están en `ejecutor-transaccion.int.spec.ts`.

let pool: pg.Pool;
let e: Entorno;
beforeAll(() => {
  pool = abrirPool('app');
});
afterAll(() => pool.end());
const nuevo = () => {
  e = crearEntorno(pool, ({ estado }) => [
    herramientaDePrueba({
      nombre: 'lee_registro',
      modulo: 'registro',
      criticidad: 'lectura',
      ejecutar: async () => {
        estado.ejecuciones.push('lee_registro');
        return exito({});
      },
    }),
    herramientaDePrueba({
      nombre: 'escribe_registro',
      modulo: 'registro',
      criticidad: 'normal',
      ejecutar: async () => {
        estado.ejecuciones.push('escribe_registro');
        return exito({});
      },
    }),
    herramientaDePrueba({
      nombre: 'escribe_nucleo',
      modulo: 'core',
      permiso: 'cotizacion:editar',
      criticidad: 'normal',
      ejecutar: async () => exito({}),
    }),
    herramientaDePrueba({ nombre: 'sin_resumen', criticidad: 'critica', ejecutar: async () => exito({}) }),
  ]);
};

describe('paso de una llamada normal', () => {
  it('ejecuta y devuelve los datos validados', async () => {
    nuevo();
    expect(await e.llamar('eco', { texto: '  hola  ' })).toMatchObject({ ok: true, datos: { texto: 'hola' } });
  });

  it('una herramienta desconocida se rechaza y queda en la auditoría', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('no_existe', {}))).toBe('herramienta_desconocida');
    expect(await e.auditoria()).toMatchObject([{ herramienta: 'no_existe', resultado: 'rechazada', codigo: 'herramienta_desconocida' }]);
  });

  it.each([[null], [[1, 2]], ['texto'], [7]])('argumentos que no son un objeto (%j) se rechazan', async (args) => {
    nuevo();
    expect(codigoDe(await e.llamar('eco', args))).toBe('argumentos_invalidos');
  });

  it('sin argumentos equivale a un objeto vacío (falta «texto», no «no es un objeto»)', async () => {
    nuevo();
    const r = await e.llamar('eco', undefined);
    expect(codigoDe(r)).toBe('argumentos_invalidos');
    expect(!r.ok && 'error' in r && r.error.mensaje).toContain('texto');
  });

  it('un argumento que falta o sobra se rechaza con un mensaje en español y no ejecuta', async () => {
    nuevo();
    const falta = await e.llamar('eco', {});
    expect(!falta.ok && 'error' in falta && falta.error.mensaje).toMatch(/texto/);
    const sobra = await e.llamar('eco', { texto: 'a', extra: 1 });
    expect(codigoDe(sobra)).toBe('argumentos_invalidos');
    expect(!sobra.ok && 'error' in sobra && sobra.error.mensaje).toMatch(/[Ll]lave|extra/);
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('un rechazo de la propia herramienta llega tal cual y queda como rechazada', async () => {
    nuevo();
    expect(await e.llamar('editar', { valor: 'malo' })).toEqual({ ok: false, error: { codigo: 'conflicto', mensaje: 'Ese valor no sirve.' } });
    expect((await e.auditoria())[0]).toMatchObject({ resultado: 'rechazada', codigo: 'conflicto' });
  });
});

describe('el contexto no viaja en los argumentos', () => {
  it.each(['empresaId', 'empresa_id', 'tenantId', 'tenant_id', 'usuarioId', 'usuario_id', 'permisos', 'canal', 'contexto', 'ctx'])(
    '«%s» en los argumentos se rechaza sin ejecutar nada',
    async (llave) => {
      nuevo();
      const r = await e.llamar('eco', { texto: 'hola', [llave]: 'e2' });
      expect(codigoDe(r)).toBe('argumento_prohibido');
      expect(!r.ok && 'error' in r && r.error.mensaje).toContain(llave);
      expect(e.estado.ejecuciones).toEqual([]);
      expect(await e.auditoria()).toMatchObject([{ resultado: 'rechazada', codigo: 'argumento_prohibido' }]);
    },
  );

  it('también en una crítica: queda auditado en la empresa de la sesión, no en la que se coló', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('emitir', { empresaId: 'e2' }))).toBe('argumento_prohibido');
    expect(await e.auditoria()).toMatchObject([{ resultado: 'rechazada', codigo: 'argumento_prohibido' }]);
    expect(await comoEmpresa(pool, 'e2', async (c) => (await c.query('select 1 from core.auditoria')).rowCount)).toBe(0);
  });
});

describe('permisos', () => {
  it('sin el permiso de la herramienta se rechaza y no se ejecuta', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('editar', { valor: 'x' }, { permisos: ['cotizacion:ver'] }))).toBe('sin_permiso');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('una herramienta sin permiso requerido (null) la usa cualquiera', async () => {
    nuevo();
    expect((await e.llamar('eco', { texto: 'x' }, { permisos: [] })).ok).toBe(true);
  });

  it('el permiso se comprueba antes que los argumentos y antes de pedir confirmación', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('emitir', { basura: true }, { permisos: ['cotizacion:ver'] }))).toBe('sin_permiso');
  });
});

describe('módulo: vigencia y solo lectura', () => {
  const baja = (codigo: string) => acceso(codigo, { motivo: 'baja_solo_lectura', puedeEscribir: false, nivel: 'completo' });

  it('con el módulo en baja, la escritura responde modulo_solo_lectura y la lectura funciona', async () => {
    nuevo();
    const modulos = [acceso('core'), baja('registro')];
    expect(codigoDe(await e.llamar('escribe_registro', {}, { modulos }))).toBe('modulo_solo_lectura');
    expect((await e.llamar('lee_registro', {}, { modulos })).ok).toBe(true);
    expect(e.estado.ejecuciones).toEqual(['lee_registro']);
    expect(await e.auditoria()).toMatchObject([
      { herramienta: 'escribe_registro', resultado: 'rechazada', codigo: 'modulo_solo_lectura', modulo: 'registro' },
      { herramienta: 'lee_registro', resultado: 'ok' },
    ]);
  });

  it('un módulo que la empresa no tiene (o no se asignó) no está disponible, ni para leer', async () => {
    nuevo();
    const modulos = [acceso('core'), acceso('registro', { puedeEntrar: false, puedeEscribir: false, nivel: null, motivo: 'no_contratado' })];
    expect(codigoDe(await e.llamar('lee_registro', {}, { modulos }))).toBe('modulo_no_disponible');
    expect(codigoDe(await e.llamar('escribe_registro', {}, { modulos }))).toBe('modulo_no_disponible');
    expect(codigoDe(await e.llamar('lee_registro', {}, { modulos: [acceso('core')] }))).toBe('modulo_no_disponible');
  });

  it('un nivel de solo lectura en un módulo vigente tampoco escribe', async () => {
    nuevo();
    const modulos = [acceso('core'), acceso('registro', { puedeEscribir: false, nivel: 'lectura' })];
    expect(codigoDe(await e.llamar('escribe_registro', {}, { modulos }))).toBe('modulo_solo_lectura');
  });

  it('en el núcleo escribir lo decide el permiso, no «puedeEscribir» (un member con clientes:editar escribe)', async () => {
    nuevo();
    const modulos = [acceso('core', { puedeEscribir: false, nivel: 'lectura' })];
    expect((await e.llamar('escribe_nucleo', {}, { modulos, rol: 'member', permisos: ['cotizacion:editar'] })).ok).toBe(true);
    expect(codigoDe(await e.llamar('escribe_nucleo', {}, { modulos, rol: 'member', permisos: [] }))).toBe('sin_permiso');
  });
});

describe('recibo y avisos en dos niveles', () => {
  it('con costos:ver llega todo', async () => {
    nuevo();
    expect(await e.llamar('eco', { texto: 'x' })).toMatchObject({
      recibo: { comercial: { precio: '10.00' }, interno: { costo: '6.00' } },
      avisos: [{ codigo: 'publico' }, { codigo: 'privado' }],
    });
  });

  it('sin costos:ver desaparece el nivel interno del recibo y los avisos internos', async () => {
    nuevo();
    const r = await e.llamar('eco', { texto: 'x' }, { permisos: ['cotizacion:ver'] });
    expect(r).toMatchObject({ ok: true, recibo: { comercial: { precio: '10.00' } }, avisos: [{ codigo: 'publico' }] });
    expect(JSON.stringify(r)).not.toMatch(/6\.00|margen|costo/);
  });
});

describe('salida y errores internos', () => {
  it('una salida que no cumple su esquema no sale: es un error interno', async () => {
    nuevo();
    const r = await e.llamar('salida_mala', {});
    expect(codigoDe(r)).toBe('error_interno');
    expect(JSON.stringify(r)).not.toContain('6.00');
  });

  it('una excepción no filtra detalles y queda como rechazada', async () => {
    nuevo();
    const r = await e.llamar('explota', {});
    expect(codigoDe(r)).toBe('error_interno');
    expect(JSON.stringify(r)).not.toContain('clave-secreta-123');
    expect((await e.auditoria())[0]).toMatchObject({ resultado: 'rechazada', codigo: 'error_interno' });
  });

  it('una herramienta no puede pedir confirmación por su cuenta', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('pide_sola', {}))).toBe('error_interno');
  });

  it('un secreto corto es un error de configuración: el ejecutor ni se crea', () => {
    nuevo();
    const Clase = e.ejecutor.constructor as new (...a: unknown[]) => unknown;
    expect(() => new Clase({}, {}, {}, { CONFIRMACION_SECRET: 'corto' }, {})).toThrow(/CONFIRMACION_SECRET/);
  });

  it('una crítica sin resumen (registro armado a mano) falla cerrado y no se ejecuta', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('sin_resumen', {}))).toBe('error_interno');
  });
});

describe('auditoría: cada llamada deja exactamente un evento', () => {
  it('sea cual sea el desenlace', async () => {
    nuevo();
    await e.llamar('eco', { texto: 'x' });
    await e.llamar('eco', {});
    await e.llamar('editar', { valor: 'x' }, { permisos: [] });
    await e.llamar('explota', {});
    await e.llamar('emitir', {});
    await e.llamar('no_existe', {});
    expect((await e.auditoria()).map((f) => f.resultado)).toEqual(['ok', 'rechazada', 'rechazada', 'rechazada', 'pendiente_confirmacion', 'rechazada']);
  });

  it('registra quién, por qué canal, qué herramienta y el hash de los argumentos, nunca los argumentos', async () => {
    nuevo();
    await e.llamar('eco', { texto: 'dato-privado-777' }, { canal: 'agente', usuarioId: 'u9' });
    const [fila] = await e.auditoria();
    expect(fila).toMatchObject({ usuario_id: 'u9', canal: 'agente', herramienta: 'eco', modulo: 'core', resultado: 'ok', codigo: null, request_id: 'req-de-prueba' });
    expect(fila!.hash_args).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(fila)).not.toContain('dato-privado-777');
  });

  it('la auditoría no admite update ni delete', async () => {
    nuevo();
    await e.llamar('eco', { texto: 'x' });
    await expect(comoEmpresa(pool, e.empresaId, (c) => c.query(`update core.auditoria set codigo = 'x'`))).rejects.toThrow();
    await expect(comoEmpresa(pool, e.empresaId, (c) => c.query('delete from core.auditoria'))).rejects.toThrow();
    expect(await e.auditoria()).toHaveLength(1);
  });
});
