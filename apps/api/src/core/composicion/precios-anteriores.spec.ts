import { describe, expect, it, vi } from 'vitest';
import type { FilaDePrecioAnterior } from '@capaz/shared';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import type { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta, HerramientaRegistrada } from '../herramientas/tipos.js';

vi.mock('../clientes/repositories/clientes.repository.js', () => ({
  verCliente: vi.fn(async (_tx: unknown, _ctx: unknown, id: string) => (id === 'c1' ? { id: 'c1', nombre: 'Cristina Neira' } : null)),
  buscarClientes: vi.fn(async (_tx: unknown, _ctx: unknown, texto: string) =>
    texto === 'cristina' ? [{ id: 'c1', nombre: 'Cristina Neira', parecido: 0.5 }] : texto === 'ana' ? [{ id: 'a1', nombre: 'Ana Paz', parecido: 0.4 }, { id: 'a2', nombre: 'Ana Ruiz', parecido: 0.4 }] : [],
  ),
}));
vi.mock('../productos/repositories/productos.repository.js', () => ({ verProducto: vi.fn(async () => ({ id: 'p1', nombre: 'Caja de bocaditos' })) }));
vi.mock('../empresas/hoy.js', () => ({ hoyDeLaEmpresa: vi.fn(async () => ({ zona: 'America/Lima', dia: '2026-11-18', anio: 2026 })) }));

const { clasificarFilas, consultarPrecioAnterior, elegirCliente, ordenarResultado, subherramientasDe, ultimosPorProducto } = await import('./precios-anteriores.js');

const fila = (o: Partial<FilaDePrecioAnterior> & { fuente: FilaDePrecioAnterior['fuente'] }): FilaDePrecioAnterior => ({
  documento: { id: 'd', codigo: 'X-1', estado: 'confirmado', fecha: '2026-05-10' },
  cliente: { id: 'c1', nombre: 'Cristina Neira' },
  productoId: null,
  descripcion: 'Caja de bocaditos surtidos',
  unidad: 'caja',
  cantidadMilesimas: 50_000,
  precioUnitarioMilesimas: 118_000,
  baseDePrecio: 'con_igv',
  igvPorcentaje: 18,
  precioConIgvMilesimas: 118_000,
  precioSinIgvMilesimas: 100_000,
  importeCentimos: 590_000,
  origen: null,
  ...o,
});
const doc = (id: string, fecha: string, estado = 'confirmado') => ({ id, codigo: id.toUpperCase(), estado, fecha });

describe('elegirCliente', () => {
  it('uno solo, o un nombre idéntico, se elige; empates piden elegir', () => {
    expect(elegirCliente('cristina', [{ id: 'c1', nombre: 'Cristina Neira', parecido: 0.3 }]).elegido?.id).toBe('c1');
    expect(elegirCliente('Ana Paz', [{ id: 'a1', nombre: 'Ana Paz', parecido: 1 }, { id: 'a3', nombre: 'Ana Paz Soto', parecido: 0.8 }]).elegido?.id).toBe('a1');
    const r = elegirCliente('ana', [{ id: 'a1', nombre: 'Ana Paz', parecido: 0.4 }, { id: 'a2', nombre: 'Ana Ruiz', parecido: 0.4 }]);
    expect(r.elegido).toBeNull();
    expect(r.candidatos).toHaveLength(2);
    expect(elegirCliente('x', [])).toEqual({ elegido: null, candidatos: [] });
  });
});

describe('clasificarFilas', () => {
  it('productoId igual gana; la descripción decide el resto; lo que no se parece se descarta', () => {
    const r = clasificarFilas(
      [fila({ fuente: 'pedido', productoId: 'p1', descripcion: 'Otra cosa' }), fila({ fuente: 'pedido' }), fila({ fuente: 'pedido', descripcion: 'Banner gigantografía' })],
      { productoId: 'p1', texto: 'cajas de bocaditos' },
    );
    expect(r.map((f) => f.coincidencia)).toEqual(['producto', 'misma_descripcion']);
    expect(r[0]!.puntaje).toBe(1);
  });
});

