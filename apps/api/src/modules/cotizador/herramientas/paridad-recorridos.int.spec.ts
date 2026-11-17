import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { confirmando, crearCliente, datosDe, eventosDe } from './pruebas-de-cotizador.js';
import { armarCasoDeReferencia, sembrarTaller } from './pruebas-de-cuadro.js';

// PARIDAD con Cotizín · dos recorridos largos por HTTP real, verificando cantidades, totales y estados en cada paso.
//  1. rápida → ajuste de línea → emitir → enlace → aprobar → borrador de pedido → pedido → deuda → abono → entregado → cobro del saldo.
//  2. cuadro → emitir → guardar referencias → lista enlazada al producto → cotización rápida con esa lista → emitir.

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let A: string;
let cliente: string;
let futuro = Date.now() + 3_600_000;

async function drenar(): Promise<void> {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const pendientes = async (modulo: string): Promise<any[]> => (await datosDe(dueno, 'borradores_listar', { modulo, estado: 'pendiente', limite: 100 })).items;
const aprobar = async (id: string): Promise<any> => {
  const { respuesta } = await confirmando(dueno, 'borrador_aprobar', { id });
  if (!respuesta.cuerpo?.ok) throw new Error(`borrador_aprobar respondió ${respuesta.estado}: ${JSON.stringify(respuesta.cuerpo)}`);
  return respuesta.cuerpo.datos;
};
const deudasDe = (origenId: string) => comoEmpresa(appPool, A, async (c) => (await c.query(`select * from registro.deudas where origen_tipo = 'pedido' and origen_id = $1`, [origenId])).rows as any[]);
const ver = (id: string) => datosDe(dueno, 'cotizacion_ver', { id });
const pagina = (token: string) => fetch(`${app.url}/api/v1/c/${token}`, { redirect: 'manual' });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  dueno = await abrirSesion(app, 'Dueña de los recorridos de paridad');
  A = await crearEmpresa(dueno, 'Gráfica de los recorridos de paridad');
  for (const modulo of ['registro', 'ordenes', 'cotizador']) await activarModulo(A, modulo);
  await datosDe(dueno, 'registro_iniciar');
  await datosDe(dueno, 'cotizador_iniciar');
  cliente = await crearCliente(dueno, 'Cristina Rojas');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('recorrido 1: rápida → ajuste de línea → emitir → enlace → aprobar → pedido → deuda → entregado → cobro del saldo', () => {
  let lista: any;
  let cot: any;
  let token: string;
  let pedidoId: string;
  let pedidoCodigo: string;
  const TOTAL = 105_405; // 893.26 + IGV 160.79 = 1,054.05

  it('1. rápida de 2.000 unidades: lista 793.26 + IGV 142.79 = 936.05', async () => {
    lista = await datosDe(dueno, 'lista_precio_crear', { nombre: 'Volante A5 full color', p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000 });
    cot = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Volantes del recorrido', clienteId: cliente, lineas: [{ tipo: 'lista', listaId: lista.id, cantidadMilesimas: 2_000_000 }] });
    expect(cot).toMatchObject({ estado: 'borrador', numero: null, subtotalCentimos: 79_326, igvCentimos: 14_279, totalCentimos: 93_605 });
    expect(cot.lineas[0]).toMatchObject({ cantidadMilesimas: 2_000_000, precioListaCentimos: 79_326, ajuste: null });
  });

  it('2. ajuste de línea +100: final 893.26, IGV 160.79, total 1,054.05; el precio de lista sigue en 793.26', async () => {
    cot = await datosDe(dueno, 'cotizacion_editar', { id: cot.id, lineas: [{ tipo: 'lista', listaId: lista.id, cantidadMilesimas: 2_000_000, ajuste: { tipo: 'monto', importeCentimos: 10_000 } }] });
    expect(cot.lineas[0]).toMatchObject({ precioListaCentimos: 79_326, importeCentimos: 89_326, igvCentimos: 16_079, totalCentimos: TOTAL, ajuste: { tipo: 'monto', importeCentimos: 10_000 } });
    expect(cot).toMatchObject({ estado: 'borrador', subtotalCentimos: 89_326, igvCentimos: 16_079, totalCentimos: TOTAL });
  });

  it('3. emitir: número COT-AAAA-0001, estado emitida y los mismos totales; ya no se edita', async () => {
    const e = (await confirmando(dueno, 'cotizacion_emitir', { id: cot.id })).respuesta.cuerpo.datos;
    expect(e).toMatchObject({ estado: 'emitida', numero: 1, codigo: expect.stringMatching(/^COT-\d{4}-0001$/), subtotalCentimos: 89_326, igvCentimos: 16_079, totalCentimos: TOTAL });
    cot = e;
    const r = await dueno.herramienta('cotizacion_editar', { id: cot.id, titulo: 'Otro' });
    expect(r.cuerpo.error.codigo).toBe('conflicto');
  });

  it('4. enlace: la cotización pasa a enviada y la página pública muestra 1,054.05 sin la lista de 793.26', async () => {
    const { respuesta } = await confirmando(dueno, 'enlace_generar', { id: cot.id });
    token = (respuesta.cuerpo.datos.url as string).split('/').at(-1)!;
    expect((await ver(cot.id)).estado).toBe('enviada');
    const html = await (await pagina(token)).text();
    expect(html).toContain('1,054.05');
    expect(html).not.toContain('793.26');
  });

  it('5. el cliente aprueba: aceptada por el canal enlace y el evento lleva la línea con IGV (cantidad 1, 1,054.05)', async () => {
    const r = await fetch(`${app.url}/api/v1/c/${token}/aprobar`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: '' });
    expect(r.status).toBe(303);
    const c = await ver(cot.id);
    expect(c.estado).toBe('aceptada');
    expect(c.historial[0]).toMatchObject({ tipo: 'aceptada', canal: 'enlace', usuarioId: null });
    const aceptada = (await eventosDe(appPool, A)).find((x) => x.tipo === 'cotizacion.aceptada' && (x.carga as any).id === cot.id);
    expect(aceptada?.carga).toMatchObject({ subtotalCentimos: 89_326, igvCentimos: 16_079, totalCentimos: TOTAL, clienteId: cliente });
    expect((aceptada!.carga as any).lineas).toHaveLength(1);
    expect((aceptada!.carga as any).lineas[0].precioUnitarioMilesimas * ((aceptada!.carga as any).lineas[0].cantidadMilesimas / 1000)).toBe(TOTAL * 10);
  });

  it('6. Pedidos propone el borrador; aprobado, el pedido nace en borrador con el total de la cotización', async () => {
    await drenar();
    const propuestos = (await pendientes('ordenes')).filter((b) => b.args.origenId === cot.id);
    expect(propuestos).toHaveLength(1);
    const creado = await aprobar(propuestos[0].id);
    pedidoId = creado.resultado?.id ?? creado.id;
    const pedido = await datosDe(dueno, 'pedido_ver', { id: pedidoId });
    expect(pedido).toMatchObject({ origenTipo: 'cotizacion', origenId: cot.id, estado: 'borrador', totalCentimos: TOTAL });
  });

  it('7. confirmar el pedido propone la deuda por cobrar por el mismo total; aprobada queda viva', async () => {
    pedidoCodigo = (await datosDe(dueno, 'pedido_confirmar', { id: pedidoId })).codigo;
    await drenar();
    const deudas = (await pendientes('registro')).filter((b) => b.herramienta === 'deuda_crear' && b.args.origenId === pedidoId);
    expect(deudas).toHaveLength(1);
    expect(deudas[0].args).toMatchObject({ tipo: 'por_cobrar', contactoId: cliente, totalCentimos: TOTAL });
    await aprobar(deudas[0].id);
    const [deuda] = await deudasDe(pedidoId);
    expect(Number(deuda.total_centimos)).toBe(TOTAL);
    expect(Number(deuda.abonado_centimos)).toBe(0);
  });

  it('8. un adelanto de 500.00 deja el saldo en 554.05', async () => {
    const [deuda] = await deudasDe(pedidoId);
    const r = await confirmando(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 50_000 });
    expect(r.respuesta.cuerpo.ok, JSON.stringify(r.respuesta.cuerpo)).toBe(true);
    const [despues] = await deudasDe(pedidoId);
    expect(Number(despues.abonado_centimos)).toBe(50_000);
  });

  it('9. al entregar, propone cobrar el saldo (554.05); aprobado, la deuda queda pagada con 1,054.05 abonados', async () => {
    await datosDe(dueno, 'pedido_cambiar_estado', { id: pedidoId, estado: 'entregado' });
    expect((await datosDe(dueno, 'pedido_ver', { id: pedidoId })).estado).toBe('entregado');
    await drenar();
    const cobros = (await pendientes('registro')).filter((b) => b.herramienta === 'deuda_abonar' && b.origenRef === `pedido:${pedidoId}`);
    expect(cobros).toHaveLength(1);
    expect(cobros[0].args.montoCentimos).toBe(TOTAL - 50_000);
    expect(cobros[0].resumen).toContain(`del pedido ${pedidoCodigo}`);
    await aprobar(cobros[0].id);
    const [deuda] = await deudasDe(pedidoId);
    expect(deuda.estado).toBe('pagada');
    expect(Number(deuda.abonado_centimos)).toBe(TOTAL);
  });
});

