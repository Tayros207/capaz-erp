import { describe, expect, it, vi } from 'vitest';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import type { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta, HerramientaRegistrada } from '../herramientas/tipos.js';

vi.mock('../empresas/hoy.js', () => ({ hoyDeLaEmpresa: vi.fn(async () => ({ zona: 'America/Lima', dia: '2026-11-18', anio: 2026 })) }));
const { consultarMiDia, pendientesRegistradas, puedeEjecutarDesdeMiDia } = await import('./mi-dia.js');

const acceso = (codigo: string, o: { puedeEntrar?: boolean; puedeEscribir?: boolean } = {}) =>
  ({ codigo, motivo: 'activo', visible: true, puedeEntrar: o.puedeEntrar ?? true, puedeEscribir: o.puedeEscribir ?? true, nivel: 'completo', alcance: 'todos', diasDePrueba: null }) as const;
const ctxDe = (modulos: ReturnType<typeof acceso>[], permisos: string[]): ContextoDeHerramienta => ({ requestId: 'r', empresaId: 'e', usuarioId: 'u', rol: 'owner', permisos, modulos, canal: 'ui' });
const h = (nombre: string, modulo: string, permiso: string | null, criticidad = 'lectura') => ({ nombre, modulo, permiso, criticidad }) as HerramientaRegistrada;
const REGISTRO = [
  h('ordenes_pendientes', 'ordenes', 'ordenes:ver'),
  h('registro_pendientes', 'registro', 'registro:ver'),
  h('insumos_pendientes', 'insumos', 'insumos:ver'),
  h('borradores_listar', 'core', 'borradores:ver'),
  h('pedido_cambiar_estado', 'ordenes', 'ordenes:editar', 'normal'),
  h('deuda_abonar', 'registro', 'registro:editar', 'normal'),
];
const registro = { todas: () => REGISTRO } as unknown as RegistroDeHerramientas;

const tarjeta = {
  clave: 'p', grupo: 'entrega', urgencia: 'hoy', titulo: 'PED', detalle: 'Listo: ¿ya se entregó?', fecha: '2026-11-18', montoCentimos: null, cliente: null,
  entidad: { tipo: 'pedido', id: 'p1', codigo: 'PED' }, acciones: [{ etiqueta: 'Ya se entregó', herramienta: 'pedido_cambiar_estado', args: { id: 'p1', estado: 'entregado' } }], mensaje: null, cobro: null,
};
const borradorDe = { id: 'b1', herramienta: 'deuda_abonar', modulo: 'registro', args: { id: 'd', montoCentimos: 5_000 }, argsOriginales: {}, resumen: 'Cobrar', origen: 'modulo', origenRef: 'pedido:p1', prioridad: 'normal', estado: 'pendiente', corregido: false, propuestoPor: 'sistema', propuestoEn: '2026-11-17T10:00:00.000Z', capturaIniciadaEn: null, resueltoPor: null, resueltoEn: null, motivoDescarte: null };

function ejecutorCon(respuestas: Record<string, unknown>) {
  const llamadas: Array<{ nombre: string; args: unknown }> = [];
  const ejecutor = {
    ejecutarDentro: async (_tx: unknown, nombre: string, args: unknown) => {
      llamadas.push({ nombre, args });
      const r = respuestas[nombre];
      return r === 'error' ? { ok: false, error: { codigo: 'sin_permiso', mensaje: 'no' } } : { ok: true, datos: r };
    },
  } as unknown as EjecutorDeHerramientas;
  return { ejecutor, llamadas };
}
const salida = (tarjetas: unknown[], anotaciones: unknown[] = []) => ({ fecha: '2026-11-18', tarjetas, anotaciones, total: tarjetas.length });
const tx = {} as never;
const ver = async (ejecutor: EjecutorDeHerramientas, ctx: ContextoDeHerramienta) => {
  const r = await consultarMiDia(ejecutor, registro, tx, ctx, {});
  if (!r.ok || !('datos' in r)) throw new Error('se esperaba éxito');
  return r.datos;
};

describe('descubrimiento', () => {
  it('encuentra las `_pendientes` por sufijo y excluye las del núcleo', () => {
    expect(pendientesRegistradas(registro).map((d) => d.modulo)).toEqual(['insumos', 'ordenes', 'registro']);
  });
  it('puedeEjecutarDesdeMiDia pide módulo con escritura y permiso', () => {
    const ok = puedeEjecutarDesdeMiDia(registro, ctxDe([acceso('ordenes')], ['ordenes:editar']));
    expect(ok('pedido_cambiar_estado')).toBe(true);
    expect(ok('deuda_abonar')).toBe(false);
    expect(puedeEjecutarDesdeMiDia(registro, ctxDe([acceso('ordenes', { puedeEscribir: false })], ['ordenes:editar']))('pedido_cambiar_estado')).toBe(false);
    expect(puedeEjecutarDesdeMiDia(registro, ctxDe([acceso('ordenes')], []))('pedido_cambiar_estado')).toBe(false);
  });
});