describe('ordenarResultado', () => {
  const c = (f: Parameters<typeof fila>[0], coincidencia: 'producto' | 'misma_descripcion' | 'parecida' = 'misma_descripcion') => ({ ...fila(f), coincidencia, puntaje: coincidencia === 'parecida' ? 0.6 : 0.9 });

  it('el último es lo más reciente entre pedidos y OT; una cotización más nueva no lo desplaza', () => {
    const r = ordenarResultado(
      [
        c({ fuente: 'pedido', documento: doc('ped-1', '2026-03-01') }),
        c({ fuente: 'orden_trabajo', documento: doc('ot-1', '2026-05-01', 'entregado') }),
        c({ fuente: 'cotizacion', documento: doc('cot-1', '2026-09-01', 'emitida') }),
      ],
      10,
    );
    expect(r.ultimo?.documento.id).toBe('ot-1');
    expect(r.historial.map((f) => f.documento.id)).toEqual(['cot-1', 'ped-1']);
  });

  it('sin pedidos ni OT exactos, la cotización más reciente es el último; las parecidas nunca', () => {
    const solo = ordenarResultado([c({ fuente: 'cotizacion', documento: doc('cot-1', '2026-09-01', 'emitida') }), c({ fuente: 'cotizacion', documento: doc('cot-2', '2026-02-01', 'rechazada') })], 10);
    expect(solo.ultimo?.documento.id).toBe('cot-1');
    const parecida = ordenarResultado([c({ fuente: 'pedido', documento: doc('ped-1', '2026-03-01') }, 'parecida')], 10);
    expect(parecida.ultimo).toBeNull();
    expect(parecida.historial).toHaveLength(1);
  });

  it('oculta la cotización aceptada que ya es origen de un pedido', () => {
    const r = ordenarResultado(
      [
        c({ fuente: 'pedido', documento: doc('ped-1', '2026-03-05'), origen: { tipo: 'cotizacion', id: 'cot-1' } }),
        c({ fuente: 'cotizacion', documento: doc('cot-1', '2026-03-01', 'aceptada') }),
        c({ fuente: 'cotizacion', documento: doc('cot-2', '2026-02-01', 'aceptada') }),
      ],
      10,
    );
    expect(r.ultimo?.documento.id).toBe('ped-1');
    expect(r.historial.map((f) => f.documento.id)).toEqual(['cot-2']);
  });

  it('respeta el límite del historial', () => {
    const filas = ['a', 'b', 'c', 'd'].map((id, i) => c({ fuente: 'pedido', documento: doc(id, `2026-0${i + 1}-01`) }));
    expect(ordenarResultado(filas, 2).historial).toHaveLength(2);
  });
});

describe('ultimosPorProducto (solo cliente)', () => {
  it('una fila por producto y unidad, la más reciente; el plural y las tildes cuentan como lo mismo', () => {
    const r = ultimosPorProducto(
      [
        fila({ fuente: 'pedido', documento: doc('p1', '2026-03-01'), descripcion: 'Cajas de bocaditos' }),
        fila({ fuente: 'pedido', documento: doc('p2', '2026-06-01'), descripcion: 'caja de bocaditos' }),
        fila({ fuente: 'pedido', documento: doc('p3', '2026-05-01'), descripcion: 'Volantes A5', unidad: 'millar' }),
        fila({ fuente: 'pedido', documento: doc('p4', '2026-04-01'), descripcion: 'Volantes A5', unidad: 'ciento' }),
      ],
      10,
    );
    expect(r.map((f) => f.documento.id)).toEqual(['p2', 'p3', 'p4']);
    expect(r.every((f) => f.coincidencia === 'del_cliente' && f.puntaje === 1)).toBe(true);
  });
  it('el producto del catálogo agrupa aunque cambie la descripción; un pedido gana a una cotización más nueva', () => {
    const r = ultimosPorProducto(
      [
        fila({ fuente: 'cotizacion', documento: doc('c1', '2026-09-01', 'emitida'), productoId: 'pr', descripcion: 'Tarjetas premium' }),
        fila({ fuente: 'pedido', documento: doc('p1', '2026-02-01'), productoId: 'pr', descripcion: 'Tarjetas' }),
      ],
      10,
    );
    expect(r.map((f) => f.documento.id)).toEqual(['p1']);
  });
  it('oculta la cotización aceptada que ya es origen de un pedido y respeta el límite', () => {
    const r = ultimosPorProducto(
      [
        fila({ fuente: 'cotizacion', documento: doc('cot', '2026-01-01', 'aceptada'), descripcion: 'Banner' }),
        fila({ fuente: 'pedido', documento: doc('ped', '2026-01-02'), descripcion: 'Caja', origen: { tipo: 'cotizacion', id: 'cot' } }),
        fila({ fuente: 'pedido', documento: doc('x', '2026-01-03'), descripcion: 'Sobre manila' }),
      ],
      1,
    );
    expect(r.map((f) => f.documento.id)).toEqual(['x']);
    expect(ultimosPorProducto([fila({ fuente: 'cotizacion', documento: doc('cot', '2026-01-01', 'aceptada'), descripcion: 'Banner' }), fila({ fuente: 'pedido', documento: doc('ped', '2026-01-02'), descripcion: 'Caja', origen: { tipo: 'cotizacion', id: 'cot' } })], 10).map((f) => f.documento.id)).toEqual(['ped']);
  });
});

