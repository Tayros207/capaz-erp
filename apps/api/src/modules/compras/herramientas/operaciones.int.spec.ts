import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { activarCompras, codigo, crearEnviada, crearProducto, crearProveedor, datos, eventosDe, linea, mensaje, recibir } from './pruebas-de-compras.js';

// Compras · operaciones (0026) por HTTP real: solicitudes de compra con aprobación y facturas del proveedor conciliadas.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion; // member de A: compras en lectura
let ajeno: Sesion; // owner de B
let empresaA: string;
let proveedor: string;
let papel: string;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de solicitudes');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de solicitudes');
  await Promise.all([activarCompras(empresaA), activarCompras(empresaB)]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'compras', nivel: 'lectura', alcance: 'todos' });
  proveedor = await crearProveedor(dueno, 'Papelera Andina');
  papel = await crearProducto(dueno, 'Papel bond A4', { unidad: 'millar' });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('solicitudes de compra', () => {
  let id: string;

  it('crea un borrador sin número, tomando nombre y unidad del producto', async () => {
    const s = datos(await dueno.herramienta('solicitud_crear', { area: 'Producción', motivo: 'Reposición', lineas: [{ productoId: papel, cantidadMilesimas: 10_000 }, { descripcion: 'Flete', cantidadMilesimas: 1_000 }] }));
    id = s.id;
    expect(s).toMatchObject({ estado: 'borrador', codigo: null, numero: null, area: 'Producción' });
    expect(s.lineas).toEqual([
      { posicion: 1, productoId: papel, descripcion: 'Papel bond A4', unidad: 'millar', cantidadMilesimas: 10_000 },
      { posicion: 2, productoId: null, descripcion: 'Flete', unidad: 'unidad', cantidadMilesimas: 1_000 },
    ]);
  });

  it('rechaza líneas inválidas, producto inexistente y necesidad anterior a la fecha', async () => {
    expect(codigo(await dueno.herramienta('solicitud_crear', { lineas: [] }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('solicitud_crear', { lineas: [{ cantidadMilesimas: 1_000 }] }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('solicitud_crear', { lineas: [{ productoId: randomUUID(), cantidadMilesimas: 1_000 }] }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('solicitud_crear', { fecha: '2026-03-10', necesariaEl: '2026-03-01', lineas: [{ descripcion: 'X', cantidadMilesimas: 1_000 }] }))).toBe('argumentos_invalidos');
  });

  it('no se resuelve ni se convierte en borrador; al enviar recibe número correlativo', async () => {
    expect(codigo(await dueno.herramienta('solicitud_resolver', { id, decision: 'aprobar' }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('solicitud_convertir', { id, proveedorId: proveedor }))).toBe('conflicto');
    const s = datos(await dueno.herramienta('solicitud_enviar', { id }));
    expect(s).toMatchObject({ estado: 'pendiente', numero: 1, codigo: expect.stringMatching(/^SC-0001-\d{4}$/) });
    expect(codigo(await dueno.herramienta('solicitud_enviar', { id }))).toBe('conflicto');
  });

  it('rechazar exige motivo; aprobar deja quién y cuándo y emite el evento', async () => {
    expect(codigo(await dueno.herramienta('solicitud_resolver', { id, decision: 'rechazar' }))).toBe('argumentos_invalidos');
    const s = datos(await dueno.herramienta('solicitud_resolver', { id, decision: 'aprobar' }));
    expect(s).toMatchObject({ estado: 'aprobada', resueltoPor: expect.any(String), resueltoEn: expect.any(String) });
    expect((await eventosDe(appPool, empresaA, 'solicitud.resuelta')).at(-1)!.carga).toEqual({ id, decision: 'aprobar' });
    expect(codigo(await dueno.herramienta('solicitud_resolver', { id, decision: 'rechazar', motivo: 'x' }))).toBe('conflicto');
  });

  it('convierte en una orden de compra en borrador con los costos indicados', async () => {
    expect(codigo(await dueno.herramienta('solicitud_convertir', { id, proveedorId: randomUUID() }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('solicitud_convertir', { id, proveedorId: proveedor, costos: [{ posicion: 9, costoUnitarioMilesimas: 1 }] }))).toBe('argumentos_invalidos');
    const s = datos(await dueno.herramienta('solicitud_convertir', { id, proveedorId: proveedor, costos: [{ posicion: 1, costoUnitarioMilesimas: 23_600 }] }));
    expect(s.estado).toBe('convertida');
    const orden = datos(await dueno.herramienta('compra_ver', { id: s.ordenId }));
    expect(orden).toMatchObject({ estado: 'borrador', proveedorId: proveedor, totalCentimos: 23_600 * 10 / 10 });
    expect(orden.detalle).toHaveLength(2);
    expect(codigo(await dueno.herramienta('solicitud_convertir', { id, proveedorId: proveedor }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('solicitud_anular', { id, motivo: 'x' }))).toBe('conflicto');
  });

  it('rechazada y anulada quedan registradas y no se convierten', async () => {
    const crear = async () => datos(await dueno.herramienta('solicitud_enviar', { id: datos(await dueno.herramienta('solicitud_crear', { lineas: [{ descripcion: 'Tinta', cantidadMilesimas: 2_000 }] })).id }));
    const a = await crear();
    const r = datos(await dueno.herramienta('solicitud_resolver', { id: a.id, decision: 'rechazar', motivo: 'Hay stock' }));
    expect(r).toMatchObject({ estado: 'rechazada', motivoResolucion: 'Hay stock', numero: 2 });
    expect(codigo(await dueno.herramienta('solicitud_convertir', { id: a.id, proveedorId: proveedor }))).toBe('conflicto');
    const b = await crear();
    expect(datos(await dueno.herramienta('solicitud_anular', { id: b.id, motivo: 'Ya no' }))).toMatchObject({ estado: 'anulada', motivoResolucion: 'Ya no' });
    expect(codigo(await dueno.herramienta('solicitud_anular', { id: b.id, motivo: 'Ya no' }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('solicitud_anular', { id: randomUUID(), motivo: 'x' }))).toBe('no_encontrado');
  });

  it('lista por estado, el lector solo lee y la otra empresa no ve nada', async () => {
    expect(datos(await dueno.herramienta('solicitudes_listar', { estado: 'convertida' })).items.map((s: any) => s.id)).toEqual([id]);
    expect(datos(await dueno.herramienta('solicitudes_listar', { estado: 'todas' })).items).toHaveLength(3);
    expect(datos(await dueno.herramienta('solicitudes_listar', { estado: 'abiertas' })).items).toHaveLength(0);
    expect(datos(await lector.herramienta('solicitud_ver', { id })).id).toBe(id);
    expect((await lector.herramienta('solicitud_crear', { lineas: [{ descripcion: 'X', cantidadMilesimas: 1_000 }] })).estado).toBe(403);
    expect((await lector.herramienta('solicitud_resolver', { id, decision: 'aprobar' })).estado).toBe(403);
    expect(codigo(await ajeno.herramienta('solicitud_ver', { id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('solicitud_resolver', { id, decision: 'aprobar' }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('solicitudes_listar', { estado: 'todas' })).items).toEqual([]);
  });
});

describe('facturas del proveedor', () => {
  let orden: any; // 10 unidades a S/ 11.80 = S/ 118.00
  const factura = (extra: Record<string, unknown>) => dueno.herramienta('factura_registrar', { proveedorId: proveedor, serie: 'f001', numero: '1', subtotalCentimos: 10_000, igvCentimos: 1_800, ...extra });

  beforeAll(async () => {
    orden = await crearEnviada(dueno, proveedor, { lineas: [linea('Papel bond A4', 11.8, 10)] });
  });

  it('sin orden no se concilia; la serie se guarda en mayúsculas y el total es la suma', async () => {
    const f = datos(await factura({}));
    expect(f).toMatchObject({ comprobante: 'F001-1', totalCentimos: 11_800, ordenId: null, moneda: 'PEN', proveedorNombre: 'Papelera Andina', conciliacion: { estado: 'sin_orden' } });
    expect((await eventosDe(appPool, empresaA, 'factura.registrada')).at(-1)!.carga).toMatchObject({ id: f.id, totalCentimos: 11_800, conciliacion: 'sin_orden' });
  });

  it('el mismo comprobante del mismo proveedor no se duplica, salvo que esté anulado', async () => {
    expect(codigo(await factura({}))).toBe('conflicto');
    const otra = datos(await factura({ numero: '2' }));
    datos(await dueno.herramienta('factura_anular', { id: otra.id, motivo: 'Monto equivocado' }));
    expect(codigo(await dueno.herramienta('factura_anular', { id: otra.id, motivo: 'otra vez' }))).toBe('conflicto');
    expect(datos(await factura({ numero: '2' })).comprobante).toBe('F001-2');
  });

  it('concilia contra la orden y contra lo recibido (que cambia después)', async () => {
    const igual = datos(await factura({ numero: '10', ordenId: orden.id }));
    expect(igual.conciliacion).toMatchObject({ estado: 'coincide', ordenTotalCentimos: 11_800, recibidoCentimos: 0, diferenciaConOrdenCentimos: 0 });
    expect(igual.ordenCodigo).toBe(orden.codigo);
    const cara = datos(await factura({ numero: '11', ordenId: orden.id, subtotalCentimos: 11_000, igvCentimos: 1_980 }));
    expect(cara.conciliacion).toMatchObject({ estado: 'difiere', diferenciaConOrdenCentimos: 1_180 });
    datos(await recibir(dueno, orden, [10_000]));
    expect(datos(await dueno.herramienta('factura_ver', { id: igual.id })).conciliacion.recibidoCentimos).toBe(11_800);
  });

  it('en otra moneda no se compara; rechaza orden de otro proveedor, proveedor inexistente y fechas incoherentes', async () => {
    expect(datos(await factura({ numero: '12', ordenId: orden.id, moneda: 'USD' })).conciliacion.estado).toBe('otra_moneda');
    const otro = await crearProveedor(dueno, 'Tintas del Sur');
    expect(mensaje(await factura({ numero: '13', ordenId: orden.id, proveedorId: otro }))).toMatch(/otro proveedor/);
    expect(codigo(await factura({ numero: '14', proveedorId: randomUUID() }))).toBe('argumentos_invalidos');
    expect(codigo(await factura({ numero: '15', ordenId: randomUUID() }))).toBe('no_encontrado');
    expect(codigo(await factura({ numero: '16', fecha: '2026-03-10', venceEl: '2026-03-01' }))).toBe('argumentos_invalidos');
    expect(codigo(await factura({ numero: '17', subtotalCentimos: -1 }))).toBe('argumentos_invalidos');
    expect(codigo(await factura({ numero: '18', serie: '' }))).toBe('argumentos_invalidos');
  });

  it('lista con filtros por orden y estado; el lector lee y no escribe; la otra empresa no ve nada', async () => {
    const deLaOrden = datos(await dueno.herramienta('facturas_listar', { ordenId: orden.id })).items;
    expect(deLaOrden.length).toBe(3);
    expect(datos(await dueno.herramienta('facturas_listar', { estado: 'anuladas' })).items).toHaveLength(1);
    expect(datos(await lector.herramienta('facturas_listar', {})).items.length).toBeGreaterThan(3);
    expect((await lector.herramienta('factura_registrar', { proveedorId: proveedor, serie: 'F9', numero: '1', subtotalCentimos: 1 })).estado).toBe(403);
    const id = deLaOrden[0].id;
    expect(codigo(await ajeno.herramienta('factura_ver', { id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('factura_anular', { id, motivo: 'x' }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('facturas_listar', {})).items).toEqual([]);
  });
});
