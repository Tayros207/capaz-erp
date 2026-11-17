import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { Relevo } from '../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../core/herramientas/http-de-pruebas.js';
import { confirmando, datosDe } from '../../modules/registro/herramientas/pruebas-de-registro.js';
import { levantarApp, type AppDePruebas } from '../app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../base-de-pruebas.js';

// Recorrido de la fase 3 del plan de integración profunda, por HTTP real: cotización rápida (producto con lista y
// producto solo de catálogo) → emitir → enviar → aceptar → borrador de pedido → pedido → deuda → entrega → cobro del
// saldo. El total del pedido (con IGV) debe coincidir con el de la cotización en los dos casos.

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let empresaId: string;
let clienteId: string;
let futuro = Date.now() + 3_600_000;

async function drenar(): Promise<void> {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const emitirEvento = (tipo: string, carga: Record<string, unknown>) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query(`insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, $2, $3::jsonb) returning id`, [empresaId, tipo, JSON.stringify(carga)])).rows[0].id as string, { confirmar: true });
const pendientes = async (modulo: string): Promise<any[]> => (await datosDe(dueno, 'borradores_listar', { modulo, estado: 'pendiente', limite: 100 })).items;
const aprobar = async (id: string): Promise<any> => {
  const { respuesta } = await confirmando(dueno, 'borrador_aprobar', { id });
  if (!respuesta.cuerpo?.ok) throw new Error(`borrador_aprobar respondió ${respuesta.estado}: ${JSON.stringify(respuesta.cuerpo)}`);
  return respuesta.cuerpo.datos;
};
const aprobarHerramienta = async (nombre: string, args: unknown) => {
  const { respuesta } = await confirmando(dueno, nombre, args);
  if (!respuesta.cuerpo?.ok) throw new Error(`${nombre} respondió ${respuesta.estado}`);
};
const cotizar = async (titulo: string, lineas: unknown[]) => {
  const c = await datosDe(dueno, 'cotizacion_crear', { titulo, clienteId, lineas });
  const emitida = (await confirmando(dueno, 'cotizacion_emitir', { id: c.id })).respuesta.cuerpo.datos;
  expect(emitida.estado).toBe('emitida');
  const enviada = await datosDe(dueno, 'cotizacion_marcar_enviada', { id: c.id });
  expect(enviada.estado).toBe('enviada');
  return enviada;
};
const deudasDe = async (origenId: string) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query(`select * from registro.deudas where origen_tipo = 'pedido' and origen_id = $1`, [origenId])).rows);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  dueno = await abrirSesion(app, 'Dueña del recorrido cotizador');
  empresaId = await crearEmpresa(dueno, 'Gráfica del recorrido cotizador');
  for (const modulo of ['registro', 'ordenes', 'cotizador']) await activarModulo(empresaId, modulo);
  await datosDe(dueno, 'registro_iniciar');
  await datosDe(dueno, 'cotizador_iniciar');
  clienteId = (await datosDe(dueno, 'clientes_crear', { nombre: 'Cristina Rojas' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

type Caso = { nombre: string; productoNombre: string; precioCatalogo: number; conLista: boolean; cantidad: number };
const CASOS: Caso[] = [
  { nombre: 'producto con lista', productoNombre: 'Volantes A5 con lista', precioCatalogo: 1_180_000, conLista: true, cantidad: 2_500_000 },
  { nombre: 'producto solo de catálogo', productoNombre: 'Banner solo de catálogo', precioCatalogo: 38_500, conLista: false, cantidad: 7_000 },
  { nombre: 'catálogo con redondeo de céntimos', productoNombre: 'Sticker redondeo', precioCatalogo: 3_990, conLista: false, cantidad: 13_000 },
  { nombre: 'catálogo, precio con IGV impar', productoNombre: 'Tarjeta impar', precioCatalogo: 1_235, conLista: false, cantidad: 7_000 },
];

for (const caso of CASOS) {
  describe(`cotización → pedido → deuda → cobro · ${caso.nombre}`, () => {
    let cotizacion: any;
    let pedidoId: string;
    let pedidoCodigo: string;

    it('se cotiza desde el buscador, se emite y se envía', async () => {
      const producto = await datosDe(dueno, 'productos_crear', { nombre: caso.productoNombre, tipo: 'producto', unidad: 'UND', precioUnitarioMilesimas: caso.precioCatalogo, afectoIgv: true });
      if (caso.conLista) {
        await datosDe(dueno, 'lista_precio_crear', { nombre: caso.productoNombre, productoId: producto.id, p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000 });
      }
      const { items } = await datosDe(dueno, 'cotizador_productos_buscar', { texto: caso.productoNombre });
      const op = items.find((i: any) => i.productoId === producto.id);
      expect(op.origen).toBe(caso.conLista ? 'lista' : 'catalogo');
      const linea = caso.conLista
        ? { tipo: 'lista', listaId: op.listaId, cantidadMilesimas: caso.cantidad }
        : { tipo: 'manual', productoId: producto.id, descripcion: op.nombre, unidad: op.unidad, cantidadMilesimas: caso.cantidad, precioUnitarioMilesimas: op.precioCatalogoSinIgvMilesimas };
      cotizacion = await cotizar(`Rápida · ${caso.nombre}`, [linea]);
      expect(cotizacion.totalCentimos).toBeGreaterThan(0);
    });

    it('al aceptar, el borrador de pedido aparece, se aprueba y el total coincide con la cotización', async () => {
      await datosDe(dueno, 'cotizacion_aceptar', { id: cotizacion.id });
      await drenar();
      const propuestos = (await pendientes('ordenes')).filter((b) => b.args.origenId === cotizacion.id);
      expect(propuestos).toHaveLength(1);
      const creado = await aprobar(propuestos[0].id);
      pedidoId = creado.resultado?.id ?? creado.id;
      const pedido = await datosDe(dueno, 'pedido_ver', { id: pedidoId });
      expect(pedido).toMatchObject({ origenTipo: 'cotizacion', origenId: cotizacion.id, estado: 'borrador' });
      expect(pedido.totalCentimos).toBe(cotizacion.totalCentimos);
    });

    it('confirmar propone la deuda por cobrar, y aprobada queda viva', async () => {
      pedidoCodigo = (await datosDe(dueno, 'pedido_confirmar', { id: pedidoId })).codigo;
      await drenar();
      const deudas = (await pendientes('registro')).filter((b) => b.herramienta === 'deuda_crear' && b.args.origenId === pedidoId);
      expect(deudas).toHaveLength(1);
      expect(deudas[0].args).toMatchObject({ tipo: 'por_cobrar', contactoId: clienteId, totalCentimos: cotizacion.totalCentimos });
      await aprobar(deudas[0].id);
      const viva = await deudasDe(pedidoId);
      expect(viva).toHaveLength(1);
      expect(Number(viva[0].total_centimos)).toBe(cotizacion.totalCentimos);
    });

    it('al entregar, propone cobrar el saldo; aprobado, la deuda queda saldada', async () => {
      await datosDe(dueno, 'pedido_cambiar_estado', { id: pedidoId, estado: 'entregado' });
      await drenar();
      const cobros = (await pendientes('registro')).filter((b) => b.herramienta === 'deuda_abonar' && b.origenRef === `pedido:${pedidoId}`);
      expect(cobros).toHaveLength(1);
      // Otra entrega del mismo evento con el cobro aún pendiente en la bandeja: no propone un segundo.
      await emitirEvento('pedido.entregado', { id: pedidoId, codigo: pedidoCodigo, clienteId });
      await drenar();
      expect((await pendientes('registro')).filter((b) => b.herramienta === 'deuda_abonar' && b.origenRef === `pedido:${pedidoId}`)).toHaveLength(1);
      expect(cobros[0].args.montoCentimos).toBe(cotizacion.totalCentimos);
      expect(cobros[0].resumen).toContain(`del pedido ${pedidoCodigo}`);
      await aprobar(cobros[0].id);
      const [deuda] = await deudasDe(pedidoId);
      expect(deuda.estado).toBe('pagada');
      expect(Number(deuda.abonado_centimos)).toBe(cotizacion.totalCentimos);
    });

    it('repetir cotizacion.aceptada y pedido.entregado no duplica borradores', async () => {
      const antes = (await pendientes('ordenes')).length + (await pendientes('registro')).length;
      await emitirEvento('cotizacion.aceptada', {
        id: cotizacion.id, codigo: cotizacion.codigo, version: 1, clienteId, igvPorcentaje: 18,
        subtotalCentimos: cotizacion.subtotalCentimos, igvCentimos: cotizacion.igvCentimos, totalCentimos: cotizacion.totalCentimos,
        lineas: [{ productoId: null, descripcion: 'x', unidad: 'UND', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1000, afectoIgv: true }],
      });
      await emitirEvento('pedido.entregado', { id: pedidoId, codigo: pedidoCodigo, clienteId });
      await drenar();
      expect((await pendientes('ordenes')).length + (await pendientes('registro')).length).toBe(antes);
    });
  });
}

describe('cotizacion.aceptada repetida con el borrador sin aprobar', () => {
  // Hallazgo: hoy SÍ deja dos (el consumidor de Pedidos solo mira si ya existe el pedido). `it.fails` documenta el defecto
  // y avisa cuando `modules/ordenes/consumidores.ts` (ajeno) lo corrija: entonces se quita `.fails`.
  it.fails('no deja dos borradores de pedido', async () => {
    const cot = await cotizar('Doble entrega', [{ tipo: 'manual', descripcion: 'Trabajo doble', unidad: 'UND', cantidadMilesimas: 1000, precioUnitarioMilesimas: 100_000 }]);
    await datosDe(dueno, 'cotizacion_aceptar', { id: cot.id });
    await drenar();
    await emitirEvento('cotizacion.aceptada', {
      id: cot.id, codigo: cot.codigo, version: 1, clienteId, igvPorcentaje: 18, subtotalCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800,
      lineas: [{ productoId: null, descripcion: 'x', unidad: 'UND', cantidadMilesimas: 1000, precioUnitarioMilesimas: 118_000, afectoIgv: true }],
    });
    await drenar();
    expect((await pendientes('ordenes')).filter((b) => b.origenRef === `cotizacion:${cot.id}`)).toHaveLength(1);
  });
});

describe('cotización anulada tras aceptar', () => {
  it('propone cancelar el pedido que sigue en borrador', async () => {
    const cot = await cotizar('Para anular', [{ tipo: 'manual', descripcion: 'Trabajo suelto', unidad: 'UND', cantidadMilesimas: 1000, precioUnitarioMilesimas: 100_000 }]);
    await datosDe(dueno, 'cotizacion_aceptar', { id: cot.id });
    await drenar();
    const propuesto = (await pendientes('ordenes')).find((b) => b.args.origenId === cot.id);
    await aprobar(propuesto.id);
    await aprobarHerramienta('cotizacion_anular', { id: cot.id, motivo: 'El cliente se arrepintió' });
    await drenar();
    const cancelar = (await pendientes('ordenes')).filter((b) => b.herramienta === 'pedido_cancelar' && b.origenRef === `cotizacion:${cot.id}`);
    expect(cancelar).toHaveLength(1);
    expect(cancelar[0].prioridad).toBe('alta');
  });
});
