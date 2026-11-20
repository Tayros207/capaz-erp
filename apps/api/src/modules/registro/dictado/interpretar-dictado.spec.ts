import { describe, expect, test } from 'vitest';
import { interpretarDictado, PISTA_DE_PEDIDO } from './interpretar-dictado.js';

const HOY = '2026-03-10';
const dictar = (texto: string, modo?: 'ingreso' | 'egreso') => interpretarDictado(texto, { hoy: HOY, modo });

describe('interpretarDictado (regla nueva, no portada)', () => {
  test('ingreso con cliente y descripción; el rubro no se infiere, así que no hay categoría de Capaz', () => {
    const d = dictar('Ingreso 500 soles, cliente Juan, flyers');
    expect(d).toMatchObject({ intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000, contactoNombre: 'Juan', categoriaDeRubro: null, categoriaDeCapaz: null });
  });
  test('compra a un proveedor', () => {
    const d = dictar('le compré a Pacheco unas cartulinas y me salieron 350 soles');
    expect(d).toMatchObject({ intencion: 'movimiento', tipo: 'egreso', montoCentimos: 35000, contactoNombre: 'Pacheco', categoriaDeCapaz: 'Compras' });
  });
  test('«ayer» entrega la fecha', () => {
    // Anotado: inferirContacto (portada, sin tocar) devuelve 'Recibo' para esta frase.
    const d = dictar('pagué el recibo de luz 180 soles ayer');
    expect(d).toMatchObject({ intencion: 'movimiento', tipo: 'egreso', montoCentimos: 18000, categoriaDeCapaz: 'Servicios', fecha: '2026-03-09' });
  });
  test('abono', () => {
    const d = dictar('Juan abona 100 soles de su deuda');
    expect(d).toMatchObject({ intencion: 'abono', tipoDeDeuda: 'por_cobrar', tipo: 'ingreso', montoCentimos: 10000, contactoNombre: 'Juan' });
  });
  test('abono con modo egreso es por pagar', () => {
    expect(dictar('Juan abona 100 soles de su deuda', 'egreso')).toMatchObject({ intencion: 'abono', tipoDeDeuda: 'por_pagar', tipo: 'egreso' });
  });
  test('contrato con adelanto', () => {
    const d = dictar('Contrato 240, adelanto 100, cliente Cristina');
    expect(d).toMatchObject({ intencion: 'deuda_con_adelanto', tipoDeDeuda: 'por_cobrar', montoCentimos: 24000, adelantoCentimos: 10000, contactoNombre: 'Cristina' });
  });
  test('adelanto que iguala el total no es deuda_con_adelanto', () => {
    const d = dictar('contrato 100 adelanto 100');
    expect(d.intencion).not.toBe('deuda_con_adelanto');
    expect(d.adelantoCentimos).toBeNull();
  });
  test('deuda por cobrar', () => {
    expect(dictar('Cristina me quedó debiendo 240')).toMatchObject({ intencion: 'deuda', tipoDeDeuda: 'por_cobrar', montoCentimos: 24000, contactoNombre: 'Cristina' });
  });
  test('deuda por pagar (el contacto es lo que devuelve inferirContacto: «Pacheco»)', () => {
    expect(dictar('le debo a Pacheco 500 de papel')).toMatchObject({ intencion: 'deuda', tipoDeDeuda: 'por_pagar', montoCentimos: 50000, contactoNombre: 'Pacheco' });
  });
  test('sin modo y sin sentido del dinero: incompleto', () => {
    const d = dictar('350 de cartulina');
    expect(d).toMatchObject({ intencion: 'incompleto', faltan: ['si entró o salió'], montoCentimos: 35000 });
    expect(d.pista).toBe('Toca «Ingreso» o «Egreso» y vuelve a enviar.');
  });
  test('con modo egreso es movimiento', () => {
    expect(dictar('350 de cartulina', 'egreso')).toMatchObject({ intencion: 'movimiento', tipo: 'egreso', montoCentimos: 35000 });
  });
  test('sin monto: incompleto con pista', () => {
    const d = dictar('hola que tal');
    expect(d).toMatchObject({ intencion: 'incompleto', faltan: ['el monto'], montoCentimos: null });
    expect(d.pista).toContain('No detecté el monto');
  });
  test('proforma: fuera de alcance', () => {
    const d = dictar('Hazle una proforma a Juan por 500 tarjetas a 180 soles');
    expect(d.intencion).toBe('fuera_de_alcance');
    expect(d.pista).toBe('Las proformas y cotizaciones no se dictan aquí: hazlas en Pedidos.');
  });
  test('la fecha solo se entrega en movimiento y abono', () => {
    expect(dictar('Cristina me quedó debiendo 240 ayer').fecha).toBeNull();
    expect(dictar('Juan abona 100 soles de su deuda ayer').fecha).toBe('2026-03-09');
  });
  test('un pedido con líneas', () => {
    const d = dictar('Pedido para Rosa, 500 tarjetas a 0.365');
    expect(d).toMatchObject({ intencion: 'pedido', contactoNombre: 'Rosa', faltan: [], pista: null });
    expect(d.pedido?.lineas).toHaveLength(1);
  });
  test('un pedido sin líneas pide qué se pidió', () => {
    expect(dictar('anota un pedido de tarjetas')).toMatchObject({ intencion: 'pedido', faltan: ['qué se pidió y su precio'], pista: PISTA_DE_PEDIDO });
  });
  test('un egreso con la palabra pedido no es un pedido', () => {
    expect(dictar('Egreso 120, pedido de tintas').intencion).not.toBe('pedido');
  });
  test('en modo egreso nunca es un pedido', () => {
    expect(dictar('pedido para Rosa 500 tarjetas a 0.365', 'egreso').intencion).not.toBe('pedido');
  });
});
