import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Relevo } from '../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../core/herramientas/http-de-pruebas.js';
import { confirmando, datosDe } from '../../modules/registro/herramientas/pruebas-de-registro.js';
import { levantarApp, type AppDePruebas } from '../app-de-pruebas.js';

// Recorrido de cierre de la ola 4, por HTTP real: (a) captura por texto → borrador → aprobar → deuda con adelanto;
// (b) lista de precios → cotización → emitir → aceptar → el relevo propone el pedido → aprobar → confirmar → el relevo
// propone la deuda → aprobar. Los importes deben coincidir al céntimo en la cotización, el pedido y la deuda.

let app: AppDePruebas;
let dueno: Sesion;
let clienteId: string;
let futuro = Date.now() + 3_600_000;

async function drenar(): Promise<void> {
  const relevo = app.obtener(Relevo);
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

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  dueno = await abrirSesion(app, 'Dueña del recorrido 4');
  const empresaId = await crearEmpresa(dueno, 'Imprenta del recorrido 4');
  for (const modulo of ['registro', 'ordenes', 'cotizador']) await activarModulo(empresaId, modulo);
  await datosDe(dueno, 'registro_iniciar');
  clienteId = (await datosDe(dueno, 'clientes_crear', { nombre: 'Cristina Rojas' })).id;
});
afterAll(async () => {
  await app.cerrar();
});

describe('recorrido A de la ola 4: del dictado a la deuda con adelanto', () => {
  it('«contrato 240, adelanto 100» propone un borrador, se aprueba y deja una deuda parcial', async () => {
    const r = await datosDe(dueno, 'captura_proponer', {
      texto: 'Le vendí un contrato de 240 soles a Cristina Rojas, me adelantó 100',
      origen: 'texto',
      transcurridoMs: 4000,
      modulo: 'registro',
    });
    expect(r.borradores).toHaveLength(1);
    expect(r.borradores[0].herramienta).toBe('deuda_crear_con_adelanto');
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar' })).items).toEqual([]); // proponer no escribe
    await aprobar(r.borradores[0].id);
    const deudas = (await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar' })).items;
    expect(deudas).toHaveLength(1);
    expect(deudas[0]).toMatchObject({ totalCentimos: 24_000, estado: 'parcial' });
  });
});

describe('recorrido B de la ola 4: de la lista de precios al cobro', () => {
  let cotizacion: any;
  let pedidoId: string;

  it('2.500 volantes cotizan sin IGV con precio, IGV y total del servidor, y se emite con número', async () => {
    await datosDe(dueno, 'cotizador_iniciar');
    const lista = await datosDe(dueno, 'lista_precio_crear', {
      nombre: 'Volantes A5 4/4 couché 150 g',
      unidad: 'unidad',
      p100Centimos: 19_000,
      p1000Centimos: 58_000,
      p5000Centimos: 120_000,
    });
    const precio = await datosDe(dueno, 'precio_consultar', { listaId: lista.id, cantidadMilesimas: 2_500_000 });
    expect(precio.importeCentimos).toBe(87_739);
    expect(precio.igvCentimos).toBe(15_793);
    expect(precio.totalCentimos).toBe(103_532);

    const borrador = await datosDe(dueno, 'cotizacion_crear', {
      titulo: 'Volantes para el colegio',
      clienteId,
      lineas: [{ tipo: 'lista', listaId: lista.id, cantidadMilesimas: 2_500_000 }],
    });
    expect(borrador.estado).toBe('borrador');
    const emitida = (await confirmando(dueno, 'cotizacion_emitir', { id: borrador.id })).respuesta.cuerpo.datos;
    expect(emitida.estado).toBe('emitida');
    expect(emitida.codigo).toMatch(/^COT-\d{4}-0001$/);
    expect(emitida.totalCentimos).toBe(103_532);
    cotizacion = emitida;
  });

  it('al aceptar, el relevo propone el pedido y, aprobado, el total coincide al céntimo', async () => {
    await datosDe(dueno, 'cotizacion_aceptar', { id: cotizacion.id });
    expect(await pendientes('ordenes')).toEqual([]); // hasta que corre el relevo no hay nada
    await drenar();
    const propuestos = (await pendientes('ordenes')).filter((b) => b.args.origenId === cotizacion.id);
    expect(propuestos).toHaveLength(1);
    expect(propuestos[0]).toMatchObject({ herramienta: 'pedido_crear', origen: 'modulo' });
    expect(propuestos[0].args.notas).toBe(`Cotización ${cotizacion.codigo}`);

    const creado = await aprobar(propuestos[0].id);
    pedidoId = creado.resultado?.id ?? creado.id;
    const pedido = await datosDe(dueno, 'pedido_ver', { id: pedidoId });
    expect(pedido.totalCentimos).toBe(103_532);
  });

  it('confirmar el pedido propone la deuda por cobrar con el mismo total', async () => {
    await datosDe(dueno, 'pedido_confirmar', { id: pedidoId });
    await drenar();
    const deudas = (await pendientes('registro')).filter((b) => b.herramienta === 'deuda_crear' && b.args.origenId === pedidoId);
    expect(deudas).toHaveLength(1);
    expect(deudas[0].args).toMatchObject({ tipo: 'por_cobrar', contactoId: clienteId, totalCentimos: 103_532 });
    await aprobar(deudas[0].id);
    const abiertas = (await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar' })).items.filter((d: any) => d.totalCentimos === 103_532);
    expect(abiertas).toHaveLength(1);
  });

  it('aceptar dos veces no crea un segundo pedido', async () => {
    const otra = await dueno.herramienta('cotizacion_aceptar', { id: cotizacion.id });
    expect(otra.cuerpo?.ok).toBe(false);
    await drenar();
    expect((await pendientes('ordenes')).filter((b) => b.args.origenId === cotizacion.id)).toEqual([]);
  });
});
