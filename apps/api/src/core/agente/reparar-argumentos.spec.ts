import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { esquemaLimpio } from './esquema-limpio.js';
import { argumentosDeLaPuertaGeneral, repararSegunEsquema } from './reparar-argumentos.js';

const pedido = esquemaLimpio(
  z.strictObject({
    clienteId: z.string(),
    conIgv: z.boolean().optional(),
    entregaEl: z.iso.date().nullish(),
    lineas: z.array(z.strictObject({ descripcion: z.string(), cantidadMilesimas: z.number().int(), precioUnitarioMilesimas: z.number().int().optional() })).default([]),
  }),
);
const reparar = (v: unknown) => repararSegunEsquema(v, pedido);

describe('repararSegunEsquema', () => {
  it('el caso real: sí/no y líneas escritos como texto', () => {
    expect(reparar({ clienteId: 'c', conIgv: 'true', lineas: '[{"descripcion":"Troquel","cantidadMilesimas":1000,"precioUnitarioMilesimas":180000}]' })).toEqual({
      clienteId: 'c', conIgv: true, lineas: [{ descripcion: 'Troquel', cantidadMilesimas: 1000, precioUnitarioMilesimas: 180000 }],
    });
  });

  it('enteros entre comillas dentro de una lista, y todo el objeto como texto', () => {
    expect(reparar('{"clienteId":"c","lineas":[{"descripcion":"x","cantidadMilesimas":"500000"}]}')).toEqual({ clienteId: 'c', lineas: [{ descripcion: 'x', cantidadMilesimas: 500000 }] });
  });

  it('donde va texto, el texto se respeta aunque parezca otra cosa', () => {
    expect(reparar({ clienteId: '123', lineas: [{ descripcion: 'true', cantidadMilesimas: 1 }] })).toEqual({ clienteId: '123', lineas: [{ descripcion: 'true', cantidadMilesimas: 1 }] });
  });

  it('no adivina importes: con decimales, comas o símbolo se queda como texto y lo rechaza el esquema', () => {
    for (const precio of ['45.50', '1,000', 'S/ 80', '']) {
      expect(reparar({ lineas: [{ precioUnitarioMilesimas: precio }] })).toEqual({ lineas: [{ precioUnitarioMilesimas: precio }] });
    }
  });

  it('«null» como texto solo vale donde el campo admite vacío y no admite ese texto', () => {
    expect(repararSegunEsquema({ n: 'null' }, esquemaLimpio(z.strictObject({ n: z.number().int().nullable() })))).toEqual({ n: null });
  });

  it('no añade ni quita campos, y deja lo que no entiende', () => {
    expect(reparar({ sobra: 'true', lineas: '[roto' })).toEqual({ sobra: 'true', lineas: '[roto' });
    expect(repararSegunEsquema({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});

describe('argumentosDeLaPuertaGeneral', () => {
  it('junta lo que quedó al lado de args; lo de dentro manda', () => {
    expect(argumentosDeLaPuertaGeneral({ nombre: 'pedido_editar', args: { id: 'p', conIgv: false }, lineas: [1], conIgv: true })).toEqual({ id: 'p', conIgv: false, lineas: [1] });
  });
  it('lee args escrito como texto; sin args, un objeto vacío', () => {
    expect(argumentosDeLaPuertaGeneral({ nombre: 'x', args: '{"id":"p"}' })).toEqual({ id: 'p' });
    expect(argumentosDeLaPuertaGeneral({ nombre: 'x' })).toEqual({});
  });
  it('un args que no es objeto ni JSON se deja para que el esquema lo rechace', () => {
    expect(argumentosDeLaPuertaGeneral({ nombre: 'x', args: 'hola', extra: 1 })).toBe('hola');
  });
});
