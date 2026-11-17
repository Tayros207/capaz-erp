import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../herramientas/http-de-pruebas.js';
import { codigoDe, confirmando, datosDe, eventosDe } from '../../../modules/registro/herramientas/pruebas-de-registro.js';

// Fusión de clientes repetidos por HTTP real: detección de parecidos y reasignación de todo lo que apuntaba al repetido.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion; // member de A: núcleo en lectura
let ajeno: Sesion; // owner de B
let A: string;
let destino: string;
let origen: string;
let deudaId: string;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Empresa A de fusión');
  await crearEmpresa(ajeno, 'Empresa B de fusión');
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  destino = (await datosDe(dueno, 'clientes_crear', { nombre: 'Imprenta Sol SAC', documentoTipo: 'ruc', documentoNumero: '20123456789', tipo: 'cliente' })).id;
  origen = (await datosDe(dueno, 'clientes_crear', { nombre: 'Imprenta Sol S.A.C.', telefono: '987654321', correo: 'ventas@sol.pe', tipo: 'proveedor' })).id;
  await datosDe(dueno, 'clientes_crear', { nombre: 'Papelera Andina' });
  deudaId = (await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: origen, concepto: 'Volantes', totalCentimos: 10_000 })).id;
  await datosDe(dueno, 'deuda_abonar', { id: deudaId, montoCentimos: 2_000 });
  await datosDe(dueno, 'clientes_contacto_guardar', { clienteId: origen, nombre: 'Ana Rojas', esPrincipal: true });
  await datosDe(dueno, 'clientes_contacto_guardar', { clienteId: destino, nombre: 'Luis Paz', esPrincipal: true });
  await datosDe(dueno, 'clientes_direccion_guardar', { clienteId: origen, direccion: 'Av. Sol 1', esPrincipal: true });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('clientes_similares', () => {
  it('encuentra la pareja repetida y no empareja nombres distintos', async () => {
    const { items } = await datosDe(dueno, 'clientes_similares', {});
    expect(items).toHaveLength(1);
    expect([items[0].a.id, items[0].b.id].sort()).toEqual([destino, origen].sort());
    expect(items[0].similitud).toBeGreaterThanOrEqual(0.55);
  });

  it('un umbral más alto deja afuera lo menos parecido; el lector y la otra empresa solo ven lo suyo', async () => {
    expect((await datosDe(dueno, 'clientes_similares', { umbral: 0.95 })).items).toEqual([]);
    expect((await datosDe(lector, 'clientes_similares', {})).items).toHaveLength(1);
    expect((await datosDe(ajeno, 'clientes_similares', {})).items).toEqual([]);
    expect(codigoDe(await dueno.herramienta('clientes_similares', { umbral: 0.1 }))).toBe('argumentos_invalidos');
  });
});

describe('clientes_fusionar · rechazos', () => {
  it('el lector no fusiona y la otra empresa no ve a los clientes', async () => {
    expect((await lector.herramienta('clientes_fusionar', { origenId: origen, destinoId: destino })).estado).toBe(403);
    expect(codigoDe(await ajeno.herramienta('clientes_fusionar', { origenId: origen, destinoId: destino }))).toBe('no_encontrado');
  });

  it('exige dos clientes distintos y existentes', async () => {
    expect(codigoDe(await dueno.herramienta('clientes_fusionar', { origenId: origen, destinoId: origen }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('clientes_fusionar', { origenId: origen, destinoId: randomUUID() }))).toBe('no_encontrado');
  });

  it('no se conserva un cliente archivado', async () => {
    const otro = (await datosDe(dueno, 'clientes_crear', { nombre: 'Cliente archivado' })).id;
    await datosDe(dueno, 'clientes_archivar', { id: otro });
    expect(codigoDe(await dueno.herramienta('clientes_fusionar', { origenId: origen, destinoId: otro }))).toBe('conflicto');
  });
});

describe('clientes_fusionar', () => {
  it('el resumen cuenta lo que se moverá y la confirmación lo hace todo junto', async () => {
    const { respuesta, resumen } = await confirmando(dueno, 'clientes_fusionar', { origenId: origen, destinoId: destino });
    expect(resumen).toMatch(/1 en registro\.deudas/);
    expect(resumen).toMatch(/historial de solo lectura/);
    expect(respuesta.cuerpo, JSON.stringify(respuesta.cuerpo)).toMatchObject({ ok: true });
    const f = respuesta.cuerpo.datos;
    expect(f).toMatchObject({ origenId: origen, destinoId: destino });
    expect(f.reasignadas).toEqual(expect.arrayContaining([{ tabla: 'registro.deudas', filas: 1 }, { tabla: 'core.cliente_contactos y direcciones', filas: 2 }]));
    expect(f.totalFilas).toBe(3);
    expect(f.conservadas).toEqual([{ tabla: 'registro.movimientos', filas: 1 }]);
    expect((await eventosDe(appPool, A, 'cliente.fusionado')).at(-1)!.carga).toEqual({ origenId: origen, destinoId: destino, filas: 3 });
  });

  it('la deuda quedó en el que se conserva y el repetido sale de las listas', async () => {
    const d = await datosDe(dueno, 'deuda_ver', { id: deudaId });
    expect(d.contactoId).toBe(destino);
    const activos = (await datosDe(dueno, 'clientes_listar', { estado: 'activos' })).items.map((c: any) => c.id);
    expect(activos).toContain(destino);
    expect(activos).not.toContain(origen);
    expect((await datosDe(dueno, 'clientes_ver', { id: origen })).archivadoEn).not.toBeNull();
    expect((await datosDe(dueno, 'clientes_similares', {})).items).toEqual([]);
  });

  it('el destino se completa con lo que le faltaba, sin pisar lo que tenía, y pasa a «ambos»', async () => {
    const c = await datosDe(dueno, 'clientes_ver', { id: destino });
    expect(c).toMatchObject({ telefono: '987654321', correo: 'ventas@sol.pe', documentoNumero: '20123456789', tipo: 'ambos' });
  });

  it('los contactos y direcciones pasaron al destino sin quitarle su principal', async () => {
    const contactos = (await datosDe(dueno, 'clientes_contactos_listar', { clienteId: destino })).items;
    expect(contactos.map((x: any) => [x.nombre, x.esPrincipal]).sort()).toEqual([['Ana Rojas', false], ['Luis Paz', true]]);
    expect((await datosDe(dueno, 'clientes_direcciones_listar', { clienteId: destino })).items.map((d: any) => d.esPrincipal)).toEqual([false]);
    expect((await datosDe(dueno, 'clientes_contactos_listar', { clienteId: origen })).items).toEqual([]);
  });

  it('un repetido ya fusionado no se vuelve a fusionar y su nombre queda libre', async () => {
    expect(codigoDe(await dueno.herramienta('clientes_fusionar', { origenId: origen, destinoId: destino }))).toBe('conflicto');
    expect((await dueno.herramienta('clientes_crear', { nombre: 'Imprenta Sol S.A.C.' })).cuerpo.ok).toBe(true);
  });
});
