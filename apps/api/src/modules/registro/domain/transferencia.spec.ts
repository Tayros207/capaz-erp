import { describe, expect, it } from 'vitest';
import { saldoDeCuenta } from './movimiento.js';
import {
  descripcionDePata, esNombreReservado, referenciaDeTransferencia, transferenciaDeReferencia, transferenciaPermitida, MENSAJE_DE_NOMBRE_RESERVADO,
} from './transferencia.js';

const caja = { id: 'caja', nombre: 'Caja', archivadoEn: null };
const banco = { id: 'banco', nombre: 'Banco', archivadoEn: null };

describe('transferencia entre cuentas · reglas', () => {
  it('origen y destino deben ser distintos', () => {
    expect(transferenciaPermitida(caja, caja)).toEqual({ ok: false, codigo: 'argumentos_invalidos', mensaje: 'El origen y el destino deben ser cuentas distintas.' });
    expect(transferenciaPermitida(caja, banco)).toEqual({ ok: true });
  });
  it('una cuenta archivada, de origen o de destino, es conflicto', () => {
    const vieja = { id: 'v', nombre: 'Vieja', archivadoEn: new Date() };
    expect(transferenciaPermitida(vieja, banco)).toEqual({ ok: false, codigo: 'conflicto', mensaje: 'La cuenta «Vieja» está archivada.' });
    expect(transferenciaPermitida(caja, vieja)).toMatchObject({ ok: false, codigo: 'conflicto' });
  });
  it('la referencia de las patas va y vuelve', () => {
    const ref = referenciaDeTransferencia('abc');
    expect(ref).toBe('transferencia:abc');
    expect(transferenciaDeReferencia(ref)).toBe('abc');
    expect(transferenciaDeReferencia(null)).toBeNull();
    expect(transferenciaDeReferencia('pedido:abc')).toBeNull();
    expect(transferenciaDeReferencia('transferencia:')).toBeNull();
  });
  it('el nombre «Transferencia» está reservado, con o sin tildes y mayúsculas', () => {
    expect(esNombreReservado(' TRANSFERENCIA ')).toBe(true);
    expect(esNombreReservado('Transferencias')).toBe(false);
    expect(MENSAJE_DE_NOMBRE_RESERVADO).toContain('Transferencia');
  });
  it('describe cada pata y agrega la nota', () => {
    expect(descripcionDePata('salida', 'Banco', null)).toBe('Transferencia a Banco');
    expect(descripcionDePata('entrada', 'Caja', ' depósito del día ')).toBe('Transferencia desde Caja: depósito del día');
  });
});

describe('transferencia · casos de referencia de dinero', () => {
  // Una transferencia no cambia el patrimonio: lo que sale de una cuenta entra en la otra, céntimo a céntimo.
  it('Caja 500.00 → Banco 0.00, transferir 200.01: Caja 299.99, Banco 200.01, suma intacta', () => {
    const caja = saldoDeCuenta(50_000, 0, 20_001);
    const banco = saldoDeCuenta(0, 20_001, 0);
    expect([caja, banco]).toEqual([29_999, 20_001]);
    expect(caja + banco).toBe(50_000);
  });
  it('tres transferencias de 0.01, 0.02 y 99.97 dejan 100.00 exactos en el destino', () => {
    expect(saldoDeCuenta(0, 1 + 2 + 9_997, 0)).toBe(10_000);
    expect(saldoDeCuenta(10_000, 0, 1 + 2 + 9_997)).toBe(0);
  });
  it('transferir más de lo que hay deja la cuenta de origen en negativo (se permite, con aviso)', () => {
    expect(saldoDeCuenta(1_000, 0, 2_500)).toBe(-1_500);
  });
});
