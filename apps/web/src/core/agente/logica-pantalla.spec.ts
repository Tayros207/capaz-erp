import { describe, expect, it } from 'vitest';
import { pantallaDesdeRuta } from './logica-pantalla.ts';

const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';

describe('pantallaDesdeRuta', () => {
  it.each([
    [`/clientes/${ID}`, null, 'cliente'],
    [`/productos/${ID}`, null, 'producto'],
    [`/bandeja/${ID}`, null, 'borrador'],
    [`/m/ordenes/guias/${ID}`, 'ordenes', 'guia'],
    [`/m/ordenes/${ID}`, 'ordenes', 'pedido'],
    [`/m/ordenes/${ID}/proforma`, 'ordenes', 'pedido'],
    [`/m/produccion/${ID}`, 'produccion', 'orden_de_produccion'],
    [`/m/cotizador/cotizaciones/${ID}`, 'cotizador', 'cotizacion'],
    [`/m/cotizador/cuadro/${ID}`, 'cotizador', 'cotizacion'],
    [`/m/crm/oportunidades/${ID}`, 'crm', 'oportunidad'],
    [`/m/registro/movimientos/${ID}`, 'registro', 'movimiento'],
    [`/m/registro/deudas/${ID}`, 'registro', 'deuda'],
  ] as const)('%s → módulo %s, entidad %s', (ruta, modulo, tipo) => {
    expect(pantallaDesdeRuta(ruta)).toEqual({ ruta, modulo, entidad: { tipo, id: ID } });
  });

  it('una subruta fija de un módulo no da entidad', () => {
    expect(pantallaDesdeRuta('/m/ordenes/tablero')).toEqual({ ruta: '/m/ordenes/tablero', modulo: 'ordenes', entidad: null });
    expect(pantallaDesdeRuta('/m/ordenes/nuevo').entidad).toBeNull();
  });

  it('cualquier otra ruta de módulo da el módulo y ninguna entidad', () => {
    expect(pantallaDesdeRuta('/m/insumos/stock')).toEqual({ ruta: '/m/insumos/stock', modulo: 'insumos', entidad: null });
  });

  it('una pantalla del núcleo sin entidad no tiene módulo', () => {
    expect(pantallaDesdeRuta('/inicio')).toEqual({ ruta: '/inicio', modulo: null, entidad: null });
    expect(pantallaDesdeRuta('/clientes')).toEqual({ ruta: '/clientes', modulo: null, entidad: null });
  });

  it('un segmento que no es UUID no cuenta como id', () => {
    expect(pantallaDesdeRuta('/clientes/nuevo').entidad).toBeNull();
    expect(pantallaDesdeRuta('/m/produccion/123').entidad).toBeNull();
    expect(pantallaDesdeRuta(`/m/registro/deudas/${ID}x`).entidad).toBeNull();
  });

  it('la misma forma de entidad en el módulo equivocado no se reconoce', () => {
    expect(pantallaDesdeRuta(`/m/crm/movimientos/${ID}`).entidad).toBeNull();
    expect(pantallaDesdeRuta(`/m/produccion/guias/${ID}`).entidad).toBeNull();
  });

  it('una ruta con consulta, fragmento o espacios se descarta entera', () => {
    const vacia = { ruta: '/', modulo: null, entidad: null };
    expect(pantallaDesdeRuta(`/clientes/${ID}?x=1`)).toEqual(vacia);
    expect(pantallaDesdeRuta('/m/ordenes/mi pedido')).toEqual(vacia);
    expect(pantallaDesdeRuta('/inicio#arriba')).toEqual(vacia);
  });

  it('una ruta de más de 200 caracteres se recorta', () => {
    const larga = `/m/ordenes/${'a'.repeat(300)}`;
    expect(pantallaDesdeRuta(larga).ruta).toHaveLength(200);
  });

  it('un código de módulo con forma rara no se envía como módulo', () => {
    expect(pantallaDesdeRuta('/m/Ordenes/tablero').modulo).toBeNull();
    expect(pantallaDesdeRuta('/m').modulo).toBeNull();
  });
});