// --- orquestación con subherramientas falsas ---

const acceso = (codigo: string, puedeEntrar = true) => ({ codigo, motivo: 'activo', visible: true, puedeEntrar, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null }) as const;
const ctxDe = (modulos: ReturnType<typeof acceso>[], permisos: string[]): ContextoDeHerramienta => ({
  requestId: 'r', empresaId: 'e', usuarioId: 'u', rol: 'owner', permisos, modulos, canal: 'ui',
});
const sub = (modulo: string, permiso: string) => ({ nombre: `${modulo}_precios_anteriores`, modulo, permiso }) as HerramientaRegistrada;
const registroCon = (hs: HerramientaRegistrada[]) => ({ todas: () => hs }) as unknown as RegistroDeHerramientas;
const ejecutorCon = (porHerramienta: Record<string, unknown>) => {
  const llamadas: Array<{ nombre: string; args: any }> = [];
  const ejecutor = {
    ejecutarDentro: async (_tx: unknown, nombre: string, args: any) => {
      llamadas.push({ nombre, args });
      const r = porHerramienta[nombre];
      return r === 'error' ? { ok: false, error: { codigo: 'sin_permiso', mensaje: 'no' } } : { ok: true, datos: { filas: r ?? [] } };
    },
  } as unknown as EjecutorDeHerramientas;
  return { ejecutor, llamadas };
};
const TODOS = [sub('ordenes', 'ordenes:ver'), sub('cotizador', 'cotizador:ver'), sub('produccion', 'produccion:ver')];
const tx = {} as never;

describe('subherramientasDe', () => {
  it('descubre por sufijo y marca cuáles puede usar la persona (módulo y permiso)', () => {
    const r = subherramientasDe(registroCon([...TODOS, { nombre: 'clientes_listar', modulo: 'core', permiso: null } as HerramientaRegistrada]), ctxDe([acceso('ordenes'), acceso('cotizador'), acceso('produccion', false)], ['ordenes:ver']));
    expect(r.map((s) => [s.fuente, s.puede])).toEqual([['pedido', true], ['cotizacion', false], ['orden_trabajo', false]]);
  });
});

