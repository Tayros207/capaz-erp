import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { sumarDias } from '../domain/cotizacion.js';
import { confirmando, crearCliente, datosDe } from './pruebas-de-cotizador.js';
import { armarCasoDeReferencia, sembrarTaller } from './pruebas-de-cuadro.js';

// PARIDAD con Cotizín · entrega: la página pública (`entrega/services/detalle-publico.test.ts`, `condiciones.test.ts`) por HTTP real, sin sesión.
// Rápida con lista 190 / 580 / 1.200 a 2.000 unidades y ajuste +100: final 893.26, IGV 160.79, total 1,054.05 (y 793.26 jamás llega al cliente).
// Cuadro de referencia: 346.38 + 62.35 = 408.73 (y 225.15 de costo jamás llega al cliente). Aprobar crea el borrador de pedido con el mismo total.

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let A: string;
let cliente: string;
let futuro = Date.now() + 3_600_000;

const NO_DISPONIBLE = 'Esta cotización ya no está disponible';
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

async function drenar(): Promise<void> {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const pendientes = async (): Promise<any[]> => (await datosDe(dueno, 'borradores_listar', { modulo: 'ordenes', estado: 'pendiente', limite: 100 })).items;
const ruta = (token: string, resto = '') => `${app.url}/api/v1/c/${token}${resto}`;
const pagina = (token: string, resto = '') => fetch(ruta(token, resto), { redirect: 'manual' });
const aprobarPublico = (token: string) => fetch(ruta(token, '/aprobar'), { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: '' });
async function enlazar(id: string): Promise<{ token: string; enlaceId: string }> {
  const { respuesta } = await confirmando(dueno, 'enlace_generar', { id });
  if (!respuesta.cuerpo?.ok) throw new Error(`enlace_generar respondió ${respuesta.estado}: ${JSON.stringify(respuesta.cuerpo)}`);
  return { token: (respuesta.cuerpo.datos.url as string).split('/').at(-1)!, enlaceId: respuesta.cuerpo.datos.enlace.id };
}
/** Una rápida de 2.000 unidades con la lista 190 / 580 / 1.200 y un ajuste de línea; emitida. */
async function rapida(listaId: string, ajuste: unknown, clienteId = cliente) {
  const c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Rápida de paridad', clienteId, lineas: [{ tipo: 'lista', listaId, cantidadMilesimas: 2_000_000, ...(ajuste ? { ajuste } : {}) }] });
  return (await confirmando(dueno, 'cotizacion_emitir', { id: c.id })).respuesta.cuerpo.datos;
}

let lista: any;
let cuadroEmitido: any;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  dueno = await abrirSesion(app, 'Dueña paridad entrega');
  A = await crearEmpresa(dueno, 'Gráfica paridad entrega');
  for (const modulo of ['registro', 'ordenes', 'cotizador']) await activarModulo(A, modulo);
  await datosDe(dueno, 'registro_iniciar');
  await datosDe(dueno, 'cotizador_iniciar');
  cliente = await crearCliente(dueno, 'Cristina Rojas');
  lista = await datosDe(dueno, 'lista_precio_crear', { nombre: 'Volante A5 full color', p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000 });
  const taller = await sembrarTaller(dueno);
  const id = await armarCasoDeReferencia(dueno, taller, cliente);
  await datosDe(dueno, 'cuadro_fijar_trabajo', { id, producto: 'Volantes A5' });
  cuadroEmitido = (await confirmando(dueno, 'cotizacion_emitir', { id })).respuesta.cuerpo.datos;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('lo que ve el cliente: precio final, IGV y total; nunca costo, margen, lista ni ajuste', () => {
  it('rápida con ajuste +100: 893.26 + IGV 160.79 = 1,054.05; la página no trae 793.26, ni «lista», ni «ajuste», ni p100/p1000/p5000', async () => {
    const e = await rapida(lista.id, { tipo: 'monto', importeCentimos: 10_000 });
    expect(e).toMatchObject({ subtotalCentimos: 89_326, igvCentimos: 16_079, totalCentimos: 105_405 });
    const { token } = await enlazar(e.id);
    const html = await (await pagina(token)).text();
    for (const visto of ['893.26', '160.79', '1,054.05']) expect(html, visto).toContain(visto);
    expect(html).not.toContain('793.26');
    expect(html).not.toMatch(/lista|ajuste|costo|margen|utilidad|p100|p1000|p5000|sem[aá]foro/i);
  });

  it('cuadro de referencia: 346.38 + 62.35 = 408.73; la página no trae el costo 225.15, ni margen, ni utilidad, ni semáforo, ni pliegos', async () => {
    expect(cuadroEmitido).toMatchObject({ subtotalCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873 });
    const { token } = await enlazar(cuadroEmitido.id);
    const html = await (await pagina(token)).text();
    for (const visto of ['346.38', '62.35', '408.73']) expect(html, visto).toContain(visto);
    expect(html).not.toMatch(/225[.,]15|costo|margen|utilidad|sem[aá]foro|pliego|verde|ámbar|rojo/i);
    expect(html).not.toMatch(/<script|javascript:/i);
  });

  it('el ajuste del cliente (−10 %) no llega al cliente final: la página trae solo el precio final (713.93 → 713.93 + 128.51 = 842.44)', async () => {
    const descuento = await crearCliente(dueno, 'Cliente con descuento');
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: descuento, porcentaje: '-10' });
    const e = await rapida(lista.id, null, descuento);
    expect(e).toMatchObject({ subtotalCentimos: 71_393, igvCentimos: 12_851, totalCentimos: 84_244 });
    const html = await (await pagina((await enlazar(e.id)).token)).text();
    expect(html).toContain('713.93');
    expect(html).toContain('842.44');
    expect(html).not.toMatch(/ajuste|-10|10 ?%|lista|793\.26/i);
  });

  it('con IGV 0 la página no suma impuesto y el total es el precio', async () => {
    await datosDe(dueno, 'cotizador_configurar', { igvPorcentaje: 0 });
    try {
      const e = await rapida(lista.id, null);
      expect(e).toMatchObject({ subtotalCentimos: 79_326, igvCentimos: 0, totalCentimos: 79_326 });
      const html = await (await pagina((await enlazar(e.id)).token)).text();
      expect(html).toContain('793.26');
      expect(html).not.toContain('142.79');
    } finally {
      await datosDe(dueno, 'cotizador_configurar', { igvPorcentaje: 18 });
    }
  });

  it('las condiciones quedan congeladas al emitir: «válida hasta» y el plazo no cambian aunque la empresa los cambie después', async () => {
    await datosDe(dueno, 'cotizador_configurar', { condiciones: { validezDias: 15, plazoEntrega: '5 días hábiles', formaPago: '', tolerancia: '', noIncluye: '' } });
    const e = await rapida(lista.id, null);
    await datosDe(dueno, 'cotizador_configurar', { condiciones: { validezDias: 60, plazoEntrega: 'Otro plazo', formaPago: '', tolerancia: '', noIncluye: '' } });
    expect(e.validaHasta).toBe(sumarDias(hoyLima(), 15));
    const html = await (await pagina((await enlazar(e.id)).token)).text();
    expect(html).toContain('5 días hábiles');
    expect(html).not.toContain('Otro plazo');
  });
});