describe('consultarMiDia (herramientas falsas)', () => {
  const TODOS = ctxDe([acceso('ordenes'), acceso('registro'), acceso('insumos')], ['ordenes:ver', 'ordenes:editar', 'registro:ver', 'registro:editar', 'insumos:ver', 'borradores:ver']);

  it('llama una vez a cada módulo y a los borradores, pasa la fecha y lista las fuentes', async () => {
    const { ejecutor, llamadas } = ejecutorCon({
      ordenes_pendientes: salida([tarjeta]),
      registro_pendientes: salida([], [{ entidad: { tipo: 'pedido', id: 'p1' }, texto: 'Pagado', tono: 'exito', pagado: true }]),
      insumos_pendientes: salida([]),
      borradores_listar: { items: [], siguiente: null },
    });
    const d = await ver(ejecutor, TODOS);
    expect(llamadas.map((l) => l.nombre)).toEqual(['insumos_pendientes', 'ordenes_pendientes', 'registro_pendientes', 'borradores_listar']);
    expect(llamadas[0]!.args).toEqual({ fecha: '2026-11-18' });
    expect(d.fuentesConsultadas.every((f) => f.incluida)).toBe(true);
    expect(d.grupos[0]!.tarjetas[0]!.detalle).toContain('Pagado: ¿ya se entregó?');
  });

  it('un módulo sin acceso (o sin el permiso) no se llama y se lista; otro no contratado ni aparece', async () => {
    const ctx = ctxDe([acceso('ordenes'), acceso('registro', { puedeEntrar: false })], ['ordenes:ver', 'ordenes:editar', 'borradores:ver']);
    const { ejecutor, llamadas } = ejecutorCon({ ordenes_pendientes: salida([tarjeta]), borradores_listar: { items: [], siguiente: null } });
    const d = await ver(ejecutor, ctx);
    expect(llamadas.map((l) => l.nombre)).toEqual(['ordenes_pendientes', 'borradores_listar']);
    expect(d.fuentesConsultadas).toEqual(expect.arrayContaining([{ modulo: 'registro', incluida: false, aviso: 'sin acceso' }, { modulo: 'ordenes', incluida: true, aviso: null }]));
    expect(d.fuentesConsultadas.some((f) => f.modulo === 'insumos')).toBe(false);
    const sinPermiso = await ver(ejecutorCon({ borradores_listar: { items: [], siguiente: null } }).ejecutor, ctxDe([acceso('ordenes')], ['borradores:ver']));
    expect(sinPermiso.fuentesConsultadas).toContainEqual({ modulo: 'ordenes', incluida: false, aviso: 'sin acceso' });
  });

  it('en solo lectura no hay acciones; sin borradores:ver no se leen borradores; un módulo que falla se avisa', async () => {
    const ctx = ctxDe([acceso('ordenes', { puedeEscribir: false }), acceso('registro')], ['ordenes:ver', 'ordenes:editar', 'registro:ver']);
    const { ejecutor, llamadas } = ejecutorCon({ ordenes_pendientes: salida([tarjeta]), registro_pendientes: 'error' });
    const d = await ver(ejecutor, ctx);
    expect(d.grupos[0]!.tarjetas[0]!.acciones).toEqual([]);
    expect(llamadas.some((l) => l.nombre === 'borradores_listar')).toBe(false);
    expect(d.fuentesConsultadas).toEqual(expect.arrayContaining([{ modulo: 'registro', incluida: false, aviso: 'no se pudo consultar' }, { modulo: 'borradores', incluida: false, aviso: 'sin acceso' }]));
  });

  it('un borrador pendiente de la misma entidad no duplica la tarjeta', async () => {
    const { ejecutor } = ejecutorCon({ ordenes_pendientes: salida([tarjeta]), registro_pendientes: salida([]), insumos_pendientes: salida([]), borradores_listar: { items: [borradorDe], siguiente: null } });
    const d = await ver(ejecutor, TODOS);
    expect(d.total).toBe(1);
    expect(d.grupos[0]!.tarjetas[0]!.notas).toEqual([{ texto: 'S/ 50.00 por aprobar', tono: 'aviso' }]);
  });

  it('un borrador cuya herramienta la persona no puede usar no se muestra', async () => {
    const ctx = ctxDe([acceso('registro')], ['registro:ver', 'borradores:ver']);
    const { ejecutor } = ejecutorCon({ registro_pendientes: salida([]), borradores_listar: { items: [borradorDe], siguiente: null } });
    expect((await ver(ejecutor, ctx)).total).toBe(0);
  });
});
