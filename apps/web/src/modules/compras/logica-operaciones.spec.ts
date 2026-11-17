import { describe, expect, it } from 'vitest';
import { centimosSchema } from '@capaz/shared';
import { accionesDeSolicitud, argumentosDeFactura, argumentosDeSolicitud, textoDeDiferencia, validarFactura, validarSolicitud, type FormularioDeFactura, type FormularioDeSolicitud } from './logica-operaciones.ts';

const soles = (c: number) => `S/ ${(c / 100).toFixed(2)}`;
const solicitud = (c: Partial<FormularioDeSolicitud> = {}): FormularioDeSolicitud => ({ area: '', necesariaEl: '', motivo: '', lineas: [{ clave: 1, producto: null, descripcion: 'Papel', cantidad: 1000 }], ...c });
const factura = (c: Partial<FormularioDeFactura> = {}): FormularioDeFactura => ({
  proveedor: { id: 'p', nombre: 'Papelera' }, ordenId: '', serie: 'F001', numero: '1', fecha: '2026-03-01', venceEl: '', moneda: 'PEN', subtotal: centimosSchema.parse(10_000), igv: centimosSchema.parse(1_800), notas: '', ...c,
});

describe('accionesDeSolicitud', () => {
  it('cada estado habilita solo lo que le corresponde', () => {
    expect(accionesDeSolicitud('borrador')).toEqual({ enviar: true, resolver: false, convertir: false, anular: true });
    expect(accionesDeSolicitud('pendiente')).toEqual({ enviar: false, resolver: true, convertir: false, anular: true });
    expect(accionesDeSolicitud('aprobada')).toEqual({ enviar: false, resolver: false, convertir: true, anular: true });
    for (const e of ['rechazada', 'convertida', 'anulada'] as const) expect(Object.values(accionesDeSolicitud(e)).some(Boolean)).toBe(false);
  });
});

describe('validarSolicitud', () => {
  it('una solicitud con una línea completa es válida', () => expect(validarSolicitud(solicitud(), '2026-03-01')).toEqual({}));
  it('pide al menos una línea completa', () => {
    expect(validarSolicitud(solicitud({ lineas: [{ clave: 1, producto: null, descripcion: '', cantidad: null }] }), '2026-03-01').lineas).toMatch(/al menos una línea/);
    expect(validarSolicitud(solicitud({ lineas: [{ clave: 1, producto: null, descripcion: 'X', cantidad: null }] }), '2026-03-01').lineas).toMatch(/cantidad/);
    expect(validarSolicitud(solicitud({ lineas: [{ clave: 1, producto: null, descripcion: '', cantidad: 5 }] }), '2026-03-01').lineas).toMatch(/producto o una descripción/);
  });
  it('un producto basta sin descripción y la fecha no puede ser pasada', () => {
    expect(validarSolicitud(solicitud({ lineas: [{ clave: 1, producto: { id: 'x', nombre: 'Papel' }, descripcion: '', cantidad: 5 }] }), '2026-03-01')).toEqual({});
    expect(validarSolicitud(solicitud({ necesariaEl: '2026-02-01' }), '2026-03-01').necesariaEl).toBeDefined();
  });
  it('arma los argumentos sin vacíos', () => {
    expect(argumentosDeSolicitud(solicitud({ area: ' Producción ', lineas: [{ clave: 1, producto: { id: 'x', nombre: 'P' }, descripcion: '', cantidad: 2000 }, { clave: 2, producto: null, descripcion: '', cantidad: null }] }))).toEqual({
      area: 'Producción',
      lineas: [{ productoId: 'x', cantidadMilesimas: 2000 }],
    });
  });
});

describe('validarFactura', () => {
  it('una factura completa no tiene errores', () => expect(validarFactura(factura())).toEqual({}));
  it('pide proveedor, serie, número y base; el vencimiento no puede ser anterior', () => {
    expect(Object.keys(validarFactura(factura({ proveedor: null, serie: ' ', numero: '', subtotal: null }))).sort()).toEqual(['numero', 'proveedor', 'serie', 'subtotal']);
    expect(validarFactura(factura({ venceEl: '2026-02-01' })).venceEl).toBeDefined();
  });
  it('arma los argumentos: el IGV vacío es cero y la orden solo si se eligió', () => {
    expect(argumentosDeFactura(factura({ igv: null }))).toEqual({ proveedorId: 'p', serie: 'F001', numero: '1', fecha: '2026-03-01', moneda: 'PEN', subtotalCentimos: 10_000, igvCentimos: 0 });
    expect(argumentosDeFactura(factura({ ordenId: 'o', notas: ' ok ' }))).toMatchObject({ ordenId: 'o', notas: 'ok' });
  });
});

describe('textoDeDiferencia', () => {
  it('dice de más o de menos y calla si no hay diferencia', () => {
    expect(textoDeDiferencia(1_200, soles)).toBe('S/ 12.00 de más');
    expect(textoDeDiferencia(-500, soles)).toBe('S/ 5.00 de menos');
    expect(textoDeDiferencia(0, soles)).toBeNull();
    expect(textoDeDiferencia(null, soles)).toBeNull();
  });
});