describe('consultarPrecioAnterior (subherramientas falsas)', () => {
  const todosLosPermisos = ['clientes:ver', 'ordenes:ver', 'cotizador:ver', 'produccion:ver'];
  const ctx = ctxDe([acceso('ordenes'), acceso('cotizador'), acceso('produccion')], todosLosPermisos);

  it('junta las tres fuentes, calcula el último y manda las raíces y el cliente a cada módulo', async () => {
    const { ejecutor, llamadas } = ejecutorCon({
      ordenes_precios_anteriores: [fila({ fuente: 'pedido', documento: doc('ped-1', '2026-03-01') })],
      cotizador_precios_anteriores: [fila({ fuente: 'cotizacion', documento: doc('cot-1', '2026-09-01', 'emitida') })],
      produccion_precios_anteriores: [fila({ fuente: 'orden_trabajo', documento: doc('ot-1', '2026-05-01', 'entregado'), baseDePrecio: 'sin_desglose', precioConIgvMilesimas: null, precioSinIgvMilesimas: null, igvPorcentaje: null })],
    });
    const r = await consultarPrecioAnterior(ejecutor, registroCon(TODOS), tx, ctx, { clienteTexto: 'Cristina', texto: 'cajas de bocaditos', limite: 10 });
    if (!r.ok || !('datos' in r)) throw new Error('se esperaba éxito');
    expect(r.datos.cliente).toEqual({ id: 'c1', nombre: 'Cristina Neira' });
    expect(r.datos.ultimo?.documento.id).toBe('ot-1');
    expect(r.datos.historial.map((f) => f.documento.id)).toEqual(['cot-1', 'ped-1']);
    expect(r.datos.fuentesConsultadas.every((f) => f.incluida && f.aviso === null)).toBe(true);
    expect(llamadas).toHaveLength(3);
    expect(llamadas[0]!.args).toMatchObject({ clienteId: 'c1', raices: expect.arrayContaining(['caj', 'boc']) });
    expect(llamadas[0]!.args.desde).toBeUndefined();
  });

  it('sin acceso a un módulo no lo llama y lo avisa; un módulo que falla también se avisa', async () => {
    const limitado = ctxDe([acceso('ordenes'), acceso('cotizador'), acceso('produccion', false)], ['clientes:ver', 'ordenes:ver', 'cotizador:ver']);
    const { ejecutor, llamadas } = ejecutorCon({ ordenes_precios_anteriores: [fila({ fuente: 'pedido' })], cotizador_precios_anteriores: 'error' });
    const r = await consultarPrecioAnterior(ejecutor, registroCon(TODOS), tx, limitado, { clienteId: 'c1', texto: 'cajas de bocaditos', limite: 10 });
    if (!r.ok || !('datos' in r)) throw new Error('se esperaba éxito');
    expect(llamadas.map((l) => l.nombre)).toEqual(['ordenes_precios_anteriores', 'cotizador_precios_anteriores']);
    const avisos = r.datos.fuentesConsultadas.filter((f) => !f.incluida).map((f) => f.aviso);
    expect(avisos).toEqual(expect.arrayContaining(['no incluye órdenes de trabajo: sin acceso', 'no incluye cotizaciones: no se pudo consultar']));
    expect(r.datos.ultimo?.fuente).toBe('pedido');
  });

  it('un cliente ambiguo devuelve candidatos y no consulta nada; uno inexistente, vacío', async () => {
    const { ejecutor, llamadas } = ejecutorCon({});
    const a = await consultarPrecioAnterior(ejecutor, registroCon(TODOS), tx, ctx, { clienteTexto: 'Ana', texto: 'cajas', limite: 10 });
    if (!a.ok || !('datos' in a)) throw new Error('se esperaba éxito');
    expect(a.datos.cliente).toBeNull();
    expect(a.datos.candidatosDeCliente.map((c) => c.id)).toEqual(['a1', 'a2']);
    const n = await consultarPrecioAnterior(ejecutor, registroCon(TODOS), tx, ctx, { clienteId: 'otro', texto: 'cajas', limite: 10 });
    if (!n.ok || !('datos' in n)) throw new Error('se esperaba éxito');
    expect(n.datos).toMatchObject({ cliente: null, candidatosDeCliente: [], ultimo: null, historial: [] });
    expect(llamadas).toHaveLength(0);
  });

  it('solo con el cliente lista lo último por producto, sin prefiltro de descripción ni «último»', async () => {
    const { ejecutor, llamadas } = ejecutorCon({
      ordenes_precios_anteriores: [fila({ fuente: 'pedido', documento: doc('ped-1', '2026-03-01') }), fila({ fuente: 'pedido', documento: doc('ped-2', '2026-04-01'), descripcion: 'Volantes A5' })],
    });
    const r = await consultarPrecioAnterior(ejecutor, registroCon(TODOS), tx, ctx, { clienteId: 'c1', limite: 30 });
    if (!r.ok || !('datos' in r)) throw new Error('se esperaba éxito');
    expect(r.datos).toMatchObject({ cliente: { id: 'c1' }, ultimo: null });
    expect(r.datos.historial.map((f) => [f.documento.id, f.coincidencia])).toEqual([['ped-2', 'del_cliente'], ['ped-1', 'del_cliente']]);
    expect(llamadas).toHaveLength(3);
    expect(llamadas[0]!.args).toEqual({ clienteId: 'c1', raices: [] });
    // Un cliente que no existe no consulta nada.
    const n = await consultarPrecioAnterior(ejecutor, registroCon(TODOS), tx, ctx, { clienteId: 'otro', limite: 30 });
    if (!n.ok || !('datos' in n)) throw new Error('se esperaba éxito');
    expect(n.datos.historial).toEqual([]);
    expect(llamadas).toHaveLength(3);
  });

  it('sin cliente busca los últimos 2 años con hasta 200 documentos', async () => {
    const { ejecutor, llamadas } = ejecutorCon({});
    await consultarPrecioAnterior(ejecutor, registroCon(TODOS), tx, ctx, { productoId: 'p1', limite: 10 });
    expect(llamadas[0]!.args).toMatchObject({ productoId: 'p1', desde: '2024-11-18', limiteDocumentos: 200 });
    expect(llamadas[0]!.args.clienteId).toBeUndefined();
  });
});
