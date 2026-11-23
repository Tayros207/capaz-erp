import { describe, expect, it } from 'vitest';
import type { LineaDePedidoDto } from '@capaz/shared';
import { documentosDisponibles, enlaceDeWhatsApp, estadoDePago, textoDeVencimiento, mensajeDeWhatsAppDeVersion, pedidoDeVersion, textoDeReemplazada, textoDeVersion, esTipoDeDocumento, filasDelDocumento, formatoDelDocumento, mensajeDeWhatsApp, sePuedeImprimir, telefonoParaWhatsApp, textoDeVigencia, totalesConAdelanto, totalesDelDocumento } from './documentos.ts';

const l = (extra: Partial<LineaDePedidoDto>): LineaDePedidoDto => ({ id: 'a', posicion: 1, productoId: null, descripcion: 'Polo', unidad: 'unidad', cantidadMilesimas: 50_000, precioUnitarioMilesimas: 15_000, afectoIgv: true, importeCentimos: 75_000, material: null, medida: null, colores: null, acabado: null, ...extra });

describe('estados por documento', () => {
  it('proforma: borrador y confirmado', () => {
    expect(sePuedeImprimir('proforma', 'borrador')).toBe(true);
    expect(sePuedeImprimir('proforma', 'confirmado')).toBe(true);
    expect(sePuedeImprimir('proforma', 'cancelado')).toBe(false);
  });
  it('nota y orden: confirmado o posterior', () => {
    for (const t of ['nota', 'orden-de-trabajo'] as const) {
      expect(sePuedeImprimir(t, 'borrador')).toBe(false);
      expect(sePuedeImprimir(t, 'en_proceso')).toBe(true);
      expect(sePuedeImprimir(t, 'cancelado')).toBe(false);
    }
    expect(documentosDisponibles('borrador')).toEqual(['proforma']);
    expect(esTipoDeDocumento('nota')).toBe(true);
    expect(esTipoDeDocumento('otro')).toBe(false);
  });
});

describe('vigencia', () => {
  it('suma 7 días, incluso cruzando de mes', () => {
    expect(textoDeVigencia('2026-03-01')).toBe('Válida por 7 días desde el 01/03/2026 (hasta el 08/03/2026)');
    expect(textoDeVigencia('2026-11-28')).toContain('hasta el 05/12/2026');
  });
});

describe('filas', () => {
  it('con precios', () => {
    expect(filasDelDocumento([l({})], true)).toEqual([{ n: 1, descripcion: 'Polo', cantidad: '50 unidad', precio: 'S/ 15.00', importe: 'S/ 750.00' }]);
  });
  it('sin precios no filtra ningún importe y ordena por posición', () => {
    const filas = filasDelDocumento([l({ posicion: 2, descripcion: 'B' }), l({ posicion: 1, descripcion: 'A' })], false);
    expect(filas.map((f) => f.descripcion)).toEqual(['A', 'B']);
    expect(JSON.stringify(filas)).not.toMatch(/S\/|precio|importe/);
  });
  it('totales con IGV', () => {
    const sinIgv = totalesDelDocumento({ subtotalCentimos: 10_000, igvCentimos: 0, totalCentimos: 10_000, igvPorcentaje: 0 });
    expect(sinIgv.map((f) => f.etiqueta)).toEqual(['Total']);
    const t = totalesDelDocumento({ subtotalCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800, igvPorcentaje: 18 });
    expect(t.map((f) => f.valor)).toEqual(['S/ 100.00', 'S/ 18.00', 'S/ 118.00']);
    expect(t[1]?.etiqueta).toBe('IGV (18%)');
  });
});

