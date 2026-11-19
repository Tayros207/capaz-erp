import { describe, expect, it } from 'vitest';
import { contratosDeOrdenes } from './ordenes.js';
import { contratosDeGuias, emitirGuiaSchema, eventosDeGuias, prepararGuiaSchema } from './ordenes-guias.js';

const UUID = '0192f0c4-7b1e-7000-8000-000000000001';
const base = {
  clienteId: UUID,
  fechaTraslado: '2026-03-10',
  puntoPartida: 'Av. Lima 100',
  puntoLlegada: 'Jr. Cusco 200',
  motivo: 'venta',
  modalidad: 'privado',
  lineas: [{ tipo: 'pedido', pedidoLineaId: UUID, cantidadMilesimas: 2000 }],
};

describe('emitirGuiaSchema', () => {
  it('acepta una entrada válida', () => {
    expect(emitirGuiaSchema.safeParse(base).success).toBe(true);
    expect(emitirGuiaSchema.safeParse({ ...base, lineas: [{ tipo: 'libre', descripcion: 'Caja', cantidadMilesimas: 1000 }] }).success).toBe(true);
  });

  it('rechaza «otro» sin detalle y público sin transportista', () => {
    expect(emitirGuiaSchema.safeParse({ ...base, motivo: 'otro' }).success).toBe(false);
    expect(emitirGuiaSchema.safeParse({ ...base, motivo: 'otro', motivoDetalle: 'Muestra' }).success).toBe(true);
    expect(emitirGuiaSchema.safeParse({ ...base, modalidad: 'publico' }).success).toBe(false);
    expect(emitirGuiaSchema.safeParse({ ...base, modalidad: 'publico', transportista: 'Cruz' }).success).toBe(true);
  });

  it('rechaza líneas mal formadas', () => {
    const con = (lineas: unknown[]) => emitirGuiaSchema.safeParse({ ...base, lineas }).success;
    expect(con([{ tipo: 'pedido', pedidoLineaId: UUID, cantidadMilesimas: 1000, de_mas: 1 }])).toBe(false);
    expect(con([{ tipo: 'libre', descripcion: '  ', cantidadMilesimas: 1000 }])).toBe(false);
    expect(con([{ tipo: 'pedido', pedidoLineaId: UUID, cantidadMilesimas: 0 }])).toBe(false);
    expect(con([{ tipo: 'pedido', pedidoLineaId: UUID, cantidadMilesimas: 1.5 }])).toBe(false);
    expect(con(Array.from({ length: 201 }, () => ({ tipo: 'libre', descripcion: 'x', cantidadMilesimas: 1 })))).toBe(false);
    expect(con(Array.from({ length: 200 }, () => ({ tipo: 'libre', descripcion: 'x', cantidadMilesimas: 1 })))).toBe(true);
    expect(con([])).toBe(false);
  });
});

describe('prepararGuiaSchema', () => {
  it('exige pedidos o cliente', () => {
    expect(prepararGuiaSchema.safeParse({}).success).toBe(false);
    expect(prepararGuiaSchema.safeParse({ pedidoIds: [UUID] }).success).toBe(true);
    expect(prepararGuiaSchema.safeParse({ clienteId: UUID }).success).toBe(true);
  });
});

describe('contratos y eventos', () => {
  it('los eventos son estrictos', () => {
    expect(eventosDeGuias['guia.anulada'].safeParse({ id: 'a', codigo: 'G001-000001', clienteId: 'c', pedidoIds: [], extra: 1 }).success).toBe(false);
    expect(eventosDeGuias['guia.emitida'].safeParse({ id: 'a', codigo: 'G001-000001', clienteId: 'c', pedidoIds: ['p'], lineas: 2 }).success).toBe(true);
  });

  it('ningún nombre de guías está en los contratos de pedidos', () => {
    for (const nombre of Object.keys(contratosDeGuias)) expect(nombre in contratosDeOrdenes).toBe(false);
  });
});
