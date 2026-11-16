import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, datosDe, diaMas, eventosDe, HOY } from './pruebas-de-registro.js';

// Módulo `registro` por HTTP real, parte 1: catálogos, movimientos y el camino «módulo no núcleo»
// (permisos del módulo, `puedeEscribir`, disparador de escritura, contratación por empresa). Reglas R2, R3, R4 y R17.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: registro en nivel lectura
let vendedor: Sesion; // member de A: registro completo con alcance «propios»
let sinModulo: Sesion; // member de A sin el módulo registro asignado
let ajeno: Sesion; // owner de B
let tercero: Sesion; // owner de C (la empresa a la que se da de baja el módulo)
let A: string;
let B: string;
let C: string;
let cajaA: string;
let primero: any;

const MOV = (n: number) => `MOV-${HOY.anio}-${String(n).padStart(6, '0')}`;
const registrar = (s: Sesion, args: Record<string, unknown>, clave?: string) => s.herramienta('movimiento_registrar', args, { clave });
const cuantos = (empresaId: string) => comoEmpresa(appPool, empresaId, async (c) => Number((await c.query('select count(*) from registro.movimientos')).rows[0].count));

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, vendedor, sinModulo, ajeno, tercero] = await Promise.all(
    ['Dueña', 'Lector', 'Vendedora', 'Sin módulo', 'Ajena', 'Tercera'].map((n) => abrirSesion(app, n)),
  );
  A = await crearEmpresa(dueno, 'Registro A');
  B = await crearEmpresa(ajeno, 'Registro B');
  C = await crearEmpresa(tercero, 'Registro C');
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  await activarModulo(A, 'cotizador'); // para poder asignarle OTRO módulo a quien no tendrá registro
  await agregarMiembro(app, A, sinModulo, { modulo: 'cotizador', nivel: 'completo', alcance: 'todos' });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('primer movimiento sin haber creado nada', () => {
  it('registra un ingreso: los catálogos se siembran solos, el correlativo empieza en 1 y sale su evento', async () => {
    const r = await registrar(dueno, { tipo: 'ingreso', montoCentimos: 15_000, descripcion: '  Adelanto de banner  ' });
    expect(r.estado).toBe(200);
    primero = r.cuerpo.datos;
    expect(primero).toMatchObject({
      codigo: MOV(1), numero: 1, anio: HOY.anio, tipo: 'ingreso', fecha: HOY.dia, montoCentimos: 15_000, cuentaNombre: 'Caja', categoriaId: null,
      contactoId: null, medioDePago: 'efectivo', descripcion: 'Adelanto de banner', deudaId: null, origen: 'teclado', estado: 'activo',
      anuladoEn: null, creadoPor: dueno.usuarioId,
    });
    expect(r.cuerpo.avisos).toEqual([]);
    cajaA = primero.cuentaId;
    expect(await eventosDe(appPool, A, 'movimiento.registrado')).toEqual([
      { tipo: 'movimiento.registrado', carga: { id: primero.id, codigo: MOV(1), tipo: 'ingreso', montoCentimos: 15_000, fecha: HOY.dia, cuentaId: cajaA, contactoId: null, deudaId: null } },
    ]);
  });

  it('la cuenta «Caja» es la principal y su saldo ya cuenta el ingreso; hay diez categorías (con «Transferencia» reservada)', async () => {
    const cuentas = (await datosDe(dueno, 'cuentas_listar')).items;
    expect(cuentas).toEqual([expect.objectContaining({ id: cajaA, nombre: 'Caja', tipo: 'caja', esPrincipal: true, saldoInicialCentimos: 0, saldoCentimos: 15_000 })]);
    const categorias = (await datosDe(dueno, 'categorias_listar')).items;
    expect(categorias.map((c: any) => `${c.tipo}:${c.nombre}`)).toEqual([
      'egreso:Compras', 'egreso:Otros egresos', 'egreso:Pagos', 'egreso:Servicios', 'egreso:Sueldos', 'egreso:Transferencia', 'ingreso:Cobros', 'ingreso:Otros ingresos', 'ingreso:Transferencia', 'ingreso:Ventas',
    ]);
    expect(await datosDe(dueno, 'registro_iniciar')).toEqual({ cuentasCreadas: 0, categoriasCreadas: 0 });
    expect((await datosDe(dueno, 'categorias_listar', { tipo: 'ingreso' })).items).toHaveLength(4);
  });
});

