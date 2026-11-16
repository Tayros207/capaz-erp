import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';

// Estado de cuenta de la empresa (0022): la pausa o baja manda sobre el estado de cada módulo.

let app: pg.Pool;
let sistema: pg.Pool;
const M = `cta_${Date.now()}`;
const A = empresaDePrueba();
const B = empresaDePrueba();

beforeAll(async () => {
  app = abrirPool('app');
  sistema = abrirPool('sistema');
  await sistema.query(`insert into core.modulos (codigo, nombre) values ($1, 'Módulo de cuenta')`, [M]);
  for (const e of [A, B]) await sistema.query('select core.activar_modulo($1, $2, null, $3)', [e, M, 'op']);
});
afterAll(async () => {
  await Promise.all([app.end(), sistema.end()]);
});

const escribe = (e: string) => comoEmpresa(app, e, (c) => c.query('select core.exigir_modulo($1)', [M]));
const modulos = (e: string) => sistema.query(`select modulo, estado, prueba_hasta, baja_en, motivo from core.empresa_modulos where tenant_id = $1 order by modulo`, [e]);
const eventos = (e: string) =>
  sistema.query(`select evento, estado_anterior, estado_nuevo, motivo, actor from core.empresa_cuenta_eventos where tenant_id = $1 order by creado_en, id`, [e]);

describe('estado de cuenta', () => {
  it('una empresa sin fila de cuenta cuenta como activa y escribe', async () => {
    await escribe(A);
  });

  it('pausar → no escribe (código de módulo no activo) pero lee; reactivar → escribe sin tocar el módulo', async () => {
    const antes = (await modulos(A)).rows;
    await sistema.query('select core.pausar_cuenta($1, $2, $3)', [A, 'mora de pago', 'op-1']);
    await expect(escribe(A)).rejects.toThrow(/no está activo/);
    const lectura = await comoEmpresa(app, A, (c) => c.query('select estado from core.empresa_cuenta'));
    expect(lectura.rows).toEqual([{ estado: 'pausada' }]);
    expect((await comoEmpresa(app, A, (c) => c.query('select modulo from core.empresa_modulos'))).rows).toHaveLength(1);
    await sistema.query('select core.reactivar_cuenta($1, null, $2)', [A, 'op-1']);
    await escribe(A);
    expect((await modulos(A)).rows).toEqual(antes);
  });

  it('pausar A no afecta a B', async () => {
    await sistema.query('select core.pausar_cuenta($1, $2, $3)', [A, 'otra pausa', 'op-1']);
    await escribe(B);
    await expect(escribe(A)).rejects.toThrow(/no está activo/);
    await sistema.query('select core.reactivar_cuenta($1, null, $2)', [A, 'op-1']);
  });

  it('dar de baja no borra filas y también bloquea la escritura', async () => {
    const cuenta = async () =>
      Object.fromEntries(
        await Promise.all(
          ['core.empresa_modulos', 'core.empresa_modulos_eventos', 'core.empresa_cuenta_eventos', 'core.modulos'].map(async (t) => [
            t,
            (await sistema.query(`select count(*)::int as n from ${t}`)).rows[0].n,
          ]),
        ),
      );
    const antes = await cuenta();
    const eventosCuenta = (await eventos(B)).rows.length; // B no tenía fila: alta + baja
    await sistema.query('select core.dar_baja_cuenta($1, $2, $3)', [B, 'fin de relación', 'op-2']);
    await expect(escribe(B)).rejects.toThrow(/no está activo/);
    const despues = await cuenta();
    expect(despues['core.empresa_modulos']).toBe(antes['core.empresa_modulos']);
    expect(despues['core.modulos']).toBe(antes['core.modulos']);
    expect(despues['core.empresa_cuenta_eventos']).toBeGreaterThan(antes['core.empresa_cuenta_eventos']!);
    expect((await eventos(B)).rows.length).toBe(eventosCuenta + 2);
    await sistema.query('select core.reactivar_cuenta($1, $2, $3)', [B, 'vuelve', 'op-2']);
    await escribe(B);
  });

  it('el motivo vacío o de menos de 5 caracteres se rechaza', async () => {
    for (const m of [null, '', '   ', 'abc']) {
      await expect(sistema.query('select core.pausar_cuenta($1, $2, $3)', [A, m, 'op'])).rejects.toThrow(/motivo es obligatorio/);
      await expect(sistema.query('select core.dar_baja_cuenta($1, $2, $3)', [A, m, 'op'])).rejects.toThrow(/motivo es obligatorio/);
    }
  });

  it('cada cambio deja un evento con actor y estados; pausar dos veces no duplica; el historial no se edita', async () => {
    const e = empresaDePrueba();
    await sistema.query('select core.pausar_cuenta($1, $2, $3)', [e, 'mora de pago', 'op-3']);
    await sistema.query('select core.pausar_cuenta($1, $2, $3)', [e, 'mora de pago', 'op-3']);
    await sistema.query('select core.dar_baja_cuenta($1, $2, $3)', [e, 'cierre definitivo', 'op-4']);
    await sistema.query('select core.reactivar_cuenta($1, null, $2)', [e, 'op-5']);
    expect((await eventos(e)).rows).toEqual([
      { evento: 'alta', estado_anterior: null, estado_nuevo: 'activa', motivo: null, actor: 'op-3' },
      { evento: 'pausa', estado_anterior: 'activa', estado_nuevo: 'pausada', motivo: 'mora de pago', actor: 'op-3' },
      { evento: 'baja', estado_anterior: 'pausada', estado_nuevo: 'baja', motivo: 'cierre definitivo', actor: 'op-4' },
      { evento: 'reactivacion', estado_anterior: 'baja', estado_nuevo: 'activa', motivo: null, actor: 'op-5' },
    ]);
    await expect(sistema.query(`update core.empresa_cuenta_eventos set motivo = 'x'`)).rejects.toThrow();
    await expect(sistema.query(`delete from core.empresa_cuenta_eventos`)).rejects.toThrow();
  });

  it('capaz_app no ejecuta las funciones, no cambia su estado y no ve la cuenta de otra empresa', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query('select core.reactivar_cuenta($1, null, null)', [A]))).rejects.toThrow(/permission denied/);
    await expect(comoEmpresa(app, A, (c) => c.query(`update core.empresa_cuenta set estado = 'activa'`))).rejects.toThrow(/permission denied/);
    await sistema.query('select core.pausar_cuenta($1, $2, $3)', [B, 'prueba de vista', 'op']);
    const { rows } = await comoEmpresa(app, A, (c) => c.query('select tenant_id from core.empresa_cuenta'));
    expect(rows.every((r) => r.tenant_id === A)).toBe(true);
    await sistema.query('select core.reactivar_cuenta($1, null, $2)', [B, 'op']);
  });
});
