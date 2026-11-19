import { describe, expect, it } from 'vitest';
import type { Anotacion, Borrador, TarjetaDePendiente } from '@capaz/shared';
import { componerMiDia, entidadDeBorrador, type FuenteLeida } from './mi-dia-logica.js';

const tarjeta = (o: Partial<TarjetaDePendiente> & { clave: string }): TarjetaDePendiente => ({
  grupo: 'entrega', urgencia: 'hoy', titulo: 'T', detalle: 'Entrega hoy · Listo: ¿ya se entregó?', fecha: '2026-11-18', montoCentimos: null, cliente: null,
  entidad: { tipo: 'pedido', id: 'p1', codigo: 'PED-1' }, acciones: [{ etiqueta: 'Ya se entregó', herramienta: 'pedido_cambiar_estado', args: { id: 'p1', estado: 'entregado' } }],
  mensaje: null, cobro: null, ...o,
});
const borrador = (o: Partial<Borrador> & { id: string }): Borrador => ({
  herramienta: 'deuda_abonar', modulo: 'registro', args: { id: 'd1', montoCentimos: 30_000 }, argsOriginales: {}, resumen: 'Cobrar el saldo del pedido', origen: 'modulo', origenRef: 'pedido:p9',
  prioridad: 'normal', estado: 'pendiente', corregido: false, propuestoPor: 'sistema', propuestoEn: '2026-11-17T15:00:00.000Z', capturaIniciadaEn: null, resueltoPor: null, resueltoEn: null, motivoDescarte: null, ...o,
});
const fuente = (modulo: string, tarjetas: TarjetaDePendiente[], anotaciones: Anotacion[] = [], soloLectura = false): FuenteLeida => ({ modulo, soloLectura, tarjetas, anotaciones });
const todo = () => true;

