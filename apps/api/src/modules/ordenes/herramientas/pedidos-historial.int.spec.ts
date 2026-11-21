import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { diaMas } from '../../../pruebas/fechas.js';
import { codigo, confirmarCritica, crearBorrador, crearCliente, datos, mensaje } from './pruebas-de-pedidos.js';

// Importador del historial por HTTP real. Todos los nombres son inventados.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let miembro: Sesion;
let ajeno: Sesion;
let duenoC: Sesion;
let A: string;
let B: string;
let C: string;

const filas = (e: string, sql: string) => comoEmpresa(appPool, e, async (c) => (await c.query(sql)).rows as any[]);
const cab = 'fecha,cliente,descripcion,total';
const archivo = (...l: string[]) => [cab, ...l].join('\n');
const previa = (s: Sesion, contenido: string, extra: Record<string, unknown> = {}) => s.herramienta('pedidos_importar_historial_previsualizar', { contenido, ...extra });
const aplicar = (s: Sesion, contenido: string, extra: Record<string, unknown> = {}) => confirmarCritica(s, 'pedidos_importar_historial', { contenido, ...extra });
const hist = (e: string) => filas(e, `select p.*, (select count(*)::int from ordenes.pedido_lineas l where l.pedido_id = p.id) as n_lineas from ordenes.pedidos p where p.serie = 'HIST' order by p.numero`);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, miembro, ajeno, duenoC] = await Promise.all(['Dueña', 'Miembro', 'Ajena', 'Dueña C'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Empresa A de historial');
  B = await crearEmpresa(ajeno, 'Empresa B de historial');
  C = await crearEmpresa(duenoC, 'Empresa C de historial');
  await Promise.all([A, B, C].map((e) => activarModulo(e, 'ordenes')));
  miembro = await agregarMiembro(app, A, miembro, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('importar el historial', () => {
  const dias = () => [diaMas(-400), diaMas(-300)];
  const csv = () => {
    const d = dias();
    return archivo(`${d[0]},Cliente Uno de Prueba,Tarjetas x1000,80.50`, `${d[1]},Cliente Dos de Prueba,Volantes,120`, `${d[1]},(sin nombre),Sellos,30`);
  };

  it('la vista previa no escribe nada y cuenta clientes por crear', async () => {
    const r = datos(await previa(dueno, csv(), { crearClientesFaltantes: true }));
    expect(r).toMatchObject({ total: 3, nuevas: 3, erroresTotal: 0, duplicadasTotal: 0, clientesPorCrearTotal: 3, totalCentimos: 23050, primeraFecha: dias()[0], ultimaFecha: dias()[1] });
    expect(r.clientesPorCrear).toContain('Clientes varios (historial)');
    expect(await hist(A)).toHaveLength(0);
    expect(await filas(A, 'select 1 from core.clientes')).toHaveLength(0);
  });

  it('un cliente faltante es error de fila; con la casilla se crea', async () => {
    const sin = datos(await previa(dueno, csv()));
    expect(sin.erroresTotal).toBe(2);
    expect(sin.errores[0].motivo).toBe('No existe el cliente «Cliente Uno de Prueba»: créalo antes o marca «Crear los clientes que falten».');
    const r = datos(await aplicar(dueno, csv(), { crearClientesFaltantes: true }));
    expect(r).toMatchObject({ creadas: 3, clientesCreados: 3, erroresTotal: 0 });
  });

  it('aplica pedidos HIST entregados, IGV 0, una línea y marca importado', async () => {
    const p = await hist(A);
    // Numeración por año, del más antiguo al más reciente, desde 1 y bajo la serie HIST.
    const vistos = new Map<number, number>();
    for (const x of [...p].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.numero - b.numero)) {
      const n = (vistos.get(x.anio) ?? 0) + 1;
      vistos.set(x.anio, n);
      expect([x.serie, x.numero]).toEqual(['HIST', n]);
    }
    const uno = p.find((x) => Number(x.total_centimos) === 8050)!;
    expect(uno).toMatchObject({ estado: 'entregado', igv_porcentaje: 0, origen_tipo: 'importacion', n_lineas: 1, fecha: expect.anything() });
    expect(Number(uno.total_centimos)).toBe(8050);
    expect(Number(uno.igv_centimos)).toBe(0);
    expect(uno.datos_extra).toMatchObject({ importado: true });
    expect(uno.creado_en.toISOString()).toBe(`${dias()[0]}T12:00:00.000Z`);
    const [l] = await filas(A, `select * from ordenes.pedido_lineas where pedido_id = '${uno.id}'`);
    expect(l).toMatchObject({ posicion: 0, producto_id: null, unidad: 'unidad', afecto_igv: false, material: null });
    expect([Number(l.cantidad_milesimas), Number(l.precio_unitario_milesimas), Number(l.importe_centimos)]).toEqual([1000, 80500, 8050]);
  });

  it('no deja eventos de pedido, historial de pedido ni deudas', async () => {
    expect(await filas(A, `select 1 from core.eventos_salida where tipo like 'pedido.%'`)).toHaveLength(0);
    expect(await filas(A, 'select 1 from ordenes.pedido_eventos')).toHaveLength(0);
    expect(await filas(A, 'select 1 from registro.deudas')).toHaveLength(0);
  });

  it('el pedido siguiente de la sucursal principal sigue siendo el número 1', async () => {
    const cliente = await crearCliente(dueno, 'Cliente Tres de Prueba');
    const b = await crearBorrador(dueno, cliente);
    const c = datos(await dueno.herramienta('pedido_confirmar', { id: b.id }));
    expect(c.numero).toBe(1);
    expect(c.codigo).not.toContain('HIST');
  });

  it('reimportar el mismo archivo da 0 creadas y Clientes varios existe una sola vez', async () => {
    const r = datos(await aplicar(dueno, csv(), { crearClientesFaltantes: true }));
    expect(r).toMatchObject({ creadas: 0, duplicadasTotal: 3, clientesCreados: 0 });
    expect(await hist(A)).toHaveLength(3);
    expect(await filas(A, `select 1 from core.clientes where nombre = 'Clientes varios (historial)'`)).toHaveLength(1);
    expect(datos(await previa(dueno, csv(), { crearClientesFaltantes: true })).nuevas).toBe(0);
  });

  it('dos filas idénticas del archivo se importan las dos', async () => {
    const f = `${diaMas(-200)},Cliente Uno de Prueba,Trabajo repetido,10`;
    const r = datos(await aplicar(dueno, archivo(f, f)));
    expect(r.creadas).toBe(2);
  });

  it('un trabajo importado y luego cancelado cuenta como repetido al reimportar', async () => {
    const f = `${diaMas(-250)},Cliente Uno de Prueba,Trabajo cancelado después,15`;
    expect(datos(await aplicar(dueno, archivo(f))).creadas).toBe(1);
    // Un pedido entregado no se cancela por la herramienta: se simula con la base (p. ej. una carga anterior o una corrección).
    await comoEmpresa(appPool, A, (c) => c.query(`update ordenes.pedidos set estado = 'cancelado', cancelado_en = now() where serie = 'HIST' and total_centimos = 1500`), { confirmar: true });
    const r = datos(await aplicar(dueno, archivo(f)));
    expect(r).toMatchObject({ creadas: 0, duplicadasTotal: 1 });
  });

  it('pedido_crear no acepta el origen «importacion» (es del importador)', async () => {
    const c = await crearCliente(dueno, 'Cliente Origen de Prueba');
    const r = await dueno.herramienta('pedido_crear', { clienteId: c, origenTipo: 'importacion', origenId: 'huella-falsa', lineas: [{ descripcion: 'Algo', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1000 }] });
    expect(codigo(r)).toBe('argumentos_invalidos');
    expect(mensaje(r)).toBe('Ese origen está reservado para el historial importado.');
  });

  it('un miembro que no es dueño ni administrador es rechazado', async () => {
    const r = await previa(miembro, csv());
    expect(codigo(r)).toBe('sin_permiso');
    expect(mensaje(r)).toBe('Solo el dueño o un administrador importa el historial.');
    expect(codigo(await miembro.herramienta('pedidos_importar_historial', { contenido: csv() }))).toBe('sin_permiso');
  });

  it('crear una sucursal con el código HIST se rechaza', async () => {
    const r = await duenoC.herramienta('sucursal_crear', { codigo: 'hist', nombre: 'Sucursal reservada' });
    expect(codigo(r)).toBe('argumentos_invalidos');
    expect(mensaje(r)).toBe('El código HIST está reservado para el historial importado.');
  });

  it('una sucursal con código HIST es conflicto', async () => {
    // Ya no se puede crear con ese código (ver la prueba siguiente): se simula una sucursal anterior a la regla.
    await comoEmpresa(appPool, C, (c) => c.query(`insert into core.sucursales (tenant_id, codigo, nombre) values ($1, 'HIST', 'Sucursal de prueba')`, [C]), { confirmar: true });
    const r = await previa(duenoC, csv(), { crearClientesFaltantes: true });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toContain('«Sucursal de prueba» usa el código HIST');
  });

  it('no resuelve clientes de otra empresa', async () => {
    await crearCliente(ajeno, 'Cliente Ajeno de Prueba');
    const r = datos(await previa(dueno, archivo(`${diaMas(-100)},Cliente Ajeno de Prueba,Algo,10`)));
    expect(r).toMatchObject({ nuevas: 0, erroresTotal: 1 });
  });

  it('errores de archivo y de fila por la herramienta', async () => {
    expect(codigo(await previa(dueno, 'fecha,cliente,descripcion\n2023-01-01,A,B'))).toBe('argumentos_invalidos');
    const r = datos(await previa(dueno, archivo(`${diaMas(-1)},Cliente Uno de Prueba,Algo,0`, `${diaMas(-3000)},Cliente Uno de Prueba,Viejo,10`)));
    expect(r).toMatchObject({ erroresTotal: 1, omitidasPorFecha: 1, nuevas: 0 });
  });

  it('la recompra aparece con el historial importado', async () => {
    const e = await crearEmpresa(duenoC, 'Empresa D de historial');
    await activarModulo(e, 'ordenes');
    const l = Array.from({ length: 6 }, (_, i) => `${diaMas(-60 - 7 * i)},Cliente Recompra de Prueba,Trabajo ${i},50`);
    datos(await aplicar(duenoC, archivo(...l), { crearClientesFaltantes: true }));
    const t = datos(await duenoC.herramienta('ordenes_pendientes', {})).tarjetas.filter((x: any) => x.grupo === 'recompra');
    expect(t.map((x: any) => x.titulo)).toEqual(['Llamar a Cliente Recompra de Prueba']);
  });
});

describe('importar 1,000 filas', () => {
  it('entra en menos de 60 s y reimportar da 0 creadas', async () => {
    const l = Array.from({ length: 1000 }, (_, i) => `${diaMas(-30 - (i % 900))},Cliente Masivo ${i % 50} de Prueba,Trabajo masivo número ${i},${10 + (i % 90)}.50`);
    const contenido = archivo(...l);
    const t0 = performance.now();
    const r = datos(await aplicar(dueno, contenido, { crearClientesFaltantes: true }));
    const seg = (performance.now() - t0) / 1000;
    console.log(`1,000 filas importadas en ${seg.toFixed(1)} s`);
    expect(r).toMatchObject({ creadas: 1000, clientesCreados: 50, erroresTotal: 0 });
    expect(seg).toBeLessThan(60);
    expect(datos(await aplicar(dueno, contenido, { crearClientesFaltantes: true }))).toMatchObject({ creadas: 0, duplicadasTotal: 1000 });
    expect(B).not.toBe(A);
  }, 120_000);
});
