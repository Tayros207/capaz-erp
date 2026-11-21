import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigo, crearBorrador, crearCliente, datos, linea, mensaje } from './pruebas-de-pedidos.js';

// La ficha de máquina (material, medida, colores, acabado) en las líneas del pedido: crear, editar, confirmar, corregir, fotos y aislamiento.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let trabajador: Sesion;
let ajeno: Sesion;
let empresaA: string;
let cliente: string;

const FICHA = { material: 'couché 300 g', medida: '9 × 5.5 cm', colores: 'full color', acabado: 'plastificado mate' };
const SIN_FICHA = { material: null, medida: null, colores: null, acabado: null };
const conFicha = (extra: Record<string, unknown> = {}) => ({ ...linea('Tarjetas', 0.365, 500), ...FICHA, ...extra });

const versionActual = async (id: unknown): Promise<number> => (await dueno.herramienta('pedido_ver', { id })).cuerpo?.datos?.version ?? 1;
const corregir = async (s: Sesion, args: Record<string, unknown>) => s.herramienta('pedido_corregir', { motivoCodigo: 'lineas', versionEsperada: await versionActual(args.id), ...args });
const confirmado = async (lineas: unknown[] = [conFicha()]) => {
  const p = await crearBorrador(dueno, cliente, { lineas });
  datos(await dueno.herramienta('pedido_confirmar', { id: p.id }));
  return datos(await dueno.herramienta('pedido_ver', { id: p.id }));
};
/** La línea `i` del pedido tal como la espera la corrección, SIN las claves de ficha. */
const sinFichaDe = (p: any, i = 0, extra: Record<string, unknown> = {}) => {
  const l = p.detalle[i];
  return { id: l.id, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas, afectoIgv: l.afectoIgv, ...extra };
};
const fichaDe = (l: any) => ({ material: l.material, medida: l.medida, colores: l.colores, acabado: l.acabado });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, trabajador, ajeno] = await Promise.all(['Dueña', 'Trabajador', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de fichas');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de fichas');
  await Promise.all([activarModulo(empresaA, 'ordenes'), activarModulo(empresaB, 'ordenes')]);
  await agregarMiembro(app, empresaA, trabajador, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  cliente = await crearCliente(dueno, 'Imprenta Ficha');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('ficha de máquina: crear y editar', () => {
  it('I1 la ficha llega al detalle; una línea sin ficha trae cuatro null', async () => {
    const p = await crearBorrador(dueno, cliente, { lineas: [conFicha(), linea('Volantes', 10)] });
    expect(fichaDe(p.detalle[0])).toEqual(FICHA);
    expect(fichaDe(p.detalle[1])).toEqual(SIN_FICHA);
  });

  it('I2 lo vacío queda null y más de 120 caracteres se rechaza', async () => {
    const p = await crearBorrador(dueno, cliente, { lineas: [conFicha({ colores: '   ', acabado: '' })] });
    expect(p.detalle[0]).toMatchObject({ colores: null, acabado: null, material: FICHA.material });
    const r = await dueno.herramienta('pedido_crear', { clienteId: cliente, lineas: [conFicha({ material: 'x'.repeat(121) })] });
    expect(codigo(r)).toBe('argumentos_invalidos');
    expect(mensaje(r)).toContain('120');
  });

  it('I3 la base impone «null o de 1 a 120 caracteres»', async () => {
    const p = await crearBorrador(dueno, cliente, { lineas: [conFicha()] });
    const poner = (valor: string) => comoEmpresa(appPool, empresaA, (c) => c.query('update ordenes.pedido_lineas set material = $2 where id = $1', [p.detalle[0].id, valor]), { confirmar: true });
    await expect(poner('')).rejects.toThrow(/linea_ficha/);
    await expect(poner('x'.repeat(121))).rejects.toThrow();
    await expect(poner('x'.repeat(120))).resolves.toBeDefined();
  });

  it('I4 editar un borrador reemplaza las líneas y la ficha con ellas', async () => {
    const p = await crearBorrador(dueno, cliente, { lineas: [linea('Tarjetas', 1)] });
    expect(fichaDe(p.detalle[0])).toEqual(SIN_FICHA);
    const e = datos(await dueno.herramienta('pedido_editar', { id: p.id, lineas: [conFicha({ medida: 'A4' })] }));
    expect(e.detalle[0]).toMatchObject({ ...FICHA, medida: 'A4' });
  });

  it('I5 al llevarlo a producción la ficha sigue en el pedido (es lo que imprime la orden de trabajo)', async () => {
    const p = await confirmado();
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: p.id, estado: 'en_proceso' }));
    expect(fichaDe(datos(await dueno.herramienta('pedido_ver', { id: p.id })).detalle[0])).toEqual(FICHA);
  });
});

