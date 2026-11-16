import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { Relevo } from '../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type RespuestaHttp, type Sesion } from '../../core/herramientas/http-de-pruebas.js';
import { codigoDe, confirmando, datosDe, eventosDe } from '../../modules/registro/herramientas/pruebas-de-registro.js';
import { levantarApp, type AppDePruebas } from '../app-de-pruebas.js';
import { abrirPool } from '../base-de-pruebas.js';

// Recorrido de cierre de la ola 3, por HTTP real: compra recibida en dos tandas → el relevo propone la entrada al
// inventario y la deuda por pagar → la persona aprueba en la bandeja; adelanto de sueldo → egreso en «Sueldos» →
// caja del día; el panel de reportes; y los límites de seguridad. Usa solo herramientas públicas.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion; // member con `registro` en lectura
let soloCompras: Sesion; // member con `reportes` y `compras`
let empresaId: string;
let proveedorId: string;
let futuro = Date.now() + 3_600_000;

async function drenar(): Promise<void> {
  const relevo = app.obtener(Relevo);
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}

const exigir = (r: RespuestaHttp, quien: string): any => {
  if (!r.cuerpo?.ok) throw new Error(`«${quien}» respondió ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const pendientes = async (s: Sesion, modulo: string): Promise<any[]> => (await datosDe(s, 'borradores_listar', { modulo, estado: 'pendiente', limite: 100 })).items;
const aprobar = async (s: Sesion, id: string): Promise<any> => exigir((await confirmando(s, 'borrador_aprobar', { id })).respuesta, 'borrador_aprobar');
const centimos = (cantidadMilesimas: number, costoMilesimas: number) => Math.round((cantidadMilesimas * costoMilesimas) / 10_000);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, soloCompras] = await Promise.all(['Dueña del recorrido', 'Lector del recorrido', 'Compradora del recorrido'].map((n) => abrirSesion(app, n)));
  empresaId = await crearEmpresa(dueno, 'Imprenta del recorrido 3');
  for (const modulo of ['registro', 'insumos', 'compras', 'personal', 'reportes']) await activarModulo(empresaId, modulo);
  await agregarMiembro(app, empresaId, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaId, soloCompras, { modulo: 'reportes', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, empresaId, soloCompras, { modulo: 'compras', nivel: 'completo', alcance: 'todos' });
  await datosDe(dueno, 'registro_iniciar');
  proveedorId = (await datosDe(dueno, 'clientes_crear', { nombre: 'Distribuidora Papelera', tipo: 'proveedor' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('recorrido A de la ola 3: de la compra a la deuda y al inventario', () => {
  let articulos: any[];
  let orden: any;
  const recepciones: { id: string; importe: number; cantidades: [number, number] }[] = [];
  const COSTOS = [5_000, 20_000]; // milésimas de sol por unidad

  it('se arma, se envía y se recibe en dos tandas', async () => {
    const productos = await Promise.all(['Papel bond A4', 'Tinta negra'].map(async (nombre) => (await datosDe(dueno, 'productos_crear', { nombre, unidad: 'paquete' })).id as string));
    articulos = [];
    for (const productoId of productos) articulos.push(await datosDe(dueno, 'articulo_activar', { productoId }));

    const borrador = await datosDe(dueno, 'compra_crear', {
      proveedorId,
      lineas: productos.map((productoId, i) => ({ productoId, cantidadMilesimas: i === 0 ? 10_000 : 4_000, costoUnitarioMilesimas: COSTOS[i] })),
    });
    expect(borrador.estado).toBe('borrador');
    orden = await datosDe(dueno, 'compra_enviar', { id: borrador.id });
    expect(orden.estado).toBe('enviada');
    expect(orden.codigo).toMatch(/^OC-/);
    expect(orden.detalle).toHaveLength(2);

    const tandas: [number, number][] = [[4_000, 1_000], [6_000, 3_000]];
    for (const [i, cantidades] of tandas.entries()) {
      const r = await datosDe(dueno, 'compra_recibir', {
        id: orden.id,
        lineas: cantidades.map((cantidadMilesimas, k) => ({ ordenLineaId: orden.detalle[k].id, cantidadMilesimas })),
      });
      expect(r.estado).toBe(i === 0 ? 'recibida_parcial' : 'recibida');
      const ultima = r.recepciones.at(-1);
      recepciones.push({ id: ultima.id, importe: ultima.importeCentimos, cantidades });
    }
    expect(recepciones[0]!.importe).toBe(centimos(4_000, COSTOS[0]!) + centimos(1_000, COSTOS[1]!));
  });

  it('hasta que corre el relevo no hay nada en la bandeja ni en el inventario', async () => {
    expect(await pendientes(dueno, 'insumos')).toEqual([]);
    expect(await pendientes(dueno, 'registro')).toEqual([]);
    expect((await datosDe(dueno, 'articulo_ver', { id: articulos[0].id })).existenciaTotalMilesimas).toBe(0);
  });

  it('el relevo propone dos borradores por recepción: entrada de inventario y deuda por pagar', async () => {
    await drenar();
    const deInventario = (await pendientes(dueno, 'insumos')).filter((b) => b.herramienta === 'existencias_recibir');
    const deDeuda = (await pendientes(dueno, 'registro')).filter((b) => b.herramienta === 'deuda_crear');
    expect(deInventario).toHaveLength(2);
    expect(deDeuda).toHaveLength(2);
    for (const r of recepciones) {
      expect(deInventario.filter((b) => b.args.origenId === r.id)).toHaveLength(1);
      const d = deDeuda.find((b) => b.args.origenId === r.id);
      expect(d.args).toMatchObject({ tipo: 'por_pagar', contactoId: proveedorId, totalCentimos: r.importe, origenTipo: 'compra' });
    }
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_pagar' })).items).toEqual([]); // proponer no escribe
  });

  it('al aprobar, la existencia suma lo recibido y nace una deuda por pagar por cada recepción', async () => {
    for (const b of [...(await pendientes(dueno, 'insumos')), ...(await pendientes(dueno, 'registro'))]) await aprobar(dueno, b.id);

    const totales = [0, 1].map((k) => recepciones.reduce((n, r) => n + r.cantidades[k]!, 0));
    for (const [k, a] of articulos.entries()) expect((await datosDe(dueno, 'articulo_ver', { id: a.id })).existenciaTotalMilesimas).toBe(totales[k]);

    const deudas = (await datosDe(dueno, 'deudas_listar', { tipo: 'por_pagar' })).items;
    expect(deudas).toHaveLength(2);
    for (const r of recepciones) expect(deudas.find((d: any) => d.origenId === r.id)).toMatchObject({ origenTipo: 'compra', totalCentimos: r.importe, tipo: 'por_pagar' });
  });

  it('repetir el relevo no duplica borradores, existencias ni deudas', async () => {
    await drenar();
    expect(await pendientes(dueno, 'insumos')).toEqual([]);
    expect(await pendientes(dueno, 'registro')).toEqual([]);
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_pagar' })).items).toHaveLength(2);
    expect((await datosDe(dueno, 'articulo_ver', { id: articulos[0].id })).existenciaTotalMilesimas).toBe(10_000);
  });
});

describe('recorrido B de la ola 3: adelanto de sueldo', () => {
  const NOMBRE = 'Rosa Quispe Mamani';
  let adelantoId: string;

  it('un adelanto deja un egreso propuesto en «Sueldos», sin el nombre de la persona', async () => {
    const colaborador = await datosDe(dueno, 'colaborador_crear', { nombre: NOMBRE, cargo: 'Operaria' });
    const adelanto = await datosDe(dueno, 'adelanto_registrar', { colaboradorId: colaborador.id, montoCentimos: 15_000 });
    adelantoId = adelanto.id;
    await drenar();

    const propuesto = (await pendientes(dueno, 'registro')).filter((b) => b.origenRef === `adelanto:${adelantoId}`);
    expect(propuesto).toHaveLength(1);
    expect(propuesto[0].herramienta).toBe('movimiento_registrar');
    expect(propuesto[0].args).toMatchObject({ tipo: 'egreso', montoCentimos: 15_000 });
    const sueldos = (await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items.find((c: any) => c.nombre === 'Sueldos');
    expect(propuesto[0].args.categoriaId).toBe(sueldos.id);

    expect(JSON.stringify(propuesto[0])).not.toContain(NOMBRE);
    expect(JSON.stringify(await eventosDe(appPool, empresaId))).not.toContain(NOMBRE);
  });

  it('al aprobarlo el movimiento existe y la caja del día lo refleja', async () => {
    const propuesto = (await pendientes(dueno, 'registro')).find((b) => b.origenRef === `adelanto:${adelantoId}`);
    const aprobado = await aprobar(dueno, propuesto.id);
    const movimiento = await datosDe(dueno, 'movimiento_ver', { id: aprobado.resultado.id });
    expect(movimiento).toMatchObject({ tipo: 'egreso', montoCentimos: 15_000 });

    const caja = await datosDe(dueno, 'caja_del_dia', {});
    expect(caja.totalEgresosCentimos).toBe(15_000);
  });
});

describe('recorrido de reportes de la ola 3', () => {
  const periodo = () => {
    const hoy = new Date().toISOString().slice(0, 10);
    return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  };

  it('el panel trae los bloques de registro, insumos, compras y personal', async () => {
    const panel = await datosDe(dueno, 'reportes_panel', periodo());
    const modulos = panel.bloques.map((b: any) => b.modulo);
    for (const m of ['registro', 'insumos', 'compras', 'personal']) expect(modulos).toContain(m);
  });

  it('el CSV no trae fórmulas activas', async () => {
    const csv = await datosDe(dueno, 'reportes_exportar_csv', periodo());
    expect(csv.contenido.startsWith('﻿')).toBe(true);
    expect(csv.filas).toBeGreaterThan(0);
    for (const linea of csv.contenido.replace('﻿', '').split('\r\n').filter(Boolean)) {
      for (const celda of linea.split(',')) expect(celda.replace(/^"/, '')).not.toMatch(/^[=+@\t\r]/);
    }
  });

  it('un member con acceso solo a compras no ve los demás bloques', async () => {
    const panel = await datosDe(soloCompras, 'reportes_panel', periodo());
    expect(panel.bloques.map((b: any) => b.modulo)).toEqual(['compras']);
    const csv = await datosDe(soloCompras, 'reportes_exportar_csv', periodo());
    expect(csv.contenido).not.toContain('Personal,');
  });
});

describe('recorrido de seguridad de la ola 3', () => {
  it('un member con registro en lectura no aprueba la deuda por pagar (modulo_solo_lectura)', async () => {
    const orden = await datosDe(dueno, 'compra_enviar', {
      id: (await datosDe(dueno, 'compra_crear', { proveedorId, lineas: [{ descripcion: 'Resmas sueltas', cantidadMilesimas: 2_000, costoUnitarioMilesimas: 10_000 }] })).id,
    });
    await datosDe(dueno, 'compra_recibir', { id: orden.id, lineas: [{ ordenLineaId: orden.detalle[0].id, cantidadMilesimas: 2_000 }] });
    await drenar();
    const deuda = (await pendientes(dueno, 'registro')).find((b) => b.herramienta === 'deuda_crear');
    expect(deuda).toBeDefined();

    const { respuesta } = await confirmando(lector, 'borrador_aprobar', { id: deuda.id });
    expect(respuesta.estado).toBe(403);
    expect(codigoDe(respuesta)).toBe('modulo_solo_lectura');
    expect((await pendientes(dueno, 'registro')).some((b) => b.id === deuda.id)).toBe(true);
  });

  it('una salida mayor a la existencia se rechaza con el faltante', async () => {
    const productoId = (await datosDe(dueno, 'productos_crear', { nombre: 'Cartulina', unidad: 'paquete' })).id;
    const articulo = await datosDe(dueno, 'articulo_activar', { productoId });
    await datosDe(dueno, 'existencia_mover', { articuloId: articulo.id, tipo: 'entrada', cantidadMilesimas: 3_500 });
    const r = await dueno.herramienta('existencia_mover', { articuloId: articulo.id, tipo: 'salida', cantidadMilesimas: 5_000 });
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error.mensaje).toBe('No alcanza: hay 3.5 paquete y faltan 1.5 paquete.');
    expect((await datosDe(dueno, 'articulo_ver', { id: articulo.id })).existenciaTotalMilesimas).toBe(3_500);
  });
});