describe('validación y reglas de un movimiento', () => {
  it('rechaza montos que no son céntimos enteros positivos, campos de más, fecha futura y referencias que no existen; nada de eso gasta número ni emite', async () => {
    const egresos = (await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items;
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ tipo: 'ingreso', montoCentimos: 0 }, 'argumentos_invalidos'],
      [{ tipo: 'ingreso', montoCentimos: -500 }, 'argumentos_invalidos'],
      [{ tipo: 'ingreso', montoCentimos: 10.5 }, 'argumentos_invalidos'],
      [{ tipo: 'ingreso', montoCentimos: '100' }, 'argumentos_invalidos'],
      [{ tipo: 'ingreso', montoCentimos: 100, sorpresa: 1 }, 'argumentos_invalidos'],
      [{ tipo: 'traspaso', montoCentimos: 100 }, 'argumentos_invalidos'],
      [{ tipo: 'ingreso', montoCentimos: 100, fecha: diaMas(1) }, 'argumentos_invalidos'],
      [{ tipo: 'ingreso', montoCentimos: 100, categoriaId: egresos[0].id }, 'argumentos_invalidos'],
      [{ tipo: 'ingreso', montoCentimos: 100, categoriaId: randomUUID() }, 'no_encontrado'],
      [{ tipo: 'ingreso', montoCentimos: 100, cuentaId: randomUUID() }, 'no_encontrado'],
      [{ tipo: 'ingreso', montoCentimos: 100, contactoId: randomUUID() }, 'no_encontrado'],
      [{ tipo: 'ingreso', montoCentimos: 100, sucursalId: randomUUID() }, 'no_encontrado'],
      [{ tipo: 'ingreso', montoCentimos: 100, empresaId: B }, 'argumento_prohibido'],
      [{ tipo: 'ingreso', montoCentimos: 100, usuarioId: lector.usuarioId }, 'argumento_prohibido'],
    ];
    for (const [args, esperado] of casos) expect(codigoDe(await registrar(dueno, args)), JSON.stringify(args)).toBe(esperado);
    expect(await cuantos(A)).toBe(1);
    expect(await eventosDe(appPool, A, 'movimiento.registrado')).toHaveLength(1);
    // Correlativo sin huecos: tras catorce rechazos, el siguiente movimiento es el 2.
    const ayer = await datosDe(dueno, 'movimiento_registrar', { tipo: 'egreso', montoCentimos: 4_550, fecha: diaMas(-1), categoriaId: egresos[0].id, medioDePago: 'yape' });
    expect(ayer).toMatchObject({ codigo: MOV(2), fecha: diaMas(-1), categoriaNombre: 'Compras', medioDePago: 'yape' });
  });

  it('un egreso que deja la cuenta en negativo se permite y avisa', async () => {
    const r = await registrar(dueno, { tipo: 'egreso', montoCentimos: 20_000 });
    expect(r.cuerpo.ok).toBe(true);
    expect(r.cuerpo.avisos).toEqual([{ codigo: 'saldo_negativo', nivel: 'comercial', mensaje: 'La cuenta «Caja» queda con saldo negativo.' }]);
    expect((await datosDe(dueno, 'cuentas_listar')).items[0].saldoCentimos).toBe(15_000 - 4_550 - 20_000);
    expect((await registrar(dueno, { tipo: 'ingreso', montoCentimos: 30_000 })).cuerpo.avisos).toEqual([]);
  });

  it('la misma clave de idempotencia no registra dos veces; con otros datos es conflicto', async () => {
    const clave = `mov-${randomUUID()}`;
    const antes = await cuantos(A);
    const a = await registrar(dueno, { tipo: 'ingreso', montoCentimos: 777 }, clave);
    const b = await registrar(dueno, { tipo: 'ingreso', montoCentimos: 777 }, clave);
    expect(a.cuerpo.ok).toBe(true);
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect(await cuantos(A)).toBe(antes + 1);
    expect(codigoDe(await registrar(dueno, { tipo: 'ingreso', montoCentimos: 778 }, clave))).toBe('conflicto');
    expect(await cuantos(A)).toBe(antes + 1);
  });

  it('acepta un contacto de la empresa y muestra su nombre', async () => {
    const cliente = await datosDe(dueno, 'clientes_crear', { nombre: 'Imprenta Sol SAC' });
    const m = await datosDe(dueno, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 1_000, contactoId: cliente.id });
    expect(m).toMatchObject({ contactoId: cliente.id, contactoNombre: 'Imprenta Sol SAC' });
    expect((await datosDe(dueno, 'movimientos_listar', { contactoId: cliente.id })).items.map((x: any) => x.id)).toEqual([m.id]);
  });
});

