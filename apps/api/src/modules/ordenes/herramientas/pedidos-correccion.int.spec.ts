import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { emitirGuia, deLaGuia, pedidoListo } from './pruebas-de-guias.js';
import { codigo, confirmarCritica, crearBorrador, crearCliente, datos, eventosDe, linea, mensaje } from './pruebas-de-pedidos.js';

// `pedido_corregir` (versión 2): versión, foto de la v1, huella antes/después, evento, guías, estados, permisos y otra empresa.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let trabajador: Sesion; // ordenes completo, alcance todos, rol member
let lector: Sesion;
let propio: Sesion; // ordenes completo, alcance propios
let ajeno: Sesion;
let empresaA: string;
let cliente: string;

const corregir = (s: Sesion, args: Record<string, unknown>) => s.herramienta('pedido_corregir', { motivoCodigo: 'precio_acordado', ...args });
const confirmado = async (lineas = [linea('Volantes', 118, 1)]) => {
  const p = await crearBorrador(dueno, cliente, { lineas });
  datos(await dueno.herramienta('pedido_confirmar', { id: p.id }));
  return datos(await dueno.herramienta('pedido_ver', { id: p.id }));
};
/** La línea `i` del pedido tal como la espera la corrección, con los cambios indicados. */
const delPedido = (p: any, i = 0, extra: Record<string, unknown> = {}) => {
  const l = p.detalle[i];
  return { id: l.id, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas, afectoIgv: l.afectoIgv, ...extra };
};

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, trabajador, lector, propio, ajeno] = await Promise.all(['Dueña', 'Trabajador', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de correcciones');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de correcciones');
  await Promise.all([activarModulo(empresaA, 'ordenes'), activarModulo(empresaB, 'ordenes')]);
  await agregarMiembro(app, empresaA, trabajador, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, empresaA, lector, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('pedido_corregir: versión, foto y huella', () => {
  it('cambia el precio en el sitio: sube la versión, guarda la v1, deja huella y emite el evento', async () => {
    const p = await confirmado();
    const r = datos(await corregir(dueno, { id: p.id, motivoTexto: ' Lo negoció por teléfono ', lineas: [delPedido(p, 0, { precioUnitarioMilesimas: 100_000 })] }));
    expect(r.pedido).toMatchObject({ codigo: p.codigo, version: 2, totalCentimos: 10_000, subtotalCentimos: 8_475, igvCentimos: 1_525, estado: 'confirmado' });
    // La línea se actualiza en el sitio: conserva su id.
    expect(r.pedido.detalle).toHaveLength(1);
    expect(r.pedido.detalle[0]).toMatchObject({ id: p.detalle[0].id, precioUnitarioMilesimas: 100_000, importeCentimos: 10_000 });
    expect(r.avisos).toEqual([]);
    // La v1 queda guardada tal como era.
    expect(r.pedido.versiones).toHaveLength(1);
    expect(r.pedido.versiones[0]).toMatchObject({ version: 1, motivoCodigo: 'precio_acordado', motivoTexto: 'Lo negoció por teléfono', creadoPor: dueno.usuarioId, creadoPorNombre: 'Dueña' });
    expect(r.pedido.versiones[0].foto).toMatchObject({ totalCentimos: 11_800, clienteNombre: 'Imprenta Sol', estado: 'confirmado', lineas: [{ precioUnitarioMilesimas: 118_000, importeCentimos: 11_800 }] });
    // La huella: quién, cuándo, antes → después, motivo y delta.
    const huella = r.pedido.historial[0];
    expect(huella).toMatchObject({ tipo: 'corregido', usuarioId: dueno.usuarioId, usuarioNombre: 'Dueña' });
    expect(Date.parse(huella.creadoEn)).toBeGreaterThan(Date.now() - 60_000);
    expect(huella.detalle.correccion).toMatchObject({
      versionAnterior: 1,
      versionNueva: 2,
      motivoCodigo: 'precio_acordado',
      motivoTexto: 'Lo negoció por teléfono',
      totalAnteriorCentimos: 11_800,
      totalNuevoCentimos: 10_000,
      deltaCentimos: -1_800,
      igvAnteriorCentimos: 1_800,
      igvNuevoCentimos: 1_525,
      abonadoCentimos: null,
      aFavorCentimos: null,
    });
    expect(huella.detalle.correccion.lineas).toEqual([
      expect.objectContaining({ cambio: 'cambiada', lineaId: p.detalle[0].id, antes: expect.objectContaining({ precioUnitarioMilesimas: 118_000 }), despues: expect.objectContaining({ precioUnitarioMilesimas: 100_000, importeCentimos: 10_000 }) }),
    ]);
    const emitidos = (await eventosDe(appPool, empresaA, 'pedido.corregido')).filter((e) => e.carga.id === p.id);
    expect(emitidos.map((e) => e.carga)).toEqual([
      { id: p.id, codigo: p.codigo, clienteId: cliente, versionAnterior: 1, versionNueva: 2, totalAnteriorCentimos: 11_800, totalNuevoCentimos: 10_000, entregaAnterior: null, entregaNueva: null },
    ]);
    // Se ve igual al volver a pedir el pedido, con la lista de pedidos mostrando la versión.
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).versiones).toHaveLength(1);
    expect(datos(await dueno.herramienta('pedidos_listar', { estado: 'todos' })).items.find((x: any) => x.id === p.id).version).toBe(2);
  });

  it('una segunda corrección guarda la v2 y suma versión', async () => {
    const p = await confirmado();
    const a = datos(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0, { precioUnitarioMilesimas: 110_000 })] }));
    datos(await corregir(dueno, { id: p.id, motivoCodigo: 'otro', motivoTexto: 'Otra vez', lineas: [delPedido(a.pedido, 0, { precioUnitarioMilesimas: 105_000 })] }));
    const v = datos(await dueno.herramienta('pedido_ver', { id: p.id }));
    expect(v.version).toBe(3);
    expect(v.versiones.map((x: any) => [x.version, x.foto.totalCentimos])).toEqual([[2, 11_000], [1, 11_800]]);
  });

  it('si solo cambia el desglose de IGV (mismo total) igual versiona y deja huella', async () => {
    const p = await confirmado();
    const r = datos(await corregir(dueno, { id: p.id, motivoCodigo: 'igv', lineas: [delPedido(p, 0, { afectoIgv: false })] }));
    expect(r.pedido).toMatchObject({ version: 2, totalCentimos: 11_800, subtotalCentimos: 11_800, igvCentimos: 0 });
    expect(r.correccion).toMatchObject({ deltaCentimos: 0, igvAnteriorCentimos: 1_800, igvNuevoCentimos: 0 });
    expect(r.pedido.historial[0].detalle.correccion.lineas[0]).toMatchObject({ antes: { afectoIgv: true }, despues: { afectoIgv: false } });
  });

  it('agrega y quita líneas, cambia entrega y notas, y fijarTotalCentimos reparte el total exacto', async () => {
    const p = await confirmado([linea('Volantes', 59, 2), linea('Tarjetas', 10, 3)]);
    const r = datos(
      await corregir(dueno, {
        id: p.id,
        motivoCodigo: 'lineas',
        lineas: [delPedido(p, 0), { descripcion: 'Banner', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 30_000, afectoIgv: true }],
        entregaEl: '2099-05-01',
        notas: 'Con banner',
      }),
    );
    expect(r.pedido.detalle.map((l: any) => l.descripcion)).toEqual(['Volantes', 'Banner']);
    expect(r.pedido).toMatchObject({ entregaEl: '2099-05-01', notas: 'Con banner', totalCentimos: 14_800 });
    expect(r.correccion.lineas.map((l: any) => l.cambio).sort()).toEqual(['agregada', 'quitada']);
    expect(r.correccion.datos.map((d: any) => d.campo)).toEqual(['entregaEl', 'notas']);
    const fijo = datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 12_345 }));
    expect(fijo.pedido.totalCentimos).toBe(12_345);
    expect(fijo.pedido.detalle).toHaveLength(2);
  });

  it('cambia el orden de las líneas sin chocar con las posiciones', async () => {
    const p = await confirmado([linea('Uno', 10, 1), linea('Dos', 20, 1)]);
    const r = datos(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 1), delPedido(p, 0, { precioUnitarioMilesimas: 11_000 })] }));
    expect(r.pedido.detalle.map((l: any) => [l.descripcion, l.posicion])).toEqual([['Dos', 0], ['Uno', 1]]);
  });

  it('avisa que el taller ya trabaja cuando está en proceso o listo', async () => {
    const p = await confirmado();
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: p.id, estado: 'en_proceso' }));
    const r = datos(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0, { precioUnitarioMilesimas: 117_000 })] }));
    expect(r.avisos).toEqual(['El taller ya trabaja en este pedido: reimprime la orden de trabajo versión 2.']);
    expect(r.pedido.estado).toBe('en_proceso');
  });

  it('valida: nada que cambiar, total cero, línea ajena, «otro» sin texto', async () => {
    const p = await confirmado();
    expect(mensaje(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0)] }))).toMatch(/No hay nada que cambiar/);
    expect(codigo(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0, { precioUnitarioMilesimas: 0 })] }))).toBe('argumentos_invalidos');
    expect(mensaje(await corregir(dueno, { id: p.id, lineas: [{ ...delPedido(p, 0), id: '0192f0c4-7b1e-7000-8000-000000000099' }] }))).toMatch(/no es una línea de este pedido/);
    expect(codigo(await corregir(dueno, { id: p.id, motivoCodigo: 'otro', fijarTotalCentimos: 5_000 }))).toBe('argumentos_invalidos');
    expect(codigo(await corregir(dueno, { id: p.id }))).toBe('argumentos_invalidos');
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).version).toBe(1);
  });
});

