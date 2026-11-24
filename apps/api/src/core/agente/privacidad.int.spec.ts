import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';

// Las conversaciones del asistente son de UNA persona, no de la empresa: otra persona de la misma empresa no las ve, no las
// cambia y no cuelga mensajes en ellas. Es la primera política por persona del repositorio (`solo_propias`, restrictiva);
// esta prueba es la que demuestra que funciona junto a `aislamiento`. El uso (`core.uso`) sí es de toda la empresa.

let app: pg.Pool;
let owner: pg.Pool;
const EMPRESA = empresaDePrueba();
const OTRA_EMPRESA = empresaDePrueba();
// Ids nuevos en cada ejecución: la prueba confirma filas en la base y debe poder correr dos veces seguidas.
const CONVERSACION = randomUUID();
const TURNO = randomUUID();

/** Como `comoEmpresa`, pero eligiendo quién es la persona (`app.user_id`). */
async function como<T>(pool: pg.Pool, empresa: string, usuario: string, fn: (c: pg.PoolClient) => Promise<T>, confirmar = false): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)`, [empresa, usuario]);
    const r = await fn(c);
    await c.query(confirmar ? 'commit' : 'rollback');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

beforeAll(async () => {
  app = abrirPool('app');
  owner = abrirPool('owner');
  await como(app, EMPRESA, 'u_a', async (c) => {
    await c.query(`insert into core.agente_conversaciones (id, tenant_id, usuario_id, titulo) values ($1, $2, 'u_a', 'Pedidos de hoy')`, [CONVERSACION, EMPRESA]);
    await c.query(
      `insert into core.agente_mensajes (tenant_id, usuario_id, conversacion_id, turno_id, rol, contenido) values ($1, 'u_a', $2, $3, 'persona', 'Hola')`,
      [EMPRESA, CONVERSACION, TURNO],
    );
    await c.query(`insert into core.uso (tenant_id, usuario_id, origen, turno_id, modelo) values ($1, 'u_a', 'agente', $2, 'simulado/uno')`, [EMPRESA, TURNO]);
  }, true);
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe('conversaciones privadas por persona', () => {
  it('la dueña ve su conversación y su mensaje', async () => {
    await como(app, EMPRESA, 'u_a', async (c) => {
      expect((await c.query('select 1 from core.agente_conversaciones')).rowCount).toBe(1);
      expect((await c.query('select 1 from core.agente_mensajes')).rowCount).toBe(1);
    });
  });

  it('otra persona de la MISMA empresa no ve ni la conversación ni los mensajes', async () => {
    await como(app, EMPRESA, 'u_b', async (c) => {
      expect((await c.query('select 1 from core.agente_conversaciones')).rowCount).toBe(0);
      expect((await c.query('select 1 from core.agente_mensajes')).rowCount).toBe(0);
    });
  });

  it('otra persona no puede cambiar ni borrar la conversación ajena (0 filas afectadas)', async () => {
    await como(app, EMPRESA, 'u_b', async (c) => {
      expect((await c.query(`update core.agente_conversaciones set titulo = 'robada' where id = $1`, [CONVERSACION])).rowCount).toBe(0);
      expect((await c.query(`delete from core.agente_conversaciones where id = $1`, [CONVERSACION])).rowCount).toBe(0);
      expect((await c.query(`update core.agente_mensajes set contenido = 'robado'`)).rowCount).toBe(0);
      expect((await c.query(`delete from core.agente_mensajes`)).rowCount).toBe(0);
    });
    // Y sigue intacta para su dueña.
    await como(app, EMPRESA, 'u_a', async (c) => {
      const { rows } = await c.query<{ titulo: string }>('select titulo from core.agente_conversaciones');
      expect(rows[0]?.titulo).toBe('Pedidos de hoy');
    });
  });

  it('otra persona no puede crear una conversación a nombre de la dueña', async () => {
    await expect(
      como(app, EMPRESA, 'u_b', (c) =>
        c.query(`insert into core.agente_conversaciones (tenant_id, usuario_id, titulo) values ($1, 'u_a', 'falsa')`, [EMPRESA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('otra persona no puede colgar un mensaje en la conversación de la dueña', async () => {
    await expect(
      como(app, EMPRESA, 'u_b', (c) =>
        c.query(
          `insert into core.agente_mensajes (tenant_id, usuario_id, conversacion_id, turno_id, rol, contenido) values ($1, 'u_b', $2, $3, 'persona', 'intruso')`,
          [EMPRESA, CONVERSACION, randomUUID()],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('otra empresa tampoco ve nada, ni siquiera con el mismo nombre de persona', async () => {
    await como(app, OTRA_EMPRESA, 'u_a', async (c) => {
      expect((await c.query('select 1 from core.agente_conversaciones')).rowCount).toBe(0);
      expect((await c.query('select 1 from core.agente_mensajes')).rowCount).toBe(0);
    });
  });

  it('el dueño de la base, sin empresa ni persona fijadas, ve 0 filas (la RLS es forzada)', async () => {
    expect((await owner.query('select 1 from core.agente_conversaciones')).rowCount).toBe(0);
    expect((await owner.query('select 1 from core.agente_mensajes')).rowCount).toBe(0);
  });

  it('sin persona fijada en la sesión, ni siquiera la empresa ve conversaciones', async () => {
    await como(app, EMPRESA, '', async (c) => {
      expect((await c.query('select 1 from core.agente_conversaciones')).rowCount).toBe(0);
    });
  });
});

describe('uso: es de la empresa y no se puede cambiar', () => {
  it('otra persona de la misma empresa sí ve el uso de la dueña (el tope se suma entre todas)', async () => {
    await como(app, EMPRESA, 'u_b', async (c) => {
      expect((await c.query('select 1 from core.uso')).rowCount).toBe(1);
    });
  });

  it('ni cambiarlo ni borrarlo: solo se inserta', async () => {
    await expect(como(app, EMPRESA, 'u_a', (c) => c.query(`update core.uso set costo_microusd = 0`))).rejects.toThrow(/permission denied/);
    await expect(como(app, EMPRESA, 'u_a', (c) => c.query(`delete from core.uso`))).rejects.toThrow(/permission denied/);
  });

  it('otra empresa no ve el uso', async () => {
    await como(app, OTRA_EMPRESA, 'u_a', async (c) => {
      expect((await c.query('select 1 from core.uso')).rowCount).toBe(0);
    });
  });
});

describe('restricciones de datos', () => {
  it('un mensaje solo puede ser de la persona o del agente, y un título vacío se rechaza', async () => {
    await expect(
      como(app, EMPRESA, 'u_a', (c) =>
        c.query(
          `insert into core.agente_mensajes (tenant_id, usuario_id, conversacion_id, turno_id, rol) values ($1, 'u_a', $2, $3, 'robot')`,
          [EMPRESA, CONVERSACION, randomUUID()],
        ),
      ),
    ).rejects.toThrow(/agente_mensaje_rol/);
    await expect(
      como(app, EMPRESA, 'u_a', (c) => c.query(`insert into core.agente_conversaciones (tenant_id, usuario_id, titulo) values ($1, 'u_a', '')`, [EMPRESA])),
    ).rejects.toThrow(/agente_conversacion_titulo/);
  });

  it('el mismo turno y rol no se puede guardar dos veces (así un reintento no duplica)', async () => {
    await expect(
      como(app, EMPRESA, 'u_a', (c) =>
        c.query(
          `insert into core.agente_mensajes (tenant_id, usuario_id, conversacion_id, turno_id, rol, contenido) values ($1, 'u_a', $2, $3, 'persona', 'otra vez')`,
          [EMPRESA, CONVERSACION, TURNO],
        ),
      ),
    ).rejects.toThrow(/agente_mensajes_turno_rol/);
  });

  it('el modelo elegido por una empresa debe tener la forma «proveedor/nombre»', async () => {
    await expect(
      como(app, EMPRESA, 'u_a', (c) => c.query(`insert into core.agente_configuracion (tenant_id, modelo, actualizado_por) values ($1, 'sin-barra', 'u_a')`, [EMPRESA])),
    ).rejects.toThrow(/agente_modelo_forma/);
  });
});
