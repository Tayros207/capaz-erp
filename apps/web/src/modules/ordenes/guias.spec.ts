import { describe, expect, it } from 'vitest';
import type { GuiaCompletaDto } from '@capaz/shared';
import { filasDeGuia, guiaParaImprimirDesde, paresDeDestinatario, paresDeTraslado, tituloDeGuia, trasladoInicial } from './guias.ts';

const guia = (extra: Partial<GuiaCompletaDto> = {}): GuiaCompletaDto => ({
  id: 'g1', codigo: 'G001-000007', serie: 'G001', numero: 7, estado: 'emitida', clienteId: 'c1', destinatarioNombre: 'Imprenta Sol', destinatarioDocumento: 'RUC 20123456789',
  fechaEmision: '2026-11-19', fechaTraslado: '2026-11-20', puntoPartida: 'Av. Lima 1', puntoLlegada: 'Jr. Cusco 2', motivo: 'venta', motivoDetalle: null, modalidad: 'privado',
  transportista: null, conductor: 'Luis', licencia: 'Q123', placa: 'ABC-123', bultos: '2 cajas', observaciones: null, pedidos: [{ id: 'p1', codigo: 'PED-1' }], lineas: 2,
  anuladoEn: null, motivoAnulacion: null, creadoPor: 'u1', creadoEn: '2026-11-19T10:00:00.000Z', anuladoPor: null, anuladoPorNombre: null, creadoPorNombre: 'Dueña',
  detalle: [
    { id: 'l2', posicion: 1, pedidoId: null, pedidoCodigo: null, pedidoLineaId: null, productoId: null, descripcion: 'Flete', unidad: 'unidad', cantidadMilesimas: 1000 },
    { id: 'l1', posicion: 0, pedidoId: 'p1', pedidoCodigo: 'PED-1', pedidoLineaId: 'pl1', productoId: null, descripcion: 'Volantes', unidad: 'millar', cantidadMilesimas: 2500 },
  ],
  ...extra,
});

describe('traslado inicial', () => {
  it('parte de la empresa y del cliente, con venta y transporte privado', () => {
    const t = trasladoInicial('2026-11-19', { direccionFiscal: 'Av. Lima 1' }, { documento: 'RUC 20123456789', direccion: 'Jr. Cusco 2' });
    expect(t).toMatchObject({ fechaTraslado: '2026-11-19', puntoPartida: 'Av. Lima 1', puntoLlegada: 'Jr. Cusco 2', destinatarioDocumento: 'RUC 20123456789', motivo: 'venta', modalidad: 'privado' });
  });
  it('sin empresa ni cliente deja los textos vacíos', () => {
    expect(trasladoInicial('2026-11-19', null, null)).toMatchObject({ puntoPartida: '', puntoLlegada: '', destinatarioDocumento: '' });
  });
});

describe('pares de traslado', () => {
  const base = trasladoInicial('2026-11-19', null, null);
  it('con transporte privado no pide empresa transportista', () => {
    expect(paresDeTraslado(base).map((p) => p.etiqueta)).not.toContain('Empresa transportista');
  });
  it('con transporte público sí', () => {
    expect(paresDeTraslado({ ...base, modalidad: 'publico', transportista: 'Olva' })).toContainEqual({ etiqueta: 'Empresa transportista', valor: 'Olva' });
  });
  it('«Otro» lleva su detalle', () => {
    expect(paresDeTraslado({ ...base, motivo: 'otro', motivoDetalle: 'Muestra' })).toContainEqual({ etiqueta: 'Motivo del traslado', valor: 'Otro: Muestra' });
    expect(paresDeTraslado({ ...base, motivo: 'entrega_de_trabajo' })).toContainEqual({ etiqueta: 'Motivo del traslado', valor: 'Entrega de trabajo terminado' });
  });
  it('conductor con su licencia', () => {
    expect(paresDeTraslado({ ...base, conductor: 'Luis', licencia: 'Q123' })).toContainEqual({ etiqueta: 'Conductor', valor: 'Luis · Licencia Q123' });
  });
});

describe('guía guardada para imprimir', () => {
  it('ordena las líneas por posición y copia lo guardado', () => {
    const g = guiaParaImprimirDesde(guia());
    expect(g.lineas.map((l) => l.descripcion)).toEqual(['Volantes', 'Flete']);
    expect(g.pedidos).toEqual(['PED-1']);
    expect(g.traslado).toMatchObject({ puntoLlegada: 'Jr. Cusco 2', observaciones: '', motivoDetalle: '', fechaTraslado: '2026-11-20' });
    expect(g.anulacion).toBeNull();
  });
  it('trae la anulación si está anulada', () => {
    const g = guiaParaImprimirDesde(guia({ estado: 'anulada', anuladoEn: '2026-11-19T12:00:00.000Z', motivoAnulacion: 'Error' }));
    expect(g.anulacion).toEqual({ en: '2026-11-19T12:00:00.000Z', motivo: 'Error' });
  });
  it('filas con pedido y cantidad; la libre no tiene pedido', () => {
    expect(filasDeGuia(guiaParaImprimirDesde(guia()).lineas)).toEqual([
      { n: 1, pedido: 'PED-1', descripcion: 'Volantes', cantidad: '2.5 millar' },
      { n: 2, pedido: '—', descripcion: 'Flete', cantidad: '1 unidad' },
    ]);
  });
  it('el destinatario lleva cliente, documento, pedidos y fecha', () => {
    expect(paresDeDestinatario(guiaParaImprimirDesde(guia())).map((p) => p.valor)).toEqual(['Imprenta Sol', 'RUC 20123456789', 'PED-1', '19/11/2026']);
  });
});

describe('título', () => {
  it('con código, anulada y por emitir', () => {
    expect(tituloDeGuia({ codigo: 'G001-000007', estado: 'emitida' })).toBe('Guía de remisión G001-000007');
    expect(tituloDeGuia({ codigo: 'G001-000007', estado: 'anulada' })).toBe('Guía de remisión G001-000007 — ANULADA');
    expect(tituloDeGuia({ codigo: null, estado: 'emitida' })).toBe('Guía de remisión (por emitir)');
  });
});