describe('componerMiDia', () => {
  it('agrupa por urgencia, manda los cobros a «por cobrar» y lo informativo al final, en este orden', () => {
    const r = componerMiDia({
      fecha: '2026-11-18', borradores: [], puedeEjecutar: todo,
      fuentes: [
        fuente('ordenes', [tarjeta({ clave: 'a', urgencia: 'manana', entidad: { tipo: 'pedido', id: 'a', codigo: 'a' } }), tarjeta({ clave: 'b', urgencia: 'atrasado', entidad: { tipo: 'pedido', id: 'b', codigo: 'b' } }), tarjeta({ clave: 'c', urgencia: 'hoy', entidad: { tipo: 'pedido', id: 'c', codigo: 'c' } })]),
        fuente('registro', [tarjeta({ clave: 'cobrar:x', grupo: 'cobro', urgencia: 'atrasado', montoCentimos: 420_000, acciones: [], entidad: { tipo: 'cliente', id: 'x', codigo: 'X' } })]),
        fuente('insumos', [tarjeta({ clave: 'i', grupo: 'inventario', urgencia: 'info', acciones: [], entidad: { tipo: 'articulo', id: 'i', codigo: 'i' } })]),
      ],
    });
    expect(r.grupos.map((g) => g.clave)).toEqual(['atrasado', 'hoy', 'manana', 'por_cobrar', 'mas_adelante']);
    expect(r.resumen).toMatchObject({ entregasDeHoy: 1, entregasAtrasadas: 1, porCobrarVencidoCentimos: 420_000, porAprobar: 0 });
    expect(r.total).toBe(5);
  });

  it('quita las acciones de un módulo en solo lectura y las que la persona no puede ejecutar', () => {
    const lectura = componerMiDia({ fecha: 'x', borradores: [], puedeEjecutar: todo, fuentes: [fuente('ordenes', [tarjeta({ clave: 'a' })], [], true)] });
    expect(lectura.grupos[0]!.tarjetas[0]!.acciones).toEqual([]);
    const sinPermiso = componerMiDia({ fecha: 'x', borradores: [], puedeEjecutar: () => false, fuentes: [fuente('ordenes', [tarjeta({ clave: 'a' })])] });
    expect(sinPermiso.grupos[0]!.tarjetas[0]!.acciones).toEqual([]);
  });

  it('una anotación «Pagado» se aplica a la tarjeta de la misma entidad: «Pagado: ¿ya se entregó?»', () => {
    const r = componerMiDia({
      fecha: 'x', borradores: [], puedeEjecutar: todo,
      fuentes: [fuente('ordenes', [tarjeta({ clave: 'a' })]), fuente('registro', [], [{ entidad: { tipo: 'pedido', id: 'p1' }, texto: 'Pagado', tono: 'exito', pagado: true, conAdelanto: true }, { entidad: { tipo: 'pedido', id: 'otro' }, texto: 'Debe S/ 1.00', tono: 'aviso' }])],
    });
    const t = r.grupos[0]!.tarjetas[0]!;
    expect(t.detalle).toContain('Pagado: ¿ya se entregó?');
    expect(t.notas).toEqual([{ texto: 'Pagado', tono: 'exito' }]);
  });

  it('con saldo, la anotación «Debe S/ X» queda como nota; y la alerta de «sin adelanto» desaparece si ya hay un pago', () => {
    const r = componerMiDia({
      fecha: 'x', borradores: [], puedeEjecutar: todo,
      fuentes: [
        fuente('ordenes', [
          tarjeta({ clave: 'a', detalle: 'Entrega hoy · En proceso: ¿ya está listo?' }),
          tarjeta({ clave: 'ad1', grupo: 'adelanto', urgencia: 'pronto', acciones: [], entidad: { tipo: 'pedido', id: 'p2', codigo: 'p2' } }),
          tarjeta({ clave: 'ad2', grupo: 'adelanto', urgencia: 'pronto', acciones: [], entidad: { tipo: 'pedido', id: 'p3', codigo: 'p3' } }),
        ]),
        fuente('registro', [], [
          { entidad: { tipo: 'pedido', id: 'p1' }, texto: 'Debe S/ 60.00', tono: 'aviso', pagado: false, conAdelanto: true },
          { entidad: { tipo: 'pedido', id: 'p2' }, texto: 'Debe S/ 60.00', tono: 'aviso', pagado: false, conAdelanto: true },
          { entidad: { tipo: 'pedido', id: 'p3' }, texto: 'Debe S/ 100.00', tono: 'aviso', pagado: false, conAdelanto: false },
        ]),
      ],
    });
    const claves = r.grupos.flatMap((g) => g.tarjetas.map((t) => t.clave));
    expect(claves).toEqual(['a', 'ad2']);
    expect(r.grupos[0]!.tarjetas[0]!.notas).toEqual([{ texto: 'Debe S/ 60.00', tono: 'aviso' }]);
  });

  it('los borradores por aprobar van a «por aprobar» como «S/ X por aprobar», los de deuda primero', () => {
    const r = componerMiDia({
      fecha: 'x', puedeEjecutar: todo, fuentes: [],
      borradores: [borrador({ id: 'm', herramienta: 'movimiento_registrar', origenRef: null, resumen: 'Registrar egreso', args: {} }), borrador({ id: 'd' })],
    });
    const g = r.grupos.find((x) => x.clave === 'por_aprobar')!;
    expect(g.tarjetas.map((t) => t.clave)).toEqual(['borrador:d', 'borrador:m']);
    expect(g.tarjetas[0]!.titulo).toBe('S/ 300.00 por aprobar');
    expect(g.tarjetas[0]!.entidad).toMatchObject({ tipo: 'pedido', id: 'p9' });
    expect(g.tarjetas[1]!.entidad.tipo).toBe('borrador');
    expect(r.resumen.porAprobar).toBe(2);
  });

  it('un borrador de la misma entidad que una tarjeta no duplica: se vuelve nota de la tarjeta (salvo prioridad alta)', () => {
    const r = componerMiDia({
      fecha: 'x', puedeEjecutar: todo, fuentes: [fuente('ordenes', [tarjeta({ clave: 'a' })])],
      borradores: [borrador({ id: 'd', origenRef: 'pedido:p1' }), borrador({ id: 'alta', origenRef: 'pedido:p1', herramienta: 'deuda_anular', args: {}, resumen: 'Anular la deuda', prioridad: 'alta' })],
    });
    expect(r.grupos.find((g) => g.clave === 'por_aprobar')!.tarjetas.map((t) => t.clave)).toEqual(['borrador:alta']);
    expect(r.grupos.find((g) => g.clave === 'hoy')!.tarjetas[0]!.notas).toEqual([{ texto: 'S/ 300.00 por aprobar', tono: 'aviso' }]);
    expect(r.resumen.porAprobar).toBe(2);
  });

  it('sin nada devuelve el panel vacío', () => {
    expect(componerMiDia({ fecha: 'x', fuentes: [], borradores: [], puedeEjecutar: todo })).toMatchObject({ grupos: [], total: 0 });
  });
});

describe('entidadDeBorrador', () => {
  it('lee pedido:<id> y produccion:<id>; lo desconocido es el borrador mismo', () => {
    expect(entidadDeBorrador({ id: 'b', origenRef: 'produccion:o1' })).toEqual({ tipo: 'orden_trabajo', id: 'o1' });
    expect(entidadDeBorrador({ id: 'b', origenRef: 'adelanto:z' })).toEqual({ tipo: 'borrador', id: 'b' });
    expect(entidadDeBorrador({ id: 'b', origenRef: null })).toEqual({ tipo: 'borrador', id: 'b' });
  });
});
