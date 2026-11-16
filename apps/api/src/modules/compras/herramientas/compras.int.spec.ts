import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { activarCompras, codigo, crearBorrador, crearEnviada, crearProducto, crearProveedor, datos, eventosDe, linea, mensaje, recibir } from './pruebas-de-compras.js';

// Compras por HTTP real, parte 1: borradores (crear, editar, ver, listar) con dos empresas, un member de
// solo lectura, uno sin el módulo y uno con alcance «propios»; módulo en baja y sin contratar.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: compras en lectura
let sinModulo: Sesion; // member de A: solo insumos
let propio: Sesion; // member de A: compras completo, alcance propios
let ajeno: Sesion; // owner de B
let empresaA: string;
let empresaB: string;
let proveedor: string;
let proveedorB: string;
let papel: string; // producto afecto
let libro: string; // producto no afecto

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, sinModulo, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Sin módulo', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de compras');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de compras');
  await Promise.all([activarCompras(empresaA), activarCompras(empresaB)]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'compras', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, sinModulo, { modulo: 'insumos', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'compras', nivel: 'completo', alcance: 'propios' });
  proveedor = await crearProveedor(dueno, 'Papelera Andina');
  proveedorB = await crearProveedor(ajeno, 'Proveedor de B');
  papel = await crearProducto(dueno, 'Papel bond A4', { unidad: 'millar', precioUnitarioMilesimas: 40_000 });
  libro = await crearProducto(dueno, 'Libro contable', { precioUnitarioMilesimas: 50_000, afectoIgv: false });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('compra_crear', () => {
  it('un borrador con producto, gasto sin producto y no afecto: totales con IGV incluido y sin evento', async () => {
    const r = await dueno.herramienta('compra_crear', {
      proveedorId: proveedor,
      fecha: '2099-01-02',
      entregaEl: '2099-01-10',
      notas: '  Entregar en almacén ',
      lineas: [
        { productoId: papel, cantidadMilesimas: 10_000, costoUnitarioMilesimas: 11_800 },
        linea('Flete', 0.1),
        { productoId: libro, cantidadMilesimas: 2_000, costoUnitarioMilesimas: 50_000 },
      ],
    });
    expect(r.estado).toBe(200);
    const c = datos(r);
    expect(c).toMatchObject({
      codigo: 'Borrador', numero: null, serie: null, anio: null, estado: 'borrador', proveedorId: proveedor, proveedorNombre: 'Papelera Andina',
      fecha: '2099-01-02', entregaEl: '2099-01-10', atrasada: false, notas: 'Entregar en almacén', igvPorcentaje: 18,
      subtotalCentimos: 20_008, igvCentimos: 1_802, totalCentimos: 21_810, lineas: 3, lineasPorRecibir: 3, creadoPor: dueno.usuarioId, recepciones: [],
    });
    // El costo es el que llega, nunca el precio de venta del producto.
    expect(c.detalle.map((l: any) => [l.posicion, l.descripcion, l.unidad, l.afectoIgv, l.costoUnitarioMilesimas, l.importeCentimos, l.recibidoMilesimas, l.pendienteMilesimas])).toEqual([
      [0, 'Papel bond A4', 'millar', true, 11_800, 11_800, 0, 10_000],
      [1, 'Flete', 'unidad', true, 100, 10, 0, 1_000],
      [2, 'Libro contable', 'unidad', false, 50_000, 10_000, 0, 2_000],
    ]);
    expect((await eventosDe(appPool, empresaA)).filter((e) => e.tipo.startsWith('compra.'))).toEqual([]);
  });

  it('sin líneas se guarda (borrador vacío) y la fecha por defecto es hoy', async () => {
    const c = datos(await dueno.herramienta('compra_crear', { proveedorId: proveedor }));
    expect(c).toMatchObject({ lineas: 0, totalCentimos: 0, detalle: [] });
    expect(c.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('validación: campo inválido, campo de más, línea incompleta o con decimales y argumentos de contexto', async () => {
    for (const args of [
      { proveedorId: 'no-es-uuid' },
      { proveedorId: proveedor, descuento: 10 },
      { proveedorId: proveedor, lineas: [{ descripcion: 'Sin costo', cantidadMilesimas: 1000 }] },
      { proveedorId: proveedor, lineas: [{ cantidadMilesimas: 1000, costoUnitarioMilesimas: 100 }] },
      { proveedorId: proveedor, lineas: [{ ...linea('Decimales', 1), cantidadMilesimas: 1.5 }] },
      { proveedorId: proveedor, lineas: [{ ...linea('Decimales', 1), costoUnitarioMilesimas: 0.5 }] },
      { proveedorId: proveedor, lineas: [{ ...linea('Cero', 1), cantidadMilesimas: 0 }] },
      { proveedorId: proveedor, lineas: [{ ...linea('Negativo', 1), costoUnitarioMilesimas: -1 }] },
      { proveedorId: proveedor, lineas: [{ ...linea('Precio', 1), precioUnitarioMilesimas: 1 }] },
    ]) {
      const r = await dueno.herramienta('compra_crear', args);
      expect(r.estado, JSON.stringify(args)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
    }
    expect(codigo(await dueno.herramienta('compra_crear', { proveedorId: proveedor, empresaId: empresaB }))).toBe('argumento_prohibido');
    expect(codigo(await dueno.herramienta('compra_crear', { proveedorId: proveedor, usuarioId: 'otro' }))).toBe('argumento_prohibido');
  });

  it('rechaza lo que no existe: proveedor (también el de otra empresa), producto, sucursal; y la entrega anterior a la fecha', async () => {
    const casos: Array<[Record<string, unknown>, RegExp]> = [
      [{ proveedorId: randomUUID() }, /proveedor/],
      [{ proveedorId: proveedorB }, /proveedor/],
      [{ proveedorId: proveedor, lineas: [{ productoId: randomUUID(), cantidadMilesimas: 1000, costoUnitarioMilesimas: 1 }] }, /Línea 1: el producto/],
      [{ proveedorId: proveedor, sucursalId: randomUUID() }, /sucursal/],
      [{ proveedorId: proveedor, fecha: '2099-01-10', entregaEl: '2099-01-09' }, /entrega/],
    ];
    for (const [args, patron] of casos) {
      const r = await dueno.herramienta('compra_crear', args);
      expect(codigo(r), JSON.stringify(args)).toBe('argumentos_invalidos');
      expect(mensaje(r)).toMatch(patron);
    }
  });

  it('la misma clave de idempotencia no crea dos órdenes', async () => {
    const clave = `oc-${randomUUID()}`;
    const args = { proveedorId: proveedor, notas: 'idempotente', lineas: [linea('Único', 5)] };
    const a = datos(await dueno.herramienta('compra_crear', args, { clave }));
    const b = datos(await dueno.herramienta('compra_crear', args, { clave }));
    expect(b.id).toBe(a.id);
    const lista = datos(await dueno.herramienta('compras_listar', { limite: 100 }));
    expect(lista.items.filter((c: any) => c.notas === 'idempotente')).toHaveLength(1);
    expect(codigo(await dueno.herramienta('compra_crear', { ...args, notas: 'otros datos' }, { clave }))).toBe('conflicto');
  });
});

describe('compra_editar', () => {
  it('reemplaza todas las líneas y recalcula; cambia y borra opcionales', async () => {
    const c = await crearBorrador(dueno, proveedor, { notas: 'nota inicial', entregaEl: '2099-05-01', fecha: '2099-04-01' });
    const r = datos(await dueno.herramienta('compra_editar', { id: c.id, notas: null, entregaEl: '2099-05-02', lineas: [linea('A', 0.1), linea('B', 0.1), linea('C', 0.1)] }));
    expect(r).toMatchObject({ notas: null, entregaEl: '2099-05-02', lineas: 3, subtotalCentimos: 24, igvCentimos: 6, totalCentimos: 30 });
    expect(r.detalle.map((l: any) => l.descripcion)).toEqual(['A', 'B', 'C']);
    expect(datos(await dueno.herramienta('compra_editar', { id: c.id, lineas: [] }))).toMatchObject({ lineas: 0, totalCentimos: 0, subtotalCentimos: 0, igvCentimos: 0 });
  });

  it('exige al menos un cambio, no admite cambiar la fecha y respeta la regla de la entrega; enviada ya no se edita', async () => {
    const c = await crearBorrador(dueno, proveedor, { fecha: '2099-04-10' });
    expect(codigo(await dueno.herramienta('compra_editar', { id: c.id }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('compra_editar', { id: c.id, fecha: '2099-04-11' }))).toBe('argumentos_invalidos');
    expect(mensaje(await dueno.herramienta('compra_editar', { id: c.id, entregaEl: '2099-04-09' }))).toMatch(/entrega/);
    expect(codigo(await dueno.herramienta('compra_editar', { id: randomUUID(), notas: 'x' }))).toBe('no_encontrado');
    const enviada = datos(await dueno.herramienta('compra_enviar', { id: c.id }));
    const r = await dueno.herramienta('compra_editar', { id: enviada.id, notas: 'tarde' });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe('Solo se edita una orden de compra en borrador.');
    expect(datos(await dueno.herramienta('compra_ver', { id: c.id }))).toMatchObject({ notas: null, lineas: 1, totalCentimos: 11_800 });
  });
});

describe('listado', () => {
  it('pagina con cursor de la más nueva a la más antigua, sin repetir ni saltar', async () => {
    const marca = `pag-${randomUUID()}`;
    for (let i = 0; i < 5; i++) await crearBorrador(dueno, proveedor, { notas: `${marca}-${i}` });
    const vistos: string[] = [];
    let cursor: string | undefined;
    do {
      const pagina = datos(await dueno.herramienta('compras_listar', { limite: 2, ...(cursor && { cursor }) }));
      vistos.push(...pagina.items.filter((c: any) => c.notas?.startsWith(marca)).map((c: any) => c.notas));
      cursor = pagina.siguiente ?? undefined;
    } while (cursor);
    expect(vistos).toEqual([4, 3, 2, 1, 0].map((i) => `${marca}-${i}`));
    expect(codigo(await dueno.herramienta('compras_listar', { cursor: 'no-es-un-cursor' }))).toBe('argumentos_invalidos');
  });

  it('filtra por proveedor, estado (abiertas, por recibir) y fechas de entrega', async () => {
    const otro = await crearProveedor(dueno, `Proveedor filtro ${randomUUID().slice(0, 6)}`);
    const a = await crearEnviada(dueno, otro, { entregaEl: '2098-03-01', fecha: '2020-01-01' });
    const b = await crearBorrador(dueno, otro, { entregaEl: '2098-03-20', fecha: '2020-01-01' });
    const ids = async (f: Record<string, unknown>) => datos(await dueno.herramienta('compras_listar', { limite: 100, proveedorId: otro, ...f })).items.map((c: any) => c.id);
    expect(await ids({})).toEqual([b.id, a.id]);
    expect(await ids({ entregaDesde: '2098-03-10' })).toEqual([b.id]);
    expect(await ids({ entregaHasta: '2098-03-10' })).toEqual([a.id]);
    expect(await ids({ estado: 'por_recibir' })).toEqual([a.id]);
    expect(await ids({ estado: 'borrador' })).toEqual([b.id]);
    datos(await recibir(dueno, a, [10_000]));
    expect(await ids({})).toEqual([b.id]);
    expect(await ids({ estado: 'recibida' })).toEqual([a.id]);
    expect(await ids({ estado: 'todas' })).toEqual([b.id, a.id]);
  });
});

describe('aislamiento, permisos y alcance', () => {
  let orden: any;
  beforeAll(async () => {
    orden = await crearBorrador(dueno, proveedor);
  });

  it('otra empresa no ve nada: ni por id, ni en listados, ni para escribir', async () => {
    for (const [nombre, args] of [
      ['compra_ver', { id: orden.id }],
      ['compra_editar', { id: orden.id, notas: 'intruso' }],
      ['compra_enviar', { id: orden.id }],
      ['compra_recibir', { id: orden.id, lineas: [{ ordenLineaId: orden.detalle[0].id, cantidadMilesimas: 1 }] }],
      ['compra_cancelar', { id: orden.id, motivo: 'intruso' }],
    ] as const) {
      expect(codigo(await ajeno.herramienta(nombre, args)), nombre).toBe('no_encontrado');
    }
    expect(datos(await ajeno.herramienta('compras_listar', { estado: 'todas' })).items).toEqual([]);
    expect(datos(await dueno.herramienta('compra_ver', { id: orden.id })).estado).toBe('borrador');
  });

  it('un member con nivel lectura lee y recibe modulo_solo_lectura al escribir', async () => {
    expect(datos(await lector.herramienta('compra_ver', { id: orden.id })).id).toBe(orden.id);
    expect(datos(await lector.herramienta('compras_listar', {})).items.length).toBeGreaterThan(0);
    for (const [nombre, args] of [
      ['compra_crear', { proveedorId: proveedor }],
      ['compra_editar', { id: orden.id, notas: 'x' }],
      ['compra_enviar', { id: orden.id }],
      ['compra_recibir', { id: orden.id, lineas: [{ ordenLineaId: orden.detalle[0].id, cantidadMilesimas: 1 }] }],
      ['compra_cancelar', { id: orden.id, motivo: 'x' }],
    ] as const) {
      const r = await lector.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(codigo(r), nombre).toBe('modulo_solo_lectura');
    }
  });

  it('un member sin el módulo asignado recibe modulo_no_disponible hasta para leer', async () => {
    expect(codigo(await sinModulo.herramienta('compras_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await sinModulo.herramienta('compra_ver', { id: orden.id }))).toBe('modulo_no_disponible');
    expect(codigo(await sinModulo.herramienta('compra_crear', { proveedorId: proveedor }))).toBe('modulo_no_disponible');
  });

  it('con alcance «propios» solo ve y cambia lo que creó; el resumen le responde sin_permiso', async () => {
    expect(codigo(await propio.herramienta('compra_ver', { id: orden.id }))).toBe('no_encontrado');
    expect(codigo(await propio.herramienta('compra_editar', { id: orden.id, notas: 'x' }))).toBe('no_encontrado');
    expect(codigo(await propio.herramienta('compra_enviar', { id: orden.id }))).toBe('no_encontrado');
    const suya = await crearBorrador(propio, proveedor, { notas: 'de la propia' });
    const visibles = datos(await propio.herramienta('compras_listar', { limite: 100, estado: 'todas' })).items.map((c: any) => c.id);
    expect(visibles).toEqual([suya.id]);
    expect(datos(await propio.herramienta('compra_editar', { id: suya.id, notas: 'ya la vi' })).notas).toBe('ya la vi');
    expect(datos(await dueno.herramienta('compra_ver', { id: suya.id })).creadoPor).toBe(propio.usuarioId);
    const r = await propio.herramienta('compras_resumen', { desde: '2026-01-01', hasta: '2026-12-31' });
    expect(codigo(r)).toBe('sin_permiso');
    expect(mensaje(r)).toBe('Tu acceso es solo a tus propios registros.');
  });
});

describe('una orden no se borra; módulo en baja o sin contratar', () => {
  it('capaz_app no puede borrar una orden ni sus recepciones', async () => {
    const c = await crearEnviada(dueno, proveedor);
    datos(await recibir(dueno, c, [1_000]));
    await expect(comoEmpresa(appPool, empresaA, (x) => x.query('delete from compras.ordenes where id = $1', [c.id]))).rejects.toThrow();
    await expect(comoEmpresa(appPool, empresaA, (x) => x.query('delete from compras.recepciones where orden_id = $1', [c.id]))).rejects.toThrow();
    await expect(comoEmpresa(appPool, empresaA, (x) => x.query(`update compras.recepciones set nota = 'x' where orden_id = $1`, [c.id]))).rejects.toThrow();
    expect(datos(await dueno.herramienta('compra_ver', { id: c.id })).recepciones).toHaveLength(1);
  });

  it('empresa sin el módulo contratado: no entra', async () => {
    const nueva = await abrirSesion(app, 'Sin contrato');
    const e = await crearEmpresa(nueva, 'Empresa sin compras');
    await activarModulo(e, 'insumos');
    expect(codigo(await nueva.herramienta('compras_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await nueva.herramienta('compra_crear', { proveedorId: randomUUID() }))).toBe('modulo_no_disponible');
  });

  it('módulo dado de baja: se lee, no se escribe por herramienta ni con un insert directo', async () => {
    const c = await crearEnviada(ajeno, proveedorB);
    await darDeBajaModulo(empresaB, 'compras');
    expect(datos(await ajeno.herramienta('compra_ver', { id: c.id })).totalCentimos).toBe(11_800);
    expect(datos(await ajeno.herramienta('compras_listar', {})).items).toHaveLength(1);
    expect(datos(await ajeno.herramienta('compras_resumen', { desde: '2020-01-01', hasta: '2099-12-31' })).porRecibir).toBe(1);
    for (const [nombre, args] of [
      ['compra_crear', { proveedorId: proveedorB }],
      ['compra_editar', { id: c.id, notas: 'x' }],
      ['compra_enviar', { id: c.id }],
      ['compra_recibir', { id: c.id, lineas: [{ ordenLineaId: c.detalle[0].id, cantidadMilesimas: 1 }] }],
      ['compra_cancelar', { id: c.id, motivo: 'x' }],
    ] as const) {
      expect(codigo(await ajeno.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    await expect(
      comoEmpresa(appPool, empresaB, (x) => x.query(`insert into compras.ordenes (tenant_id, proveedor_id, fecha, creado_por) values ($1, $2, date '2026-01-01', 'u1')`, [empresaB, proveedorB])),
    ).rejects.toThrow(/no está activo/);
    await expect(
      comoEmpresa(appPool, empresaB, (x) => x.query(`insert into compras.recepciones (tenant_id, orden_id, numero, fecha, creado_por) values ($1, $2, 1, date '2026-01-01', 'u1')`, [empresaB, c.id])),
    ).rejects.toThrow(/no está activo/);
  });
});
