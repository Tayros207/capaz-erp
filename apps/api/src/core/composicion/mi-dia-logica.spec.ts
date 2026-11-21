import { describe, expect, it } from 'vitest';
import type { Anotacion, Borrador, TarjetaDePendiente } from '@capaz/shared';
import { componerMiDia, entidadDeBorrador, grupoDe, type FuenteLeida } from './mi-dia-logica.js';

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
    expect(t.detalle).toBe('Entrega hoy · Pagado: ¿ya se entregó?');
    expect(t.notas).toEqual([{ texto: 'Pagado', tono: 'exito' }]);
  });

  it('el pago que anota Finanzas manda sobre el que anotó el propio módulo: nunca «Pagado» y «Debe» juntos', () => {
    const ot = tarjeta({ clave: 'o', detalle: 'Vence hoy · Listo: ¿ya se entregó?', entidad: { tipo: 'orden_trabajo', id: 'o1', codigo: 'OT-1' }, acciones: [{ etiqueta: 'Ya se entregó', herramienta: 'produccion_orden_estado', args: { id: 'o1', estado: 'entregado' } }] });
    const propia: Anotacion = { entidad: { tipo: 'orden_trabajo', id: 'o1' }, texto: 'Debe S/ 200.00', tono: 'aviso', pagado: false, conAdelanto: true };
    const deFinanzas: Anotacion = { entidad: { tipo: 'orden_trabajo', id: 'o1' }, texto: 'Pagado', tono: 'exito', pagado: true, conAdelanto: true };
    const conAmbas = componerMiDia({ fecha: 'x', borradores: [], puedeEjecutar: todo, fuentes: [fuente('produccion', [ot], [propia]), fuente('registro', [], [deFinanzas])] });
    const t = conAmbas.grupos[0]!.tarjetas[0]!;
    expect(t.notas).toEqual([{ texto: 'Pagado', tono: 'exito' }]);
    expect(t.detalle).toBe('Vence hoy · Pagado: ¿ya se entregó?');
    // Sin dato de Finanzas vale lo que anotó la orden.
    const sola = componerMiDia({ fecha: 'x', borradores: [], puedeEjecutar: todo, fuentes: [fuente('produccion', [ot], [propia])] });
    expect(sola.grupos[0]!.tarjetas[0]!.notas).toEqual([{ texto: 'Debe S/ 200.00', tono: 'aviso' }]);
  });

  it('«sin adelanto» solo si Finanzas confirma una deuda sin ningún pago; sin ese dato no se afirma', () => {
    const adelanto = tarjeta({ clave: 'ad', grupo: 'adelanto', urgencia: 'pronto', acciones: [], entidad: { tipo: 'pedido', id: 'p5', codigo: 'p5' } });
    const sinDatos = componerMiDia({ fecha: 'x', borradores: [], puedeEjecutar: todo, fuentes: [fuente('ordenes', [adelanto])] });
    expect(sinDatos.total).toBe(0);
    const pagado = componerMiDia({ fecha: 'x', borradores: [], puedeEjecutar: todo, fuentes: [fuente('ordenes', [adelanto]), fuente('registro', [], [{ entidad: { tipo: 'pedido', id: 'p5' }, texto: 'Pagado', tono: 'exito', pagado: true, conAdelanto: true }])] });
    expect(pagado.total).toBe(0);
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

  it('los borradores por aprobar van a «por aprobar» como «S/ X por aprobar», los de deuda primero, y llevan a la bandeja', () => {
    const r = componerMiDia({
      fecha: 'x', puedeEjecutar: todo, fuentes: [],
      borradores: [borrador({ id: 'm', herramienta: 'movimiento_registrar', origenRef: null, resumen: 'Registrar egreso', args: {} }), borrador({ id: 'd', propuestoEn: '2026-11-18T02:30:00.000Z' })],
      diaDe: () => '2026-11-17',
    });
    const g = r.grupos.find((x) => x.clave === 'por_aprobar')!;
    expect(g.tarjetas.map((t) => t.clave)).toEqual(['borrador:d', 'borrador:m']);
    expect(g.tarjetas[0]!.titulo).toBe('S/ 300.00 por aprobar');
    expect(g.tarjetas[0]!.entidad).toMatchObject({ tipo: 'borrador', id: 'd' });
    // Propuesto a las 21:30 de Lima: su día es el local, no el de UTC.
    expect(g.tarjetas[0]!.fecha).toBe('2026-11-17');
    expect(g.tarjetas[1]!.entidad.tipo).toBe('borrador');
    expect(r.resumen.porAprobar).toBe(2);
  });

  it('un borrador de la misma entidad que una tarjeta no duplica: se vuelve nota de la tarjeta (salvo prioridad alta)', () => {
    const r = componerMiDia({
      fecha: 'x', puedeEjecutar: todo, fuentes: [fuente('ordenes', [tarjeta({ clave: 'a' })])],
      borradores: [borrador({ id: 'd', origenRef: 'pedido:p1' }), borrador({ id: 'd2', origenRef: 'pedido:p1' }), borrador({ id: 'alta', origenRef: 'pedido:p1', herramienta: 'deuda_anular', args: {}, resumen: 'Anular la deuda', prioridad: 'alta' })],
    });
    expect(r.grupos.find((g) => g.clave === 'por_aprobar')!.tarjetas.map((t) => t.clave)).toEqual(['borrador:alta']);
    // Dos borradores iguales no repiten la nota.
    expect(r.grupos.find((g) => g.clave === 'hoy')!.tarjetas[0]!.notas).toEqual([{ texto: 'S/ 300.00 por aprobar', tono: 'aviso' }]);
    expect(r.resumen.porAprobar).toBe(3);
  });

  it('la nota de un borrador siempre es corta: el monto si mueve dinero, si no «Por aprobar en la Bandeja»', () => {
    const r = componerMiDia({
      fecha: 'x', puedeEjecutar: todo, fuentes: [fuente('ordenes', [tarjeta({ clave: 'a' })])],
      borradores: [
        borrador({ id: 'mov', origenRef: 'pedido:p1', herramienta: 'movimiento_registrar', args: { tipo: 'ingreso', montoCentimos: 36_000 }, resumen: 'Registrar el cobro de S/ 360.00 de la orden OT-2026-0002' }),
        borrador({ id: 'otro', origenRef: 'pedido:p1', herramienta: 'pedido_editar', args: {}, resumen: 'Cambiar la fecha de entrega del pedido PED-PRI-2026-0001 al viernes' }),
      ],
    });
    expect(r.grupos[0]!.tarjetas[0]!.notas.map((n) => n.texto)).toEqual(['S/ 360.00 por aprobar', 'Por aprobar en la Bandeja']);
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

describe('«Clientes por llamar» (recompra)', () => {
  it('las tarjetas de recompra caen en por_llamar, después de por_cobrar y antes de por_aprobar', () => {
    const recompra = tarjeta({ clave: 'recompra:c1', grupo: 'recompra', urgencia: 'info', acciones: [], entidad: { tipo: 'cliente', id: 'c1', codigo: 'Cliente de prueba' } });
    const cobro = tarjeta({ clave: 'cobrar:x', grupo: 'cobro', urgencia: 'atrasado', acciones: [], entidad: { tipo: 'cliente', id: 'x', codigo: 'X' } });
    const r = componerMiDia({
      fecha: '2026-11-18', puedeEjecutar: todo, fuentes: [fuente('ordenes', [recompra]), fuente('registro', [cobro])],
      borradores: [borrador({ id: 'b1', origenRef: null })],
    });
    expect(r.grupos.map((g) => g.clave)).toEqual(['por_cobrar', 'por_llamar', 'por_aprobar']);
    expect(grupoDe(recompra)).toBe('por_llamar');
  });

  it('«por llamar» no se reordena por fecha: queda como lo dejó la herramienta', () => {
    const r = (clave: string, fecha: string) => tarjeta({ clave, grupo: 'recompra', urgencia: 'info', fecha, acciones: [], entidad: { tipo: 'cliente', id: clave, codigo: clave } });
    // Mayor venta primero aunque su fecha sea la más tardía.
    const orden = [r('recompra:grande', '2026-11-30'), r('recompra:mediano', '2026-11-01'), r('recompra:chico', '2026-11-15')];
    const out = componerMiDia({ fecha: '2026-11-18', puedeEjecutar: todo, fuentes: [fuente('ordenes', orden)], borradores: [] });
    expect(out.grupos.find((g) => g.clave === 'por_llamar')!.tarjetas.map((t) => t.clave)).toEqual(['recompra:grande', 'recompra:mediano', 'recompra:chico']);
  });
});