describe('pedido_corregir: guías de remisión', () => {
  it('no borra ni reemplaza líneas con guías; no baja la cantidad por debajo de lo enviado; el precio sí cambia', async () => {
    const p = await pedidoListo(dueno, cliente, [['Tarjetas', 10, 5], ['Sobres', 2, 10]]);
    const g = datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 3_000, 0), deLaGuia(p, 1_000, 1)]));
    // Quitar una línea que figura en una guía.
    const quita = await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0)] });
    expect(codigo(quita)).toBe('conflicto');
    expect(mensaje(quita)).toContain('«Sobres»');
    expect(mensaje(quita)).toContain(g.codigo);
    // Bajar por debajo de lo enviado (3 en guía).
    expect(mensaje(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0, { cantidadMilesimas: 2_000 }), delPedido(p, 1)] }))).toMatch(/ya se enviaron 3/);
    // Bajar hasta lo enviado, subir otra y cambiar precio: se actualiza en el sitio.
    const ok = datos(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0, { cantidadMilesimas: 3_000, precioUnitarioMilesimas: 12_000 }), delPedido(p, 1, { cantidadMilesimas: 20_000 })] }));
    expect(ok.pedido.detalle.map((l: any) => l.id)).toEqual([p.detalle[0].id, p.detalle[1].id]);
    expect(ok.pedido.totalCentimos).toBe(3 * 1_200 + 20 * 200);
    expect(ok.avisos.some((a: string) => a.includes('guías de remisión'))).toBe(true);
    // La guía sigue citando las mismas líneas.
    expect(datos(await dueno.herramienta('guia_ver', { id: g.id })).lineas).toBe(2);
  });

  it('con la guía anulada se puede bajar la cantidad, pero la línea sigue sin poder borrarse', async () => {
    const p = await pedidoListo(dueno, cliente, [['Tarjetas', 10, 5], ['Sobres', 2, 10]]);
    const g = datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 4_000, 0), deLaGuia(p, 1_000, 1)]));
    datos(await confirmarCritica(dueno, 'guia_anular', { id: g.id, motivo: 'Error' }));
    expect(datos(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0, { cantidadMilesimas: 1_000 }), delPedido(p, 1)] })).pedido.totalCentimos).toBe(1_000 + 2_000);
    expect(mensaje(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 1)] }))).toMatch(/una guía anulada también la conserva/);
  });
});

