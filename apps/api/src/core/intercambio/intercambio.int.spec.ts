import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import { leerCsv } from './csv.js';

// Fase 11b por HTTP real: exportar, previsualizar e importar CSV de clientes y productos con dos empresas y un member.

let app: AppDePruebas;
let auth: pg.Pool;
let appPool: pg.Pool;
let dueno: Sesion;
let miembro: Sesion;
let ajeno: Sesion;
let empresaA: string;
let empresaB: string;

const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;
const filas = (empresaId: string, sql: string) => comoEmpresa(appPool, empresaId, async (c) => (await c.query(sql)).rows as any[]);

/** Aplica con la confirmación en dos pasos, como hace la pantalla. */
async function aplicar(s: Sesion, args: unknown) {
  const pide = await s.herramienta('importar_csv_aplicar', args);
  expect(pide.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { resumen: expect.any(String), token: expect.any(String) } });
  return { resumen: pide.cuerpo.requiereConfirmacion.resumen as string, final: await s.herramienta('importar_csv_aplicar', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token }) };
}

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  appPool = abrirPool('app');
  [dueno, miembro, ajeno] = await Promise.all([abrirSesion(app, 'Dueña'), abrirSesion(app, 'Miembro'), abrirSesion(app, 'Ajena')]);
  empresaA = await crearEmpresa(dueno, 'Empresa A de intercambio');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de intercambio');
  await auth.query('insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())', [randomUUID(), empresaA, miembro.usuarioId, 'member']);
  expect((await miembro.pedir('POST', '/api/auth/organization/set-active', { organizationId: empresaA })).estado).toBe(200);
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
  await appPool.end();
});

describe('importar clientes: 200 filas, 5 malas', () => {
  // Filas de datos 1..200; las malas: teléfono, DNI, correo, nombre vacío y fila con columnas de más.
  const malas = new Map<number, string>([[10, 'telefono'], [50, 'dni'], [90, 'correo'], [130, 'nombre'], [170, 'columnas']]);
  const archivo = () => {
    const l = ['Nombre;Tipo de documento;Número de documento;Teléfono;Correo;Dirección'];
    for (let i = 1; i <= 200; i++) {
      const dni = String(10000000 + i);
      const m = malas.get(i);
      l.push(
        m === 'nombre' ? `;dni;${dni};999111222;;` :
        m === 'columnas' ? `Cliente ${i};dni;${dni};999111222;;Av. 1;extra` :
        `Cliente ${i};dni;${m === 'dni' ? '123' : dni};${m === 'telefono' ? 'abc' : '999111222'};${m === 'correo' ? 'sin-arroba' : `c${i}@ejemplo.pe`};"Av. ""Sol"", ${i}"`,
      );
    }
    return `﻿${l.join('\r\n')}`;
  };

  it('previsualiza los 5 errores con su fila y no escribe nada', async () => {
    const r = await dueno.herramienta('importar_csv_previsualizar', { entidad: 'clientes', contenido: archivo() });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.datos).toMatchObject({ total: 200, nuevas: 195, erroresTotal: 5, duplicadasTotal: 0, separador: ';' });
    expect(r.cuerpo.datos.errores.map((e: any) => e.fila)).toEqual([11, 51, 91, 131, 171]); // +1 por el encabezado
    for (const e of r.cuerpo.datos.errores) expect(e.motivo.length).toBeGreaterThan(5);
    expect(await filas(empresaA, 'select 1 from core.clientes')).toHaveLength(0);
  });

  it('importa 195, deja la corrida en sincronizaciones y al repetirlo no duplica', async () => {
    const { resumen, final } = await aplicar(dueno, { entidad: 'clientes', contenido: archivo() });
    expect(resumen).toContain('195');
    expect(final.cuerpo.datos).toMatchObject({ creadas: 195, erroresTotal: 5, duplicadasTotal: 0 });
    expect(await filas(empresaA, 'select 1 from core.clientes')).toHaveLength(195);
    const sinc = await filas(empresaA, "select * from core.sincronizaciones where conector = 'archivo'");
    expect(sinc).toHaveLength(1);
    expect(sinc[0]).toMatchObject({ tipo: 'importar', entidad: 'clientes', estado: 'con_errores', total: 200, procesados: 195, iniciado_por: dueno.usuarioId });
    expect(sinc[0].errores).toHaveLength(5);
    expect(sinc[0].id).toBe(final.cuerpo.datos.sincronizacionId);
    // Las altas pasaron por la herramienta: auditoría y eventos.
    expect((await filas(empresaA, "select 1 from core.auditoria where herramienta = 'clientes_crear' and resultado = 'ok'")).length).toBe(195);
    expect((await filas(empresaA, "select 1 from core.eventos_salida where tipo = 'cliente.creado'")).length).toBe(195);

    const otra = await aplicar(dueno, { entidad: 'clientes', contenido: archivo() });
    expect(otra.final.cuerpo.datos).toMatchObject({ creadas: 0, duplicadasTotal: 195, erroresTotal: 5 });
    expect(await filas(empresaA, 'select 1 from core.clientes')).toHaveLength(195);
  });

  it('la empresa ajena no ve nada de lo importado', async () => {
    const r = await ajeno.herramienta('exportar_csv', { entidad: 'clientes' });
    expect(r.cuerpo.datos.filas).toBe(0);
    expect(await filas(empresaB, 'select 1 from core.sincronizaciones')).toHaveLength(0);
  });
});