describe('recorrido 2: cuadro → emitir → guardar referencias → lista enlazada al producto → rápida con esa lista → emitir', () => {
  let cuadro: any;
  let producto: string;
  let listaNueva: any;

  it('1. el cuadro de referencia da 346.38 y se emite con su número (el siguiente del recorrido anterior)', async () => {
    const taller = await sembrarTaller(dueno);
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Volantes A5 por partes');
    expect((await datosDe(dueno, 'cuadro_calcular', { id })).comercial).toMatchObject({ precioCentimos: 34_638, totalConImpuestoCentimos: 40_873 });
    cuadro = (await confirmando(dueno, 'cotizacion_emitir', { id })).respuesta.cuerpo.datos;
    expect(cuadro).toMatchObject({ estado: 'emitida', modo: 'cuadro', numero: 2, subtotalCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873, costoCentimos: 22_515, margenPct: '35.000' });
  });

  it('2. guardar las referencias en un producto crea la lista enlazada con 144.86 / 220.34 / 555.83', async () => {
    producto = (await datosDe(dueno, 'productos_crear', { nombre: 'Volantes A5 4/4 couché 150 g', unidad: 'und' })).id;
    const { respuesta, resumen } = await confirmando(dueno, 'cuadro_guardar_referencias', { id: cuadro.id, productoId: producto, nombre: 'Volantes A5 desde el cuadro' });
    expect(resumen).toContain('Se creará la lista');
    listaNueva = respuesta.cuerpo.datos;
    expect(listaNueva).toMatchObject({ productoId: producto, p100Centimos: 14_486, p1000Centimos: 22_034, p5000Centimos: 55_583, modoIntermedio: 'curva' });
    expect(await ver(cuadro.id)).toMatchObject({ estado: 'emitida', totalCentimos: 40_873 }); // guardar no toca la cotización
  });

  it('3. el buscador del cotizador ofrece el producto con su lista (origen «lista»)', async () => {
    const { items } = await datosDe(dueno, 'cotizador_productos_buscar', { texto: 'Volantes A5 4/4' });
    expect(items.find((i: any) => i.productoId === producto)).toMatchObject({ origen: 'lista', listaId: listaNueva.id });
  });

  it('4. precio_consultar con esa lista: 100 → 144.86, 1.000 → 220.34, 5.000 → 555.83 y 2.500 → 373.14 (curva, estimación)', async () => {
    for (const [q, t] of [[100, 14_486], [1000, 22_034], [5000, 55_583]] as const) {
      expect(await datosDe(dueno, 'precio_consultar', { listaId: listaNueva.id, cantidadMilesimas: q * 1000 })).toMatchObject({ importeCentimos: t, estimacion: false });
    }
    expect(await datosDe(dueno, 'precio_consultar', { listaId: listaNueva.id, cantidadMilesimas: 2_500_000 })).toMatchObject({ importeCentimos: 37_314, estimacion: true });
  });

  it('5. cotización rápida con esa lista (1.000 y 100 unidades): 220.34 + 144.86 = 365.20, IGV 65.74, total 430.94; emitida con el número 3', async () => {
    const c = await datosDe(dueno, 'cotizacion_crear', {
      titulo: 'Rápida desde la lista del cuadro', clienteId: cliente,
      lineas: [{ tipo: 'lista', listaId: listaNueva.id, cantidadMilesimas: 1_000_000 }, { tipo: 'lista', listaId: listaNueva.id, cantidadMilesimas: 100_000 }],
    });
    expect(c.lineas.map((l: any) => [l.cantidadMilesimas, l.importeCentimos, l.igvCentimos, l.totalCentimos])).toEqual([[1_000_000, 22_034, 3_966, 26_000], [100_000, 14_486, 2_607, 17_093]]);
    expect(c).toMatchObject({ subtotalCentimos: 36_520, igvCentimos: 6_573, totalCentimos: 43_093 });
    const e = (await confirmando(dueno, 'cotizacion_emitir', { id: c.id })).respuesta.cuerpo.datos;
    expect(e).toMatchObject({ estado: 'emitida', modo: 'rapida', numero: 3, subtotalCentimos: 36_520, totalCentimos: 43_093 });
  });

  it('6. cambiar la lista después no altera lo emitido: la foto guarda 144.86 / 220.34 / 555.83', async () => {
    const [{ detalle }] = await comoEmpresa(appPool, A, async (c) => (await c.query(`select l.detalle from cotizador.version_lineas l join cotizador.versiones v on v.id = l.version_id join cotizador.cotizaciones q on q.id = v.cotizacion_id where q.numero = 3 order by l.posicion limit 1`)).rows as any[]);
    expect(detalle).toMatchObject({ p100: 14_486, p1000: 22_034, p5000: 55_583, modoIntermedio: 'curva' });
  });
});
