import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigo, confirmarCritica, crearBorrador, crearCliente, datos, eventosDe, mensaje } from './pruebas-de-pedidos.js';

// `pedido_editar_datos`: corregir entrega, responsable y notas de un pedido confirmado, con huella (quién, cuándo,
// antes y después, motivo) en el historial y el evento `pedido.datos_editados`.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion; // ordenes en lectura
let propio: Sesion; // ordenes completo, alcance propios
let ajeno: Sesion;
let empresaA: string;
let cliente: string;

const editar = (s: Sesion, args: Record<string, unknown>) => s.herramienta('pedido_editar_datos', args);
const confirmado = async (extra: Record<string, unknown> = {}) => {
  const p = await crearBorrador(dueno, cliente, extra);
  return datos(await dueno.herramienta('pedido_confirmar', { id: p.id }));
};

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de datos');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de datos');
  await Promise.all([activarModulo(empresaA, 'ordenes'), activarModulo(empresaB, 'ordenes')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('pedido_editar_datos', () => {
  it('corrige la entrega y deja la huella con antes, después, quién, cuándo y el motivo; emite el evento', async () => {
    const p = await confirmado({ entregaEl: '2099-02-01', notas: 'Recoge en tienda' });
    const r = datos(await editar(dueno, { id: p.id, entregaEl: '2099-02-10', motivo: ' El cliente pidió más tiempo ' }));
    expect(r).toMatchObject({ entregaEl: '2099-02-10', notas: 'Recoge en tienda', totalCentimos: 11_800, estado: 'confirmado' });
    const huella = r.historial[0];
    expect(huella).toMatchObject({
      tipo: 'datos_editados',
      usuarioId: dueno.usuarioId,
      usuarioNombre: 'Dueña',
      detalle: { cambios: [{ campo: 'entregaEl', antes: '2099-02-01', despues: '2099-02-10' }], motivo: 'El cliente pidió más tiempo' },
    });
    expect(Date.parse(huella.creadoEn)).toBeGreaterThan(Date.now() - 60_000);
    const emitidos = (await eventosDe(appPool, empresaA, 'pedido.datos_editados')).filter((e) => e.carga.id === p.id);
    expect(emitidos.map((e) => e.carga)).toEqual([{ id: p.id, codigo: p.codigo, clienteId: cliente, entregaAnterior: '2099-02-01', entregaNueva: '2099-02-10' }]);
    // La huella también se ve al volver a pedir el pedido.
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).historial[0].detalle.cambios).toHaveLength(1);
  });

  it('cambia responsable y notas juntos (con el nombre guardado) y vaciar quita el valor', async () => {
    const p = await confirmado({ responsableId: dueno.usuarioId, notas: 'Vieja' });
    const r = datos(await editar(dueno, { id: p.id, responsableId: lector.usuarioId, notas: 'Nueva' }));
    expect(r).toMatchObject({ responsableId: lector.usuarioId, notas: 'Nueva' });
    expect(r.historial[0].detalle.cambios).toEqual([
      { campo: 'responsableId', antes: dueno.usuarioId, despues: lector.usuarioId, antesEtiqueta: 'Dueña', despuesEtiqueta: 'Lectora' },
      { campo: 'notas', antes: 'Vieja', despues: 'Nueva' },
    ]);
    const vacio = datos(await editar(dueno, { id: p.id, responsableId: null, notas: '', entregaEl: null }));
    expect(vacio).toMatchObject({ responsableId: null, notas: null, entregaEl: null });
    expect(vacio.historial[0].detalle.cambios.map((c: any) => c.campo)).toEqual(['responsableId', 'notas']);
  });

  it('funciona también en proceso y listo, y no cambia líneas ni importes', async () => {
    const p = await confirmado();
    for (const estado of ['en_proceso', 'listo']) {
      datos(await dueno.herramienta('pedido_cambiar_estado', { id: p.id, estado }));
      const r = datos(await editar(dueno, { id: p.id, notas: `En ${estado}` }));
      expect(r).toMatchObject({ estado, notas: `En ${estado}`, totalCentimos: 11_800, lineas: 1 });
    }
  });

  it('no deja en borrador, entregado ni cancelado; el borrador se edita con pedido_editar', async () => {
    const borrador = await crearBorrador(dueno, cliente);
    const rb = await editar(dueno, { id: borrador.id, notas: 'x' });
    expect(codigo(rb)).toBe('conflicto');
    expect(mensaje(rb)).toMatch(/Editar pedido/);
    const entregado = await confirmado();
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: entregado.id, estado: 'entregado' }));
    expect(mensaje(await editar(dueno, { id: entregado.id, notas: 'x' }))).toBe('Un pedido «entregado» ya no se puede corregir.');
    const cancelado = await confirmado();
    datos(await confirmarCritica(dueno, 'pedido_cancelar', { id: cancelado.id, motivo: 'prueba' }));
    expect(codigo(await editar(dueno, { id: cancelado.id, notas: 'x' }))).toBe('conflicto');
  });

  it('valida: entrega anterior al pedido, nada que cambiar, sin datos, responsable ajeno', async () => {
    const p = await confirmado({ entregaEl: '2099-02-01' });
    expect(mensaje(await editar(dueno, { id: p.id, entregaEl: '2000-01-01' }))).toBe('La entrega no puede ser anterior a la fecha del pedido.');
    expect(mensaje(await editar(dueno, { id: p.id, entregaEl: '2099-02-01' }))).toMatch(/No hay nada que cambiar/);
    expect(codigo(await editar(dueno, { id: p.id }))).toBe('argumentos_invalidos');
    expect(codigo(await editar(dueno, { id: p.id, motivo: 'solo motivo' }))).toBe('argumentos_invalidos');
    expect(mensaje(await editar(dueno, { id: p.id, responsableId: ajeno.usuarioId }))).toBe('El responsable no es miembro de la empresa.');
    // Ninguna validación fallida deja huella ni evento.
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).historial.filter((h: any) => h.tipo === 'datos_editados')).toEqual([]);
    expect((await eventosDe(appPool, empresaA, 'pedido.datos_editados')).filter((e) => e.carga.id === p.id)).toEqual([]);
  });

  it('permisos: el lector no edita, el de alcance propios solo lo suyo, otra empresa no lo ve', async () => {
    const p = await confirmado();
    expect((await editar(lector, { id: p.id, notas: 'x' })).estado).toBe(403);
    expect(codigo(await editar(propio, { id: p.id, notas: 'x' }))).toBe('no_encontrado');
    expect(codigo(await editar(ajeno, { id: p.id, notas: 'x' }))).toBe('no_encontrado');
    const suyo = datos(await propio.herramienta('pedido_crear', { clienteId: cliente, lineas: [{ descripcion: 'X', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1000 }] }));
    datos(await propio.herramienta('pedido_confirmar', { id: suyo.id }));
    expect(datos(await editar(propio, { id: suyo.id, notas: 'mío' })).historial[0]).toMatchObject({ tipo: 'datos_editados', usuarioId: propio.usuarioId });
  });

  it('la auditoría guarda solo los campos tocados, no su contenido', async () => {
    const p = await confirmado();
    datos(await editar(dueno, { id: p.id, notas: 'Dato privado del cliente' }));
    const filas = await comoEmpresa(appPool, empresaA, async (c) => (await c.query(`select coalesce(resumen::text, '') as resumen from core.auditoria where herramienta = 'pedido_editar_datos' and entidad_id = $1`, [p.id])).rows);
    expect(filas).toHaveLength(1);
    expect(filas[0].resumen).toContain('notas');
    expect(filas[0].resumen).not.toContain('Dato privado');
  });
});