describe('exportar', () => {
  it('escribe BOM, respeta el separador y se lee de vuelta', async () => {
    const r = await dueno.herramienta('exportar_csv', { entidad: 'clientes', separador: ';' });
    expect(r.estado).toBe(200);
    const d = r.cuerpo.datos;
    expect(d).toMatchObject({ filas: 195, truncado: false });
    expect(d.nombreDeArchivo).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(d.contenido.startsWith('﻿tipo;clase;nombre;')).toBe(true);
    const leido = leerCsv(d.contenido, { maxFilas: 5000 });
    expect(leido.ok && leido.filas.length).toBe(196);
  });

  it('prefija las fórmulas y la exportación se puede volver a importar sin duplicar', async () => {
    const p = await dueno.herramienta('productos_crear', { nombre: '=HYPERLINK("http://x")', precioUnitarioMilesimas: 25500, codigo: 'EXP-1' });
    expect(p.estado).toBe(200);
    await dueno.herramienta('productos_crear', { nombre: 'Banner, "grande"', precioUnitarioMilesimas: 90000, descripcion: 'línea 1\nlínea 2' });
    const r = await dueno.herramienta('exportar_csv', { entidad: 'productos' });
    const csv: string = r.cuerpo.datos.contenido;
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")",producto,unidad,25.50,si,`);
    expect(csv).toContain('"Banner, ""grande"""');
    const prev = await dueno.herramienta('importar_csv_previsualizar', { entidad: 'productos', contenido: csv });
    expect(prev.cuerpo.datos).toMatchObject({ total: 2, nuevas: 0, duplicadasTotal: 2, erroresTotal: 0 });
  });

  it('un member sin datos:exportar no exporta; la empresa sale de la sesión', async () => {
    expect(codigo(await miembro.herramienta('exportar_csv', { entidad: 'clientes' }))).toBe('sin_permiso');
    expect(codigo(await dueno.herramienta('exportar_csv', { entidad: 'clientes', empresaId: empresaB }))).toBe('argumento_prohibido');
    expect(codigo(await dueno.herramienta('exportar_csv', { entidad: 'excel' }))).toBe('argumentos_invalidos');
  });
});

describe('importar productos', () => {
  it('convierte soles a milésimas sin decimales binarios, detecta duplicados por nombre y por código', async () => {
    const csv = [
      'codigo,nombre,tipo,unidad,precio,afecto a IGV',
      'IMP-1,Tarjetas x100,producto,millar,"25,50",si',
      'IMP-2,Diseño de logo,servicio,,120,no',
      'IMP-3,tarjetas X100,producto,millar,30,si',
      'IMP-1,Otro con mismo código,producto,,10,si',
      'IMP-4,Precio malo,producto,,12.3456,si',
      'IMP-5,Tipo malo,mueble,,10,si',
      'IMP-6,Igv malo,producto,,10,quizá',
    ].join('\n');
    const prev = await dueno.herramienta('importar_csv_previsualizar', { entidad: 'productos', contenido: csv });
    expect(prev.cuerpo.datos).toMatchObject({ total: 7, nuevas: 2, duplicadasTotal: 2, erroresTotal: 3, separador: ',' });
    expect(prev.cuerpo.datos.duplicadas.map((d: any) => d.fila)).toEqual([4, 5]);
    expect(prev.cuerpo.datos.errores.map((d: any) => d.fila)).toEqual([6, 7, 8]);
    const { final } = await aplicar(dueno, { entidad: 'productos', contenido: csv });
    expect(final.cuerpo.datos.creadas).toBe(2);
    const bd = await filas(empresaA, "select codigo, tipo, unidad, precio_unitario_milesimas as p, afecto_igv from core.productos where codigo like 'IMP-%' order by codigo");
    expect(bd).toEqual([
      { codigo: 'IMP-1', tipo: 'producto', unidad: 'millar', p: '25500', afecto_igv: true },
      { codigo: 'IMP-2', tipo: 'servicio', unidad: 'unidad', p: '120000', afecto_igv: false },
    ].map((f) => ({ ...f, p: expect.anything() })));
    expect(bd.map((f) => Number(f.p))).toEqual([25500, 120000]);
  });
});

describe('seguridad y límites', () => {
  it('un member sin datos:importar no previsualiza ni importa', async () => {
    const args = { entidad: 'clientes', contenido: 'nombre\nAna' };
    expect(codigo(await miembro.herramienta('importar_csv_previsualizar', args))).toBe('sin_permiso');
    expect(codigo(await miembro.herramienta('importar_csv_aplicar', args))).toBe('sin_permiso');
  });

  it('el archivo malformado, sin nombre, vacío o demasiado largo se rechaza entero', async () => {
    const pre = (contenido: string) => dueno.herramienta('importar_csv_previsualizar', { entidad: 'clientes', contenido });
    expect(codigo(await pre('telefono\n999'))).toBe('argumentos_invalidos');
    expect(codigo(await pre('nombre\n"sin cerrar'))).toBe('argumentos_invalidos');
    expect(codigo(await pre('nombre\n'))).toBe('argumentos_invalidos');
    expect(codigo(await pre('nombre,nombre\nA,B'))).toBe('argumentos_invalidos');
    const muchas = await pre(`nombre\n${Array.from({ length: 1001 }, (_, i) => `N${i}`).join('\n')}`);
    expect(codigo(muchas)).toBe('argumentos_invalidos');
    expect(muchas.cuerpo.error.mensaje).toContain('1000');
    const grande = await pre(`nombre\n${'x'.repeat(200_001)}`);
    expect(codigo(grande)).toBe('argumentos_invalidos');
  });

  it('sin confirmación no se importa nada', async () => {
    const antes = (await filas(empresaA, 'select 1 from core.clientes')).length;
    const pide = await dueno.herramienta('importar_csv_aplicar', { entidad: 'clientes', contenido: 'nombre\nSin Confirmar' });
    expect(pide.cuerpo.ok).toBe(false);
    expect((await filas(empresaA, 'select 1 from core.clientes')).length).toBe(antes);
  });
});