describe('WhatsApp', () => {
  it('limpia símbolos y agrega 51 a celulares de 9 dígitos', () => {
    expect(telefonoParaWhatsApp('999 000-111')).toBe('51999000111');
    expect(telefonoParaWhatsApp('+51 (999) 000 111')).toBe('51999000111');
    expect(telefonoParaWhatsApp('0051999000111')).toBe('51999000111');
  });
  it('rechaza vacíos y cortos', () => {
    expect(telefonoParaWhatsApp(null)).toBeNull();
    expect(telefonoParaWhatsApp('12-34')).toBeNull();
    expect(enlaceDeWhatsApp('', 'hola')).toBeNull();
  });
  it('arma el enlace con código y total', () => {
    const msg = mensajeDeWhatsApp({ codigo: 'PED-1', clienteNombre: 'Ana', totalCentimos: 11_800, estado: 'confirmado' });
    const url = enlaceDeWhatsApp('999000111', msg)!;
    expect(url.startsWith('https://wa.me/51999000111?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('PED-1');
    expect(decodeURIComponent(url)).toContain('S/ 118.00');
  });
});

describe('adelanto en el documento', () => {
  const base = [{ etiqueta: 'Total', valor: 'S/ 80.00', destacado: true }];
  it('sin adelanto cobrado el documento no cambia', () => {
    expect(totalesConAdelanto(base, null)).toEqual(base);
    expect(totalesConAdelanto(base, { abonadoCentimos: 0, saldoCentimos: 8_000 })).toEqual(base);
  });
  it('con adelanto agrega lo recibido y el saldo por pagar', () => {
    const t = totalesConAdelanto(base, { abonadoCentimos: 3_000, saldoCentimos: 5_000 }, 8_000);
    expect(t.slice(1).map((f) => [f.etiqueta, f.valor])).toEqual([['Adelanto recibido', 'S/ 30.00'], ['Saldo por pagar', 'S/ 50.00']]);
  });
  it('si la versión corregida quedó por debajo de lo pagado, dice cuánto queda a favor del cliente', () => {
    const t = totalesConAdelanto(base, { abonadoCentimos: 11_800, saldoCentimos: 0 }, 8_000);
    expect(t.slice(1).map((f) => [f.etiqueta, f.valor])).toEqual([['Adelanto recibido', 'S/ 118.00'], ['Saldo por pagar', 'S/ 0.00'], ['A favor del cliente (no se devuelve)', 'S/ 38.00']]);
  });
});

describe('estado de pago del documento', () => {
  const d = (estado: 'pendiente' | 'parcial' | 'pagada' | 'anulada', extra: { vencida?: boolean; venceEn?: string | null } = {}) => ({ estado, vencida: false, venceEn: null, ...extra });
  it('lo saca de la deuda real: Pagado, Con saldo o Sin pago', () => {
    expect(estadoDePago(d('pagada'))).toBe('Pagado');
    expect(estadoDePago(d('parcial'))).toBe('Con saldo');
    expect(estadoDePago(d('pendiente'))).toBe('Sin pago');
  });
  it('«Vencida» gana cuando pasó el vencimiento y aún se debe algo, tenga o no abonos', () => {
    expect(estadoDePago(d('pendiente', { vencida: true, venceEn: '2026-11-01' }))).toBe('Vencida');
    expect(estadoDePago(d('parcial', { vencida: true, venceEn: '2026-11-01' }))).toBe('Vencida');
  });
  it('una deuda pagada nunca figura vencida (un pedido corregido que quedó a favor sigue «Pagado»)', () => {
    expect(estadoDePago(d('pagada', { vencida: true, venceEn: '2026-11-01' }))).toBe('Pagado');
  });
  it('sin deuda, o con la deuda anulada, no hay estado: no se inventa ninguno', () => {
    expect(estadoDePago(null)).toBeNull();
    expect(estadoDePago(undefined)).toBeNull();
    expect(estadoDePago(d('anulada'))).toBeNull();
  });
  it('el vencimiento se dice solo mientras quede algo por cobrar', () => {
    expect(textoDeVencimiento(d('parcial', { venceEn: '2026-12-15' }))).toBe('vence el 15/12/2026');
    expect(textoDeVencimiento(d('pendiente', { vencida: true, venceEn: '2026-11-01' }))).toBe('venció el 01/11/2026');
    expect(textoDeVencimiento(d('pagada', { venceEn: '2026-12-15' }))).toBeNull();
    expect(textoDeVencimiento(d('pendiente'))).toBeNull();
    expect(textoDeVencimiento(null)).toBeNull();
  });
});

describe('precio unitario impreso', () => {
  it('conserva las milésimas: 0.085 no sale 0.09', () => {
    const [f] = filasDelDocumento([l({ cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 85, importeCentimos: 8_500 })], true);
    expect(f?.precio).toBe('S/ 0.085');
    expect(f?.importe).toBe('S/ 85.00');
  });
  it('un unitario redondo sigue con dos decimales', () => {
    expect(filasDelDocumento([l({ precioUnitarioMilesimas: 12_500 })], true)[0]?.precio).toBe('S/ 12.50');
  });
});

describe('versiones', () => {
  const foto = { estado: 'confirmado', clienteId: 'c', clienteNombre: 'Ana', fecha: '2026-11-01', entregaEl: null, notas: null, igvPorcentaje: 18, subtotalCentimos: 100, igvCentimos: 18, totalCentimos: 118, lineas: [l({ importeCentimos: 118 })] } as const;
  const pedido = { id: 'p', codigo: 'PED-1', version: 3, historial: [], versiones: [{ version: 2, motivoCodigo: 'igv', motivoTexto: null, creadoPor: 'u', creadoPorNombre: null, creadoEn: '2026-11-15T15:00:00.000Z', foto }, { version: 1, motivoCodigo: 'igv', motivoTexto: null, creadoPor: 'u', creadoPorNombre: null, creadoEn: '2026-11-10T15:00:00.000Z', foto: { ...foto, totalCentimos: 999 } }] } as unknown as Parameters<typeof pedidoDeVersion>[0];
  it('la v1 se arma desde su foto', () => {
    expect(pedidoDeVersion(pedido, 1)?.totalCentimos).toBe(999);
    expect(pedidoDeVersion(pedido, 1)?.version).toBe(1);
    expect(pedidoDeVersion(pedido, 9)).toBeNull();
    expect(textoDeReemplazada(2)).toBe('REEMPLAZADA por la versión 2');
  });
  it('«reemplaza a la del …» usa la fecha del pedido para la v2 y la de la versión anterior después', () => {
    expect(textoDeVersion(1, '2026-11-01', [])).toBeNull();
    expect(textoDeVersion(2, '2026-11-01', pedido.versiones)).toBe('Versión 2 · reemplaza a la del 01/11/2026');
    expect(textoDeVersion(3, '2026-11-01', pedido.versiones)).toBe('Versión 3 · reemplaza a la del 10/11/2026');
  });
  it('el mensaje de WhatsApp de la versión lleva total, lo dejado y lo que falta o queda a favor', () => {
    const p = { codigo: 'PED-1', clienteNombre: 'Ana', totalCentimos: 10_000, version: 2 };
    expect(mensajeDeWhatsAppDeVersion(p, { abonadoCentimos: 6_000, saldoCentimos: 4_000, aFavorCentimos: 0 })).toBe('Hola Ana, versión 2 del pedido PED-1, reemplaza a la anterior: total S/ 100.00, ya dejaste S/ 60.00, falta S/ 40.00. Te adjuntamos el documento en PDF.');
    expect(mensajeDeWhatsAppDeVersion(p, { abonadoCentimos: 12_000, saldoCentimos: 0, aFavorCentimos: 2_000 })).toContain('a tu favor S/ 20.00');
    expect(mensajeDeWhatsApp({ codigo: 'PED-1', clienteNombre: 'Ana', totalCentimos: 10_000, estado: 'confirmado', version: 2 })).toContain('versión 2 del pedido PED-1');
  });
});

describe('hoja del documento', () => {
  const p = (n: number, notas: string | null = null, descripcion = 'Polo') => ({ detalle: Array.from({ length: n }, () => l({ descripcion })), notas });
  it('elige la hoja más chica que cabe', () => {
    expect(formatoDelDocumento('proforma', p(1))).toBe('a6');
    expect(formatoDelDocumento('nota', p(2))).toBe('a5');
    expect(formatoDelDocumento('nota', p(6))).toBe('a5');
    expect(formatoDelDocumento('proforma', p(7))).toBe('a4');
    expect(formatoDelDocumento('orden-de-trabajo', p(2))).toBe('a6');
    expect(formatoDelDocumento('orden-de-trabajo', p(8))).toBe('a5');
    expect(formatoDelDocumento('orden-de-trabajo', p(9))).toBe('a4');
  });
  it('cuenta las notas y el texto largo', () => {
    expect(formatoDelDocumento('proforma', p(1, 'Entregar en tienda'))).toBe('a5');
    expect(formatoDelDocumento('orden-de-trabajo', p(1, null, 'x'.repeat(161)))).toBe('a5');
  });
});