describe('token inventado = vencido = revocado', () => {
  it('las tres páginas son idénticas (404, mismo cuerpo) y no dicen cuál fue la razón; aprobar con ellos tampoco cambia nada', async () => {
    const e = await rapida(lista.id, null);
    const inventado = await pagina(randomBytes(32).toString('base64url'));
    const cuerpo = await inventado.text();
    expect(inventado.status).toBe(404);
    expect(cuerpo).toContain(NO_DISPONIBLE);

    const vencido = await enlazar(e.id);
    await comoEmpresa(appPool, A, (c) => c.query(`update cotizador.enlaces set vence_en = now() - interval '1 minute' where id = $1`, [vencido.enlaceId]), { confirmar: true });
    const revocado = await enlazar(e.id);
    await datosDe(dueno, 'enlace_revocar', { id: revocado.enlaceId });
    for (const { token } of [vencido, revocado]) {
      const r = await pagina(token);
      expect(r.status).toBe(404);
      expect(await r.text()).toBe(cuerpo);
      expect((await aprobarPublico(token)).status).toBe(404);
    }
    expect((await datosDe(dueno, 'cotizacion_ver', { id: e.id })).estado).toBe('enviada');
  });
});

describe('aprobar por el enlace crea el borrador de pedido y su total (con IGV) es el de la cotización', () => {
  const casos: [string, () => Promise<any>][] = [
    ['rápida con ajuste +100 (1,054.05)', () => rapida(lista.id, { tipo: 'monto', importeCentimos: 10_000 })],
    ['cuadro de referencia (408.73)', async () => cuadroEmitido],
  ];
  for (const [nombre, hacer] of casos) {
    it(nombre, async () => {
      const e = await hacer();
      const { token } = await enlazar(e.id);
      expect((await aprobarPublico(token)).status).toBe(303);
      expect((await datosDe(dueno, 'cotizacion_ver', { id: e.id })).estado).toBe('aceptada');
      await drenar();
      const propuestos = (await pendientes()).filter((b) => b.args.origenId === e.id);
      expect(propuestos).toHaveLength(1);
      const { respuesta } = await confirmando(dueno, 'borrador_aprobar', { id: propuestos[0].id });
      expect(respuesta.cuerpo.ok).toBe(true);
      const pedidoId = respuesta.cuerpo.datos.resultado?.id ?? respuesta.cuerpo.datos.id;
      const pedido = await datosDe(dueno, 'pedido_ver', { id: pedidoId });
      expect(pedido).toMatchObject({ origenTipo: 'cotizacion', origenId: e.id, estado: 'borrador', totalCentimos: e.totalCentimos });
    });
  }
});
