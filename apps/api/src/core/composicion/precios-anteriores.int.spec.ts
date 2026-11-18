import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type RespuestaHttp, type Sesion } from '../herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';

// precio_anterior_consultar por HTTP real, con las tres subherramientas verdaderas: pedidos, cotizaciones y órdenes de trabajo.

let app: AppDePruebas;
let dueno: Sesion;
let soloPedidos: Sesion;
let sinClientes: Sesion;
let cristina: string;
let cotCajas: any;

const datos = (r: RespuestaHttp): any => {
  if (!r.cuerpo?.ok) throw new Error(`Respuesta ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const llamar = async (s: Sesion, nombre: string, args: unknown) => datos(await s.herramienta(nombre, args));
/** Una crítica en dos pasos. */
async function confirmando(s: Sesion, nombre: string, args: unknown) {
  const pide = await s.herramienta(nombre, args);
  const token = pide.cuerpo?.requiereConfirmacion?.token;
  return datos(token ? await s.herramienta(nombre, args, { confirmacion: token }) : pide);
}
const linea = (descripcion: string, soles: number, cantidad: number) => ({ descripcion, cantidadMilesimas: cantidad * 1000, precioUnitarioMilesimas: soles * 1000 });
const consultar = (s: Sesion, args: Record<string, unknown>) => s.herramienta('precio_anterior_consultar', args);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, soloPedidos, sinClientes] = await Promise.all(['Dueña', 'Solo pedidos', 'Sin clientes'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Empresa de precio anterior');
  await Promise.all(['ordenes', 'cotizador', 'produccion'].map((m) => activarModulo(A, m)));
  await agregarMiembro(app, A, soloPedidos, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, sinClientes, { modulo: 'produccion', nivel: 'lectura', alcance: 'todos' });
  cristina = (await llamar(dueno, 'clientes_crear', { nombre: 'Cristina Neira' })).id;
  await llamar(dueno, 'clientes_crear', { nombre: 'Cristina Paz' });

  // Cotización de las cajas, aceptada y convertida en pedido (origen cotización): solo debe verse el pedido.
  cotCajas = await confirmando(dueno, 'cotizacion_emitir', { id: (await llamar(dueno, 'cotizacion_crear', { titulo: 'Cajas', clienteId: cristina, lineas: [{ tipo: 'manual', descripcion: 'Caja de bocaditos', cantidadMilesimas: 50_000, precioUnitarioMilesimas: 100_000 }] })).id });
  await llamar(dueno, 'cotizacion_aceptar', { id: cotCajas.id });
  const ped = await llamar(dueno, 'pedido_crear', { clienteId: cristina, fecha: '2026-05-10', origenTipo: 'cotizacion', origenId: cotCajas.id, lineas: [linea('Caja de bocaditos surtidos', 118, 50)] });
  await llamar(dueno, 'pedido_confirmar', { id: ped.id });
  // Una orden de trabajo del mismo producto, y una cotización de otro producto sin pedido.
  await llamar(dueno, 'produccion_orden_crear', { clienteId: cristina, fecha: '2026-08-01', lineas: [linea('Cajas de bocaditos', 15, 20)] });
  await confirmando(dueno, 'cotizacion_emitir', { id: (await llamar(dueno, 'cotizacion_crear', { titulo: 'Volantes', clienteId: cristina, lineas: [{ tipo: 'manual', descripcion: 'Volantes A5 couché', cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 240 }] })).id });
});
afterAll(async () => {
  await app.cerrar();
});

describe('precio_anterior_consultar', () => {
  it('«cuánto le cobramos a Cristina Neira por las cajas»: el último es la OT; el pedido va al historial y la cotización origen se oculta', async () => {
    const r = datos(await consultar(dueno, { clienteTexto: 'Cristina Neira', texto: 'las cajas de bocaditos' }));
    expect(r.cliente).toEqual({ id: cristina, nombre: 'Cristina Neira' });
    expect(r.ultimo).toMatchObject({ fuente: 'orden_trabajo', precioUnitarioMilesimas: 15_000, baseDePrecio: 'sin_desglose', coincidencia: 'misma_descripcion' });
    expect(r.historial.map((f: any) => [f.fuente, f.documento.fecha])).toEqual([['pedido', '2026-05-10']]);
    expect(r.fuentesConsultadas).toHaveLength(3);
    expect(r.fuentesConsultadas.every((f: any) => f.incluida)).toBe(true);
  });

  it('un nombre ambiguo devuelve candidatos', async () => {
    const r = datos(await consultar(dueno, { clienteTexto: 'Cristina', texto: 'cajas de bocaditos' }));
    expect(r.cliente).toBeNull();
    expect(r.candidatosDeCliente.map((c: any) => c.nombre).sort()).toEqual(['Cristina Neira', 'Cristina Paz']);
    expect(r.ultimo).toBeNull();
  });

  it('si solo hay cotización de ese producto, es el último y se marca por su fuente', async () => {
    const r = datos(await consultar(dueno, { clienteId: cristina, texto: 'volantes A5' }));
    expect(r.ultimo).toMatchObject({ fuente: 'cotizacion', baseDePrecio: 'sin_igv', precioSinIgvMilesimas: 240 });
  });

  it('sin cliente busca por producto en toda la empresa', async () => {
    const r = datos(await consultar(dueno, { texto: 'cajas de bocaditos' }));
    expect(r.cliente).toBeNull();
    expect(r.ultimo?.fuente).toBe('orden_trabajo');
  });

  it('quien solo ve pedidos recibe el aviso de lo que no se incluyó', async () => {
    const r = datos(await consultar(soloPedidos, { clienteId: cristina, texto: 'cajas de bocaditos' }));
    expect(r.ultimo?.fuente).toBe('pedido');
    expect(r.fuentesConsultadas.filter((f: any) => !f.incluida).map((f: any) => f.aviso).sort()).toEqual(['no incluye cotizaciones: sin acceso', 'no incluye órdenes de trabajo: sin acceso']);
  });

  it('solo con el cliente lista lo último por producto (sin repetir) y sin cliente ni producto se rechaza', async () => {
    const r = datos(await consultar(dueno, { clienteId: cristina, limite: 30 }));
    expect(r.ultimo).toBeNull();
    expect(r.historial.every((f: any) => f.coincidencia === 'del_cliente' && f.cliente.id === cristina)).toBe(true);
    // La OT de cajas (agosto), la cotización de volantes y el pedido de cajas (mayo; su cotización origen se oculta).
    expect(r.historial.map((f: any) => [f.fuente, f.descripcion])).toEqual([
      ['cotizacion', 'Volantes A5 couché'],
      ['orden_trabajo', 'Cajas de bocaditos'],
      ['pedido', 'Caja de bocaditos surtidos'],
    ]);
    expect((await consultar(dueno, {})).cuerpo?.error?.codigo).toBe('argumentos_invalidos');
  });

  it('quien solo ve producción solo recibe órdenes de trabajo', async () => {
    const r = datos(await consultar(sinClientes, { texto: 'cajas de bocaditos' }));
    expect(r.ultimo?.fuente).toBe('orden_trabajo');
    expect(r.historial).toEqual([]);
  });
});
