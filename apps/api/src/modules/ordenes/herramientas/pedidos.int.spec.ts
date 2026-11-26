import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { codigo, crearBorrador, crearCliente, crearProducto, datos, eventosDe, linea, mensaje } from './pruebas-de-pedidos.js';

// Pedidos por HTTP real, parte 1: borradores (crear, editar, ver, listar, anotar) con dos empresas,
// un member de solo lectura, uno sin el módulo y uno con alcance «propios».

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: ordenes en lectura
let sinModulo: Sesion; // member de A: solo crm
let propio: Sesion; // member de A: ordenes completo, alcance propios
let ajeno: Sesion; // owner de B
let empresaA: string;
let empresaB: string;
let cliente: string;
let clienteB: string;
let tarjetas: string; // S/ 118.00 afecto
let libro: string; // S/ 50.00 no afecto

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, sinModulo, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Sin módulo', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de pedidos');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de pedidos');
  // «crm» se activa en A solo para poder asignárselo al miembro que no tiene pedidos (la base exige que esté contratado).
  await Promise.all([activarModulo(empresaA, 'ordenes'), activarModulo(empresaA, 'crm'), activarModulo(empresaB, 'ordenes')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, sinModulo, { modulo: 'crm', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  clienteB = await crearCliente(ajeno, 'Cliente de B');
  tarjetas = await crearProducto(dueno, 'Tarjetas de presentación', { unidad: 'millar', precioUnitarioMilesimas: 118_000 });
  libro = await crearProducto(dueno, 'Libro de cuentos', { precioUnitarioMilesimas: 50_000, afectoIgv: false });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('pedido_crear', () => {
  it('un borrador con tres líneas (una sin producto, una no afecta) devuelve los totales de la prueba unitaria', async () => {
    const r = await dueno.herramienta('pedido_crear', {
      clienteId: cliente,
      entregaEl: '2099-01-10',
      fecha: '2099-01-02',
      notas: '  Entregar en tienda ',
      lineas: [{ productoId: tarjetas, cantidadMilesimas: 1000 }, linea('Diseño de logotipo', 0.1), { productoId: libro, cantidadMilesimas: 2000 }],
    });
    expect(r.estado).toBe(200);
    const p = datos(r);
    expect(p).toMatchObject({
      codigo: 'Borrador', numero: null, serie: null, anio: null, estado: 'borrador', clienteId: cliente, clienteNombre: 'Imprenta Sol',
      fecha: '2099-01-02', entregaEl: '2099-01-10', atrasado: false, notas: 'Entregar en tienda', igvPorcentaje: 18,
      subtotalCentimos: 20_008, igvCentimos: 1_802, totalCentimos: 21_810, lineas: 3, creadoPor: dueno.usuarioId,
    });
    expect(p.detalle.map((l: any) => [l.posicion, l.descripcion, l.unidad, l.afectoIgv, l.importeCentimos])).toEqual([
      [0, 'Tarjetas de presentación', 'millar', true, 11_800],
      [1, 'Diseño de logotipo', 'unidad', true, 10],
      [2, 'Libro de cuentos', 'unidad', false, 10_000],
    ]);
    expect(p.historial).toMatchObject([{ tipo: 'creado', estadoNuevo: 'borrador', usuarioId: dueno.usuarioId }]);
    // Crear un borrador no emite nada: los eventos del módulo empiezan al confirmar.
    expect((await eventosDe(appPool, empresaA)).filter((e) => e.tipo.startsWith('pedido.'))).toEqual([]);
  });

  it('sin líneas se guarda (borrador vacío) y la fecha por defecto es hoy', async () => {
    const p = datos(await dueno.herramienta('pedido_crear', { clienteId: cliente }));
    expect(p).toMatchObject({ lineas: 0, totalCentimos: 0, detalle: [] });
    expect(p.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('validación: campo inválido, campo de más, línea incompleta y argumentos de contexto', async () => {
    for (const args of [
      { clienteId: 'no-es-uuid' },
      { clienteId: cliente, descuento: 10 },
      { clienteId: cliente, lineas: [{ descripcion: 'Sin precio', cantidadMilesimas: 1000 }] },
      { clienteId: cliente, lineas: [{ ...linea('Con decimales', 1), cantidadMilesimas: 1.5 }] },
      { clienteId: cliente, lineas: [{ ...linea('Cero', 1), cantidadMilesimas: 0 }] },
      { clienteId: cliente, origenTipo: 'cotizacion' },
    ]) {
      const r = await dueno.herramienta('pedido_crear', args);
      expect(r.estado, JSON.stringify(args)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
    }
    expect(codigo(await dueno.herramienta('pedido_crear', { clienteId: cliente, empresaId: empresaB }))).toBe('argumento_prohibido');
    expect(codigo(await dueno.herramienta('pedido_crear', { clienteId: cliente, usuarioId: 'otro' }))).toBe('argumento_prohibido');
  });

  it('rechaza lo que no existe: cliente, producto, sucursal, responsable; y la entrega anterior a la fecha', async () => {
    const casos: Array<[Record<string, unknown>, RegExp]> = [
      [{ clienteId: randomUUID() }, /cliente/],
      [{ clienteId: clienteB }, /cliente/],
      [{ clienteId: cliente, lineas: [{ productoId: randomUUID(), cantidadMilesimas: 1000 }] }, /Línea 1: el producto/],
      [{ clienteId: cliente, sucursalId: randomUUID() }, /sucursal/],
      [{ clienteId: cliente, responsableId: ajeno.usuarioId }, /responsable/],
      [{ clienteId: cliente, fecha: '2099-01-10', entregaEl: '2099-01-09' }, /entrega/],
    ];
    for (const [args, patron] of casos) {
      const r = await dueno.herramienta('pedido_crear', args);
      expect(codigo(r), JSON.stringify(args)).toBe('argumentos_invalidos');
      expect(mensaje(r)).toMatch(patron);
    }
    const archivado = await crearProducto(dueno, 'Producto retirado', { precioUnitarioMilesimas: 1000 });
    datos(await dueno.herramienta('productos_archivar', { id: archivado }));
    expect(mensaje(await dueno.herramienta('pedido_crear', { clienteId: cliente, lineas: [{ productoId: archivado, cantidadMilesimas: 1000 }] }))).toMatch(/archivado/);
  });

  it('la misma clave de idempotencia no crea dos pedidos', async () => {
    const clave = `ped-${randomUUID()}`;
    const args = { clienteId: cliente, notas: 'idempotente', lineas: [linea('Único', 5)] };
    const a = datos(await dueno.herramienta('pedido_crear', args, { clave }));
    const b = datos(await dueno.herramienta('pedido_crear', args, { clave }));
    expect(b.id).toBe(a.id);
    const lista = datos(await dueno.herramienta('pedidos_listar', { limite: 100 }));
    expect(lista.items.filter((p: any) => p.notas === 'idempotente')).toHaveLength(1);
    expect(codigo(await dueno.herramienta('pedido_crear', { ...args, notas: 'otros datos' }, { clave }))).toBe('conflicto');
  });

  it('un origen solo tiene un pedido vivo: el segundo es conflicto y señala al primero', async () => {
    const origen = { origenTipo: 'cotizacion', origenId: `cot-${randomUUID()}` };
    const primero = await crearBorrador(dueno, cliente, origen);
    const r = await dueno.herramienta('pedido_crear', { clienteId: cliente, ...origen });
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error.candidatas).toEqual([{ id: primero.id, nombre: 'Borrador' }]);
  });
});

describe('pedido_editar y pedido_anotar', () => {
  it('reemplaza todas las líneas y recalcula; cambia y borra opcionales; deja «editado» en el historial', async () => {
    const p = await crearBorrador(dueno, cliente, { notas: 'nota inicial', entregaEl: '2099-05-01', fecha: '2099-04-01' });
    const r = datos(await dueno.herramienta('pedido_editar', { id: p.id, notas: null, entregaEl: '2099-05-02', responsableId: lector.usuarioId, lineas: [linea('A', 0.1), linea('B', 0.1), linea('C', 0.1)] }));
    expect(r).toMatchObject({ notas: null, entregaEl: '2099-05-02', responsableId: lector.usuarioId, lineas: 3, subtotalCentimos: 24, igvCentimos: 6, totalCentimos: 30 });
    expect(r.detalle.map((l: any) => l.descripcion)).toEqual(['A', 'B', 'C']);
    expect(r.historial.map((h: any) => h.tipo)).toEqual(['editado', 'creado']);
    const vacio = datos(await dueno.herramienta('pedido_editar', { id: p.id, lineas: [] }));
    expect(vacio).toMatchObject({ lineas: 0, totalCentimos: 0, subtotalCentimos: 0, igvCentimos: 0 });
  });

  it('exige al menos un cambio, no admite cambiar la fecha y respeta la regla de la entrega', async () => {
    const p = await crearBorrador(dueno, cliente, { fecha: '2099-04-10' });
    expect(codigo(await dueno.herramienta('pedido_editar', { id: p.id }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('pedido_editar', { id: p.id, fecha: '2099-04-11' }))).toBe('argumentos_invalidos');
    expect(mensaje(await dueno.herramienta('pedido_editar', { id: p.id, entregaEl: '2099-04-09' }))).toMatch(/entrega/);
    expect(codigo(await dueno.herramienta('pedido_editar', { id: randomUUID(), notas: 'x' }))).toBe('no_encontrado');
  });

  it('una nota queda en el historial y no cambia el pedido', async () => {
    const p = await crearBorrador(dueno, cliente);
    const r = datos(await dueno.herramienta('pedido_anotar', { id: p.id, nota: ' Recoge el viernes ' }));
    expect(r.historial[0]).toMatchObject({ tipo: 'nota', nota: 'Recoge el viernes', usuarioId: dueno.usuarioId });
    expect(r.totalCentimos).toBe(p.totalCentimos);
    expect(codigo(await dueno.herramienta('pedido_anotar', { id: p.id, nota: '   ' }))).toBe('argumentos_invalidos');
  });
});

describe('listado', () => {
  it('pagina con cursor del más nuevo al más antiguo, sin repetir ni saltar', async () => {
    const marca = `pag-${randomUUID()}`;
    for (let i = 0; i < 5; i++) await crearBorrador(dueno, cliente, { notas: `${marca}-${i}` });
    const vistos: string[] = [];
    let cursor: string | undefined;
    do {
      const pagina = datos(await dueno.herramienta('pedidos_listar', { limite: 2, ...(cursor && { cursor }) }));
      vistos.push(...pagina.items.filter((p: any) => p.notas?.startsWith(marca)).map((p: any) => p.notas));
      cursor = pagina.siguiente ?? undefined;
    } while (cursor);
    expect(vistos).toEqual([4, 3, 2, 1, 0].map((i) => `${marca}-${i}`));
    expect(codigo(await dueno.herramienta('pedidos_listar', { cursor: 'no-es-un-cursor' }))).toBe('argumentos_invalidos');
  });

  it('filtra por cliente, responsable y fechas de entrega', async () => {
    const otro = await crearCliente(dueno, `Cliente filtro ${randomUUID().slice(0, 6)}`);
    const a = await crearBorrador(dueno, otro, { entregaEl: '2098-03-01', fecha: '2098-01-01', responsableId: propio.usuarioId });
    const b = await crearBorrador(dueno, otro, { entregaEl: '2098-03-20', fecha: '2098-01-01' });
    const ids = async (f: Record<string, unknown>) => datos(await dueno.herramienta('pedidos_listar', { limite: 100, clienteId: otro, ...f })).items.map((p: any) => p.id);
    expect(await ids({})).toEqual([b.id, a.id]);
    expect(await ids({ entregaDesde: '2098-03-10' })).toEqual([b.id]);
    expect(await ids({ entregaHasta: '2098-03-10' })).toEqual([a.id]);
    expect(await ids({ responsableId: propio.usuarioId })).toEqual([a.id]);
    expect(await ids({ estado: 'entregado' })).toEqual([]);
    expect(await ids({ estado: 'borrador' })).toEqual([b.id, a.id]);
  });
});

describe('aislamiento, permisos y alcance', () => {
  let pedido: any;
  beforeAll(async () => {
    pedido = await crearBorrador(dueno, cliente);
  });

  it('otra empresa no ve nada: ni por id, ni en listados, ni para escribir', async () => {
    expect(codigo(await ajeno.herramienta('pedido_ver', { id: pedido.id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('pedido_editar', { id: pedido.id, notas: 'intruso' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('pedido_anotar', { id: pedido.id, nota: 'intruso' }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('pedidos_listar', { estado: 'todos' })).items).toEqual([]);
    expect(datos(await dueno.herramienta('pedido_ver', { id: pedido.id })).historial).toHaveLength(1);
  });

  it('un member con nivel lectura lee y recibe modulo_solo_lectura al escribir', async () => {
    expect(datos(await lector.herramienta('pedido_ver', { id: pedido.id })).id).toBe(pedido.id);
    expect(datos(await lector.herramienta('pedidos_listar', {})).items.length).toBeGreaterThan(0);
    for (const [nombre, args] of [
      ['pedido_crear', { clienteId: cliente }],
      ['pedido_editar', { id: pedido.id, notas: 'x' }],
      ['pedido_anotar', { id: pedido.id, nota: 'x' }],
    ] as const) {
      const r = await lector.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(codigo(r), nombre).toBe('modulo_solo_lectura');
    }
  });

  it('un member sin el módulo asignado recibe modulo_no_disponible hasta para leer', async () => {
    expect(codigo(await sinModulo.herramienta('pedidos_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await sinModulo.herramienta('pedido_ver', { id: pedido.id }))).toBe('modulo_no_disponible');
    expect(codigo(await sinModulo.herramienta('pedido_crear', { clienteId: cliente }))).toBe('modulo_no_disponible');
  });

  it('con alcance «propios» solo ve y cambia lo que creó o tiene a cargo', async () => {
    expect(codigo(await propio.herramienta('pedido_ver', { id: pedido.id }))).toBe('no_encontrado');
    expect(codigo(await propio.herramienta('pedido_editar', { id: pedido.id, notas: 'x' }))).toBe('no_encontrado');
    expect(codigo(await propio.herramienta('pedido_anotar', { id: pedido.id, nota: 'x' }))).toBe('no_encontrado');
    const suyo = await crearBorrador(propio, cliente, { notas: 'del propio' });
    const aCargo = await crearBorrador(dueno, cliente, { responsableId: propio.usuarioId, notas: 'a cargo' });
    const visibles = datos(await propio.herramienta('pedidos_listar', { limite: 100, estado: 'todos' })).items.map((p: any) => p.id);
    expect(visibles).toContain(suyo.id);
    expect(visibles).toContain(aCargo.id);
    expect(visibles).not.toContain(pedido.id);
    expect(datos(await propio.herramienta('pedido_editar', { id: aCargo.id, notas: 'ya lo vi' })).notas).toBe('ya lo vi');
    expect(datos(await dueno.herramienta('pedido_ver', { id: suyo.id })).creadoPor).toBe(propio.usuarioId);
  });
});

describe('un pedido no se borra y el módulo en baja es de solo lectura', () => {
  it('capaz_app no puede borrar un pedido ni tocar su historial', async () => {
    const p = await crearBorrador(dueno, cliente);
    await expect(comoEmpresa(appPool, empresaA, (c) => c.query('delete from ordenes.pedidos where id = $1', [p.id]))).rejects.toThrow();
    await expect(comoEmpresa(appPool, empresaA, (c) => c.query(`update ordenes.pedido_eventos set nota = 'x' where pedido_id = $1`, [p.id]))).rejects.toThrow();
    await expect(comoEmpresa(appPool, empresaA, (c) => c.query('delete from ordenes.pedido_eventos where pedido_id = $1', [p.id]))).rejects.toThrow();
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).historial).toHaveLength(1);
  });

  it('empresa sin el módulo contratado: no entra', async () => {
    const nueva = await abrirSesion(app, 'Sin contrato');
    await crearEmpresa(nueva, 'Empresa sin pedidos');
    expect(codigo(await nueva.herramienta('pedidos_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await nueva.herramienta('pedido_crear', { clienteId: randomUUID() }))).toBe('modulo_no_disponible');
  });

  it('módulo dado de baja: se lee, no se escribe por herramienta ni con un insert directo', async () => {
    const p = datos(await ajeno.herramienta('pedido_crear', { clienteId: clienteB, lineas: [linea('Antes de la baja', 10)] }));
    await darDeBajaModulo(empresaB, 'ordenes');
    expect(datos(await ajeno.herramienta('pedido_ver', { id: p.id })).totalCentimos).toBe(1000);
    expect(datos(await ajeno.herramienta('pedidos_listar', {})).items).toHaveLength(1);
    for (const [nombre, args] of [
      ['pedido_crear', { clienteId: clienteB }],
      ['pedido_editar', { id: p.id, notas: 'x' }],
      ['pedido_anotar', { id: p.id, nota: 'x' }],
      ['pedido_confirmar', { id: p.id }],
      ['pedido_cambiar_estado', { id: p.id, estado: 'listo' }],
      ['pedido_cancelar', { id: p.id, motivo: 'x' }],
    ] as const) {
      expect(codigo(await ajeno.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    await expect(
      comoEmpresa(appPool, empresaB, (c) => c.query(`insert into ordenes.pedidos (tenant_id, cliente_id, fecha, creado_por) values ($1, $2, date '2026-01-01', 'u1')`, [empresaB, clienteB])),
    ).rejects.toThrow(/no está activo/);
    await expect(
      comoEmpresa(appPool, empresaB, (c) => c.query(`insert into ordenes.pedido_eventos (tenant_id, pedido_id, tipo, usuario_id) values ($1, $2, 'nota', 'u1')`, [empresaB, p.id])),
    ).rejects.toThrow(/no está activo/);
  });
});

describe('IGV opcional por pedido (conIgv)', () => {
  it('sin IGV el pedido no desglosa nada; con IGV calcula el 18 % y se puede encender y apagar en el borrador', async () => {
    const sin = datos(await dueno.herramienta('pedido_crear', { clienteId: cliente, conIgv: false, lineas: [linea('Volantes', 100)] }));
    expect(sin).toMatchObject({ igvPorcentaje: 0, subtotalCentimos: 10_000, igvCentimos: 0, totalCentimos: 10_000 });

    const encendido = datos(await dueno.herramienta('pedido_editar', { id: sin.id, conIgv: true, lineas: [linea('Volantes', 100)] }));
    expect(encendido).toMatchObject({ igvPorcentaje: 18, subtotalCentimos: 8_475, igvCentimos: 1_525, totalCentimos: 10_000 });

    const apagado = datos(await dueno.herramienta('pedido_editar', { id: sin.id, conIgv: false, lineas: [linea('Volantes', 100)] }));
    expect(apagado).toMatchObject({ igvPorcentaje: 0, igvCentimos: 0, totalCentimos: 10_000 });
  });

  it('sin decirlo se conserva el IGV de siempre (18 %); se quita y se pone sin reenviar las líneas, que quedan iguales', async () => {
    const p = datos(await dueno.herramienta('pedido_crear', { clienteId: cliente, lineas: [linea('Volantes', 100)] }));
    expect(p.igvPorcentaje).toBe(18);
    const sin = datos(await dueno.herramienta('pedido_editar', { id: p.id, conIgv: false }));
    expect(sin).toMatchObject({ igvPorcentaje: 0, subtotalCentimos: 10_000, igvCentimos: 0, totalCentimos: 10_000 });
    expect(sin.detalle).toEqual(p.detalle);
    const con = datos(await dueno.herramienta('pedido_editar', { id: p.id, conIgv: true }));
    expect(con).toMatchObject({ igvPorcentaje: 18, subtotalCentimos: 8_475, igvCentimos: 1_525, totalCentimos: 10_000 });
  });
});