describe('pedido_corregir: estados, cliente y permisos', () => {
  it('borrador y cancelado no; entregado solo precio e IGV y solo dueño o administrador', async () => {
    const borrador = await crearBorrador(dueno, cliente);
    expect(mensaje(await corregir(dueno, { id: borrador.id, fijarTotalCentimos: 5_000 }))).toMatch(/Editar pedido/);
    const cancelado = await confirmado();
    datos(await confirmarCritica(dueno, 'pedido_cancelar', { id: cancelado.id, motivo: 'prueba' }));
    expect(codigo(await corregir(dueno, { id: cancelado.id, fijarTotalCentimos: 5_000 }))).toBe('conflicto');

    const p = await confirmado();
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: p.id, estado: 'entregado' }));
    expect(codigo(await corregir(trabajador, { id: p.id, lineas: [delPedido(p, 0, { precioUnitarioMilesimas: 117_000 })] }))).toBe('sin_permiso');
    expect(mensaje(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0, { cantidadMilesimas: 2_000 })] }))).toMatch(/solo se corrige el precio o el IGV/);
    expect(mensaje(await corregir(dueno, { id: p.id, notas: 'x' }))).toMatch(/solo se corrige el precio o el IGV/);
    expect(mensaje(await corregir(dueno, { id: p.id, lineas: [delPedido(p, 0), { descripcion: 'N', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1, afectoIgv: true }] }))).toMatch(/no se agregan ni se quitan/);
    const ok = datos(await corregir(dueno, { id: p.id, motivoCodigo: 'igv', fijarTotalCentimos: 10_000 }));
    expect(ok.pedido).toMatchObject({ estado: 'entregado', version: 2, totalCentimos: 10_000 });
  });

  it('el cliente solo cambia si se sabe que no hay abonos', async () => {
    const otro = await crearCliente(dueno, 'Otro cliente');
    const p = await confirmado();
    expect(mensaje(await corregir(dueno, { id: p.id, clienteId: otro }))).toMatch(/Corregir venta/);
    expect(mensaje(await corregir(dueno, { id: p.id, clienteId: otro, abonadoCentimos: 100 }))).toMatch(/ya tiene abonos/);
    const r = datos(await corregir(dueno, { id: p.id, clienteId: otro, abonadoCentimos: 0 }));
    expect(r.pedido).toMatchObject({ clienteId: otro, clienteNombre: 'Otro cliente' });
    expect(r.correccion.datos[0]).toMatchObject({ campo: 'clienteId', antesEtiqueta: 'Imprenta Sol', despuesEtiqueta: 'Otro cliente' });
    expect(r.pedido.versiones[0].foto.clienteNombre).toBe('Imprenta Sol');
  });

  it('el trabajador corrige dentro del umbral y no más allá; el dueño sí', async () => {
    const p = await confirmado([linea('Volantes', 500, 1)]); // S/ 500: límite = S/ 50 (10 %)
    expect(datos(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 46_000 })).pedido.totalCentimos).toBe(46_000);
    const r = await corregir(trabajador, { id: p.id, fijarTotalCentimos: 30_000 });
    expect(codigo(r)).toBe('requiere_aprobacion');
    expect(mensaje(r)).toContain('S/ 460.00 a S/ 300.00');
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).version).toBe(2);
    expect(datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 30_000 })).pedido.totalCentimos).toBe(30_000);
  });

  it('el trabajador no puede dejar excedente a favor del cliente (aunque sea una diferencia chica)', async () => {
    const p = await confirmado([linea('Volantes', 100, 1)]);
    expect(codigo(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 9_900, abonadoCentimos: 10_000 }))).toBe('requiere_aprobacion');
    expect(datos(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 9_900, abonadoCentimos: 9_900 })).correccion).toMatchObject({ aFavorCentimos: 0, abonadoCentimos: 9_900 });
    const q = await confirmado([linea('Volantes', 100, 1)]);
    expect(datos(await corregir(dueno, { id: q.id, fijarTotalCentimos: 7_000, abonadoCentimos: 10_000 })).correccion).toMatchObject({ aFavorCentimos: 3_000, deltaCentimos: -3_000 });
  });

  it('lector no corrige; alcance propios solo lo suyo; otra empresa no lo ve', async () => {
    const p = await confirmado();
    expect(codigo(await corregir(lector, { id: p.id, fijarTotalCentimos: 11_000 }))).toBe('modulo_solo_lectura');
    expect(codigo(await corregir(propio, { id: p.id, fijarTotalCentimos: 11_000 }))).toBe('no_encontrado');
    expect(codigo(await corregir(ajeno, { id: p.id, fijarTotalCentimos: 11_000 }))).toBe('no_encontrado');
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).version).toBe(1);
  });
});