describe('ficha de máquina: corregir', () => {
  it('I6 corregir solo el precio conserva la ficha y la deja en la foto y en la huella', async () => {
    const p = await confirmado();
    const r = datos(await corregir(dueno, { id: p.id, motivoCodigo: 'precio_acordado', lineas: [sinFichaDe(p, 0, { precioUnitarioMilesimas: 300 })] }));
    expect(r.pedido.version).toBe(2);
    expect(fichaDe(r.pedido.detalle[0])).toEqual(FICHA);
    expect(r.pedido.versiones[0].foto.lineas[0]).toMatchObject({ ...FICHA, precioUnitarioMilesimas: 365 });
    const l = r.pedido.historial[0].detalle.correccion.lineas[0];
    expect(l.antes.material).toBe('couché 300 g');
    expect(l.despues.material).toBe('couché 300 g');
  });

  it('I7 un trabajador cambia solo la ficha: versión 2, delta 0 y sin aprobación', async () => {
    const p = await confirmado();
    const r = datos(await corregir(trabajador, { id: p.id, lineas: [sinFichaDe(p, 0, { material: 'couché 350 g' })] }));
    expect(r.pedido.version).toBe(2);
    expect(r.correccion.deltaCentimos).toBe(0);
    expect(r.pedido.detalle[0]).toMatchObject({ material: 'couché 350 g', medida: FICHA.medida });
    expect(r.pedido.versiones[0].foto.lineas[0].material).toBe('couché 300 g');
    expect(r.pedido.historial[0].detalle.correccion.lineas[0]).toMatchObject({ cambio: 'cambiada', antes: { material: 'couché 300 g' }, despues: { material: 'couché 350 g' } });
  });

  it('I8 vacío borra solo ese campo', async () => {
    const p = await confirmado();
    const r = datos(await corregir(dueno, { id: p.id, lineas: [sinFichaDe(p, 0, { material: '', acabado: '   ' })] }));
    expect(r.pedido.detalle[0]).toMatchObject({ material: null, acabado: null, medida: FICHA.medida, colores: FICHA.colores });
  });

  it('I9 mandar la misma ficha no es un cambio', async () => {
    const p = await confirmado();
    const r = await corregir(dueno, { id: p.id, lineas: [sinFichaDe(p, 0, { ...FICHA })] });
    expect(codigo(r)).toBe('argumentos_invalidos');
    expect(mensaje(r)).toMatch(/No hay nada que cambiar/);
  });

  it('I10 un pedido entregado no admite cambiar la ficha, pero sí el IGV', async () => {
    const p = await confirmado();
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: p.id, estado: 'entregado' }));
    expect(mensaje(await corregir(dueno, { id: p.id, lineas: [sinFichaDe(p, 0, { material: 'otro' })] }))).toMatch(/solo se corrige el precio o el IGV/);
    const ok = datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 18_000, motivoCodigo: 'igv' }));
    expect(fichaDe(ok.pedido.detalle[0])).toEqual(FICHA);
  });
});

describe('ficha de máquina: fotos viejas y aislamiento', () => {
  it('I11 una foto anterior a la 0036 (sin ficha) se lee con cuatro null', async () => {
    const p = await confirmado([linea('Antiguo', 10)]);
    const l = p.detalle[0];
    const foto = {
      estado: 'confirmado', clienteId: p.clienteId, clienteNombre: p.clienteNombre, fecha: p.fecha, entregaEl: null, notas: null, igvPorcentaje: p.igvPorcentaje,
      subtotalCentimos: p.subtotalCentimos, igvCentimos: p.igvCentimos, totalCentimos: p.totalCentimos,
      lineas: [{ id: l.id, posicion: l.posicion, productoId: null, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas, afectoIgv: l.afectoIgv, importeCentimos: l.importeCentimos }],
    };
    await comoEmpresa(
      appPool,
      empresaA,
      (c) => c.query(`insert into ordenes.pedido_versiones (tenant_id, pedido_id, version, foto, motivo_codigo, creado_por) values ($1, $2, 1, $3, 'otro', 'prueba')`, [empresaA, p.id, JSON.stringify(foto)]),
      { confirmar: true },
    );
    const r = await dueno.herramienta('pedido_ver', { id: p.id });
    expect(r.estado).toBe(200);
    expect(fichaDe(r.cuerpo.datos.versiones[0].foto.lineas[0])).toEqual(SIN_FICHA);
  });

  it('I12 otra empresa no ve el pedido', async () => {
    const p = await confirmado();
    expect(codigo(await ajeno.herramienta('pedido_ver', { id: p.id }))).toBe('no_encontrado');
  });
});