describe('cuentas y categorías', () => {
  let bcp: any;

  it('crea una cuenta con saldo inicial; el nombre repetido es conflicto con candidatas', async () => {
    bcp = await datosDe(dueno, 'cuenta_crear', { nombre: 'BCP Soles', tipo: 'banco', saldoInicialCentimos: 50_000 });
    expect(bcp).toMatchObject({ nombre: 'BCP Soles', tipo: 'banco', esPrincipal: false, saldoInicialCentimos: 50_000, saldoCentimos: 50_000, archivadoEn: null });
    const repetida = await dueno.herramienta('cuenta_crear', { nombre: 'bcp  soles', tipo: 'banco' });
    expect(repetida.estado).toBe(409);
    expect(repetida.cuerpo.error.candidatas).toEqual([{ id: bcp.id, nombre: 'BCP Soles', detalle: 'banco' }]);
    expect(codigoDe(await dueno.herramienta('cuenta_crear', { nombre: 'Con decimales', tipo: 'banco', saldoInicialCentimos: 0.5 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuenta_crear', { nombre: 'Rara', tipo: 'inversion' }))).toBe('argumentos_invalidos');
  });

  it('un movimiento en esa cuenta mueve su saldo y no el de la caja', async () => {
    const antes = (await datosDe(dueno, 'cuentas_listar')).items.find((c: any) => c.id === cajaA).saldoCentimos;
    await datosDe(dueno, 'movimiento_registrar', { tipo: 'egreso', montoCentimos: 12_345, cuentaId: bcp.id, medioDePago: 'transferencia' });
    const cuentas = (await datosDe(dueno, 'cuentas_listar')).items;
    expect(cuentas.find((c: any) => c.id === bcp.id).saldoCentimos).toBe(50_000 - 12_345);
    expect(cuentas.find((c: any) => c.id === cajaA).saldoCentimos).toBe(antes);
  });

  it('edita, cambia la principal (el movimiento sin cuenta va a la nueva) y no archiva la principal', async () => {
    expect(await datosDe(dueno, 'cuenta_editar', { id: bcp.id, nombre: 'BCP Ahorros' })).toMatchObject({ nombre: 'BCP Ahorros', tipo: 'banco' });
    expect(codigoDe(await dueno.herramienta('cuenta_editar', { id: bcp.id }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuenta_editar', { id: bcp.id, nombre: 'caja' }))).toBe('conflicto');
    expect(await datosDe(dueno, 'cuenta_marcar_principal', { id: bcp.id })).toMatchObject({ id: bcp.id, esPrincipal: true });
    expect((await datosDe(dueno, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 100 })).cuentaId).toBe(bcp.id);
    expect(codigoDe(await dueno.herramienta('cuenta_archivar', { id: bcp.id }))).toBe('conflicto');
    expect(await datosDe(dueno, 'cuenta_marcar_principal', { id: cajaA })).toMatchObject({ id: cajaA, esPrincipal: true });
  });

  it('una cuenta archivada sale de la lista, no recibe movimientos y no puede ser principal', async () => {
    expect((await datosDe(dueno, 'cuenta_archivar', { id: bcp.id })).archivadoEn).toEqual(expect.any(String));
    expect((await datosDe(dueno, 'cuentas_listar')).items.map((c: any) => c.id)).toEqual([cajaA]);
    expect((await datosDe(dueno, 'cuentas_listar', { incluirArchivadas: true })).items).toHaveLength(2);
    expect(codigoDe(await registrar(dueno, { tipo: 'ingreso', montoCentimos: 100, cuentaId: bcp.id }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('cuenta_marcar_principal', { id: bcp.id }))).toBe('conflicto');
  });

  it('categorías: alta, repetida con candidatas, renombrar y archivar (la archivada ya no se usa)', async () => {
    const alquiler = await datosDe(dueno, 'categoria_crear', { nombre: 'Alquiler', tipo: 'egreso' });
    const repetida = await dueno.herramienta('categoria_crear', { nombre: 'ALQUILER', tipo: 'egreso' });
    expect(codigoDe(repetida)).toBe('conflicto');
    expect(repetida.cuerpo.error.candidatas[0]).toMatchObject({ id: alquiler.id, nombre: 'Alquiler' });
    expect((await dueno.herramienta('categoria_crear', { nombre: 'Alquiler', tipo: 'ingreso' })).cuerpo.ok).toBe(true);
    expect(await datosDe(dueno, 'categoria_editar', { id: alquiler.id, nombre: 'Alquiler del local' })).toMatchObject({ nombre: 'Alquiler del local', tipo: 'egreso' });
    expect(codigoDe(await dueno.herramienta('categoria_editar', { id: alquiler.id, nombre: 'Compras' }))).toBe('conflicto');
    expect((await datosDe(dueno, 'categoria_archivar', { id: alquiler.id })).archivadoEn).toEqual(expect.any(String));
    expect((await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items.map((c: any) => c.id)).not.toContain(alquiler.id);
    expect(codigoDe(await registrar(dueno, { tipo: 'egreso', montoCentimos: 100, categoriaId: alquiler.id }))).toBe('conflicto');
    // Archivar no resucita lo sembrado: el arranque solo siembra sobre vacío.
    expect(await datosDe(dueno, 'registro_iniciar')).toEqual({ cuentasCreadas: 0, categoriasCreadas: 0 });
  });
});

describe('listado de movimientos', () => {
  it('pagina con cursor por (fecha, id) descendente, sin repetir ni saltar', async () => {
    const todos = (await datosDe(dueno, 'movimientos_listar', { limite: 100 })).items;
    expect(todos.length).toBeGreaterThanOrEqual(7);
    const vistos: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await datosDe(dueno, 'movimientos_listar', { limite: 3, ...(cursor && { cursor }) });
      vistos.push(...p.items.map((m: any) => m.id));
      cursor = p.siguiente ?? undefined;
    } while (cursor);
    expect(vistos).toEqual(todos.map((m: any) => m.id));
    const fechas = todos.map((m: any) => m.fecha);
    expect([...fechas].sort((a: string, b: string) => b.localeCompare(a))).toEqual(fechas);
    expect(codigoDe(await dueno.herramienta('movimientos_listar', { cursor: 'no-es-un-cursor' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('movimientos_listar', { limite: 101 }))).toBe('argumentos_invalidos');
  });

  it('filtra por tipo, por fechas y por cuenta', async () => {
    const egresos = (await datosDe(dueno, 'movimientos_listar', { tipo: 'egreso', limite: 100 })).items;
    expect(egresos.every((m: any) => m.tipo === 'egreso')).toBe(true);
    const deAyer = (await datosDe(dueno, 'movimientos_listar', { desde: diaMas(-1), hasta: diaMas(-1) })).items;
    expect(deAyer.map((m: any) => m.codigo)).toEqual([MOV(2)]);
    expect((await datosDe(dueno, 'movimientos_listar', { hasta: diaMas(-2) })).items).toEqual([]);
    expect((await datosDe(dueno, 'movimientos_listar', { estado: 'anulados' })).items).toEqual([]);
  });
});

describe('aislamiento entre empresas', () => {
  it('la otra empresa no ve nada de A, ni puede usar sus cuentas, categorías o contactos', async () => {
    expect(codigoDe(await ajeno.herramienta('movimiento_ver', { id: primero.id }))).toBe('no_encontrado');
    expect((await datosDe(ajeno, 'movimientos_listar')).items).toEqual([]);
    expect((await datosDe(ajeno, 'cuentas_listar')).items).toEqual([]);
    const categoriaDeA = (await datosDe(dueno, 'categorias_listar', { tipo: 'ingreso' })).items[0].id;
    const contactoDeA = (await datosDe(dueno, 'clientes_listar')).items[0].id;
    expect(codigoDe(await registrar(ajeno, { tipo: 'ingreso', montoCentimos: 100, cuentaId: cajaA }))).toBe('no_encontrado');
    expect(codigoDe(await registrar(ajeno, { tipo: 'ingreso', montoCentimos: 100, categoriaId: categoriaDeA }))).toBe('no_encontrado');
    expect(codigoDe(await registrar(ajeno, { tipo: 'ingreso', montoCentimos: 100, contactoId: contactoDeA }))).toBe('no_encontrado');
    for (const nombre of ['cuenta_archivar', 'cuenta_marcar_principal', 'categoria_archivar']) {
      expect(codigoDe(await ajeno.herramienta(nombre, { id: nombre.startsWith('cuenta') ? cajaA : categoriaDeA })), nombre).toBe('no_encontrado');
    }
    expect(codigoDe(await ajeno.herramienta('cuenta_editar', { id: cajaA, nombre: 'Tomada' }))).toBe('no_encontrado');
    expect(await cuantos(B)).toBe(0);
  });

  it('cada empresa lleva su propio correlativo y sus propios catálogos', async () => {
    const m = await datosDe(ajeno, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 999 });
    expect(m).toMatchObject({ codigo: MOV(1), cuentaNombre: 'Caja' });
    expect(m.cuentaId).not.toBe(cajaA);
    expect(codigoDe(await dueno.herramienta('movimiento_ver', { id: m.id }))).toBe('no_encontrado');
    expect((await datosDe(dueno, 'movimientos_listar', { limite: 100 })).items.map((x: any) => x.id)).not.toContain(m.id);
    expect((await eventosDe(appPool, B, 'movimiento.registrado')).map((e) => e.carga.id)).toEqual([m.id]);
  });
});

describe('camino de módulo no núcleo: permisos, nivel, alcance y contratación', () => {
  it('un member con nivel lectura lee y recibe modulo_solo_lectura al escribir (R2)', async () => {
    expect((await datosDe(lector, 'movimientos_listar')).items.length).toBeGreaterThan(0);
    expect((await datosDe(lector, 'movimiento_ver', { id: primero.id })).codigo).toBe(MOV(1));
    expect((await datosDe(lector, 'cuentas_listar')).items).toHaveLength(1);
    expect((await datosDe(lector, 'caja_del_dia')).fecha).toBe(HOY.dia);
    const antes = await cuantos(A);
    for (const [nombre, args] of [
      ['movimiento_registrar', { tipo: 'ingreso', montoCentimos: 100 }],
      ['registro_iniciar', {}],
      ['cuenta_crear', { nombre: 'Intrusa', tipo: 'caja' }],
      ['cuenta_archivar', { id: cajaA }],
      ['categoria_crear', { nombre: 'Intrusa', tipo: 'ingreso' }],
      ['movimiento_anular', { id: primero.id, motivo: 'no debería' }],
    ] as const) {
      const r = await lector.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(codigoDe(r), nombre).toBe('modulo_solo_lectura');
    }
    expect(await cuantos(A)).toBe(antes);
  });

  it('un member sin el módulo asignado recibe modulo_no_disponible, también al leer', async () => {
    for (const [nombre, args] of [
      ['movimientos_listar', {}],
      ['cuentas_listar', {}],
      ['movimiento_ver', { id: primero.id }],
      ['movimiento_registrar', { tipo: 'ingreso', montoCentimos: 100 }],
      ['registro_resumen', { desde: HOY.dia, hasta: HOY.dia }],
    ] as const) {
      expect(codigoDe(await sinModulo.herramienta(nombre, args)), nombre).toBe('modulo_no_disponible');
    }
  });

  it('un member con alcance «propios» registra, pero solo ve lo suyo y no recibe reportes (R4)', async () => {
    const suyo = await datosDe(vendedor, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 2_500 });
    expect(suyo.creadoPor).toBe(vendedor.usuarioId);
    expect((await datosDe(vendedor, 'movimientos_listar', { limite: 100 })).items.map((m: any) => m.id)).toEqual([suyo.id]);
    expect((await datosDe(vendedor, 'movimiento_ver', { id: suyo.id })).id).toBe(suyo.id);
    expect(codigoDe(await vendedor.herramienta('movimiento_ver', { id: primero.id }))).toBe('no_encontrado');
    for (const [nombre, args] of [['caja_del_dia', {}], ['registro_resumen', { desde: HOY.dia, hasta: HOY.dia }]] as const) {
      const r = await vendedor.herramienta(nombre, args);
      expect(codigoDe(r), nombre).toBe('sin_permiso');
      expect(r.cuerpo.error.mensaje).toBe('Tu acceso es solo a tus propios registros.');
    }
    // La dueña sí ve el de la vendedora; los catálogos no tienen alcance.
    expect((await datosDe(dueno, 'movimiento_ver', { id: suyo.id })).id).toBe(suyo.id);
    expect((await datosDe(vendedor, 'cuentas_listar')).items).toHaveLength(1);
  });

  it('módulo en baja: se lee, no se escribe por herramienta ni con un insert directo (R3)', async () => {
    const m = await datosDe(tercero, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 5_000 });
    await darDeBajaModulo(C, 'registro');
    expect((await datosDe(tercero, 'movimientos_listar')).items.map((x: any) => x.id)).toEqual([m.id]);
    expect((await datosDe(tercero, 'cuentas_listar')).items[0].saldoCentimos).toBe(5_000);
    expect((await datosDe(tercero, 'registro_resumen', { desde: HOY.dia, hasta: HOY.dia })).ingresosCentimos).toBe(5_000);
    for (const [nombre, args] of [
      ['movimiento_registrar', { tipo: 'ingreso', montoCentimos: 100 }],
      ['registro_iniciar', {}],
      ['cuenta_crear', { nombre: 'Otra', tipo: 'caja' }],
      ['movimiento_anular', { id: m.id, motivo: 'en baja' }],
    ] as const) {
      expect(codigoDe(await tercero.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    const directo = comoEmpresa(appPool, C, (c) =>
      c.query(`insert into registro.categorias (tenant_id, nombre, nombre_normalizado, tipo, creado_por) values ($1, 'Directa', 'directa', 'egreso', 'u1')`, [C]),
    );
    await expect(directo).rejects.toThrow(/no está activo/);
    const anular = comoEmpresa(appPool, C, (c) => c.query(`update registro.movimientos set estado = 'anulado', anulado_en = now() where id = $1`, [m.id]));
    await expect(anular).rejects.toThrow(/no está activo/);
    expect(await cuantos(C)).toBe(1);
  });

  it('módulo no contratado: no se entra ni a leer', async () => {
    const owner = abrirPool('owner');
    try {
      await comoEmpresa(owner, C, (c) => c.query(`delete from core.empresa_modulos where tenant_id = $1 and modulo = 'registro'`, [C]), { confirmar: true });
    } finally {
      await owner.end();
    }
    for (const [nombre, args] of [['movimientos_listar', {}], ['cuentas_listar', {}], ['movimiento_registrar', { tipo: 'ingreso', montoCentimos: 100 }]] as const) {
      const r = await tercero.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(codigoDe(r), nombre).toBe('modulo_no_disponible');
    }
  });
});