describe('correcciones: lectura con alcance y tablas inmutables', () => {
  it('pedido_correcciones_listar: dueño ve todas, el trabajador solo las suyas, otra empresa ninguna', async () => {
    const p = await confirmado([linea('Volantes', 200, 1)]);
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 15_000 }));
    datos(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 14_000 }));
    const todas = datos(await dueno.herramienta('pedido_correcciones_listar', { pedidoId: p.id })).items;
    expect(todas.map((c: any) => [c.version, c.usuarioNombre, c.deltaCentimos])).toEqual([[3, 'Trabajador', -1_000], [2, 'Dueña', -5_000]]);
    expect(todas[0]).toMatchObject({ pedido: { id: p.id, codigo: p.codigo, clienteNombre: 'Imprenta Sol' }, motivoCodigo: 'precio_acordado', resumen: expect.stringContaining('v2 → v3') });
    // El trabajador, aunque pida las de otra persona, solo ve las suyas.
    const suyas = datos(await trabajador.herramienta('pedido_correcciones_listar', { pedidoId: p.id, autorId: dueno.usuarioId })).items;
    expect(suyas.map((c: any) => c.usuarioNombre)).toEqual(['Trabajador']);
    expect(datos(await ajeno.herramienta('pedido_correcciones_listar', { pedidoId: p.id })).items).toEqual([]);
    // Filtros de período (días de la empresa) y de autor.
    expect(datos(await dueno.herramienta('pedido_correcciones_listar', { pedidoId: p.id, desde: '2000-01-01', hasta: '2000-01-02' })).items).toEqual([]);
    expect(datos(await dueno.herramienta('pedido_correcciones_listar', { pedidoId: p.id, autorId: dueno.usuarioId })).items).toHaveLength(1);
    expect(codigo(await dueno.herramienta('pedido_correcciones_listar', { usuarioId: 'x' }))).toBe('argumento_prohibido');
  });

  it('las versiones guardadas no se pueden cambiar ni borrar', async () => {
    const p = await confirmado();
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 11_000 }));
    const actualizar = comoEmpresa(appPool, empresaA, (c) => c.query(`update ordenes.pedido_versiones set foto = '{}'::jsonb where pedido_id = $1`, [p.id]), { confirmar: true });
    await expect(actualizar).rejects.toThrow();
    const borrar = comoEmpresa(appPool, empresaA, (c) => c.query(`delete from ordenes.pedido_versiones where pedido_id = $1`, [p.id]), { confirmar: true });
    await expect(borrar).rejects.toThrow();
  });
});
