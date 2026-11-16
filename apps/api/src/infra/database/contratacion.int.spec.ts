import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';

// Contratación de módulos (fase 4, parte de base de datos): quién puede qué, y qué bloquea la base.

let app: pg.Pool;
let sistema: pg.Pool;
let owner: pg.Pool;
const M = `mod_${Date.now()}`;
const D = `dep_${Date.now()}`;
const E = empresaDePrueba();
const OTRA = empresaDePrueba();

beforeAll(async () => {
  app = abrirPool('app');
  sistema = abrirPool('sistema');
  owner = abrirPool('owner');
  await sistema.query(`insert into core.modulos (codigo, nombre) values ($1, 'Base de prueba')`, [D]);
  await sistema.query(`insert into core.modulos (codigo, nombre, depende_de) values ($1, 'Módulo de prueba', array[$2]::text[])`, [M, D]);
});
afterAll(async () => {
  await Promise.all([app.end(), sistema.end(), owner.end()]);
});

const activo = (empresa: string, modulo: string, pool = app) =>
  comoEmpresa(pool, empresa, async (c) => (await c.query('select core.modulo_activo($1, $2) as v', [empresa, modulo])).rows[0].v as boolean);

describe('lo que puede y no puede cada rol', () => {
  it('capaz_app no puede ejecutar las funciones de contratación', async () => {
    for (const f of ['activar_modulo', 'suspender_modulo', 'dar_baja_modulo', 'reactivar_modulo']) {
      const aridad = f === 'activar_modulo' ? "$1, $2, null, null" : f === 'reactivar_modulo' ? '$1, $2, null' : '$1, $2, null, null';
      await expect(comoEmpresa(app, E, (c) => c.query(`select core.${f}(${aridad})`, [E, M]))).rejects.toThrow(/permission denied/);
    }
  });

  it('capaz_app no puede escribir en empresa_modulos ni en el catálogo', async () => {
    await expect(comoEmpresa(app, E, (c) => c.query(`insert into core.empresa_modulos (tenant_id, modulo) values ($1, $2)`, [E, M]))).rejects.toThrow(/permission denied/);
    await expect(app.query(`update core.modulos set activo = false`)).rejects.toThrow(/permission denied/);
  });

  it('capaz_app no puede entrar a la lista de administradores', async () => {
    await expect(app.query('select * from core.plataforma_admins')).rejects.toThrow(/permission denied/);
  });
});

describe('ciclo de vida de un módulo', () => {
  it('exige que la dependencia esté activa antes de activar', async () => {
    await expect(sistema.query('select core.activar_modulo($1, $2)', [E, M])).rejects.toThrow(/requiere el módulo/);
  });

  it('activar → el módulo queda activo y deja historial con actor', async () => {
    await sistema.query('select core.activar_modulo($1, $2, null, $3)', [E, D, 'operador-1']);
    await sistema.query('select core.activar_modulo($1, $2, null, $3)', [E, M, 'operador-1']);
    expect(await activo(E, M)).toBe(true);
    const { rows } = await sistema.query(`select evento, estado_nuevo, actor from core.empresa_modulos_eventos where tenant_id = $1 and modulo = $2`, [E, M]);
    expect(rows).toEqual([{ evento: 'alta', estado_nuevo: 'activo', actor: 'operador-1' }]);
  });

  it('otra empresa no ve el módulo como activo', async () => {
    expect(await activo(OTRA, M)).toBe(false);
    // y no puede consultar el estado de E desde su propia transacción
    expect(await comoEmpresa(app, OTRA, async (c) => (await c.query('select core.modulo_activo($1, $2) as v', [E, M])).rows[0].v)).toBe(false);
  });

  it('no se da de baja un módulo del que otro activo depende', async () => {
    await expect(sistema.query('select core.dar_baja_modulo($1, $2)', [E, D])).rejects.toThrow(/depende de él/);
  });

  it('suspender → deja de estar activo; exigir_modulo lanza', async () => {
    await sistema.query('select core.suspender_modulo($1, $2, $3, $4)', [E, M, 'mora', 'operador-1']);
    expect(await activo(E, M)).toBe(false);
    await expect(comoEmpresa(app, E, (c) => c.query('select core.exigir_modulo($1)', [M]))).rejects.toThrow(/no está activo/);
  });

  it('reactivar → vuelve a estar activo; exigir_modulo ya no lanza', async () => {
    await sistema.query('select core.reactivar_modulo($1, $2, $3)', [E, M, 'operador-1']);
    expect(await activo(E, M)).toBe(true);
    await comoEmpresa(app, E, (c) => c.query('select core.exigir_modulo($1)', [M]));
  });

  it('baja → solo lectura: la empresa sigue viendo su fila, pero el módulo no está activo', async () => {
    await sistema.query('select core.dar_baja_modulo($1, $2, $3, $4)', [E, M, 'cancelación', 'operador-1']);
    expect(await activo(E, M)).toBe(false);
    const { rows } = await comoEmpresa(app, E, (c) => c.query('select estado, baja_en is not null as con_fecha from core.empresa_modulos where modulo = $1', [M]));
    expect(rows).toEqual([{ estado: 'baja', con_fecha: true }]);
  });

  it('una prueba vencida equivale a baja', async () => {
    const e = empresaDePrueba();
    await sistema.query('select core.activar_modulo($1, $2, 1)', [e, D]);
    expect(await activo(e, D)).toBe(true);
    await owner.query(`select 1`); // el dueño no puede adelantar el reloj: se simula vencimiento vía la plataforma
    await sistema.query(`update core.empresa_modulos set prueba_hasta = now() - interval '1 minute' where tenant_id = $1 and modulo = $2`, [e, D]);
    expect(await activo(e, D)).toBe(false);
  });

  it('cada cambio dejó una fila en el historial, en orden, y el historial no se puede editar', async () => {
    const { rows } = await sistema.query<{ evento: string }>(`select evento from core.empresa_modulos_eventos where tenant_id = $1 and modulo = $2 order by creado_en, id`, [E, M]);
    expect(rows.map((r) => r.evento)).toEqual(['alta', 'suspension', 'reactivacion', 'baja']);
    await expect(sistema.query(`update core.empresa_modulos_eventos set motivo = 'x'`)).rejects.toThrow();
    await expect(sistema.query(`delete from core.empresa_modulos_eventos`)).rejects.toThrow();
  });
});

describe('asignación de módulos a usuarios', () => {
  it('solo se asigna un módulo que la empresa tiene contratado (llave compuesta)', async () => {
    await expect(
      comoEmpresa(app, OTRA, (c) => c.query(`insert into core.usuario_modulos (tenant_id, usuario_id, modulo) values ($1, 'u1', $2)`, [OTRA, M])),
    ).rejects.toThrow(/usuario_modulo_contratado/);
  });

  it('la empresa asigna con nivel y alcance válidos; rechaza valores fuera de la lista', async () => {
    await comoEmpresa(app, E, (c) => c.query(`insert into core.usuario_modulos (tenant_id, usuario_id, modulo, nivel, alcance) values ($1, 'u1', $2, 'lectura', 'propios')`, [E, M]), { confirmar: true });
    await expect(comoEmpresa(app, E, (c) => c.query(`insert into core.usuario_modulos (tenant_id, usuario_id, modulo, nivel) values ($1, 'u2', $2, 'dueño')`, [E, M]))).rejects.toThrow(/usuario_modulo_nivel/);
  });
});

describe('solicitudes de módulo', () => {
  it('la empresa solicita sin poder fijar el estado; la plataforma solo cambia estado y fecha', async () => {
    await comoEmpresa(app, E, (c) => c.query(`insert into core.solicitudes_modulo (tenant_id, modulo, usuario_id, nota) values ($1, $2, 'u1', 'lo necesitamos')`, [E, D]), { confirmar: true });
    await expect(comoEmpresa(app, E, (c) => c.query(`insert into core.solicitudes_modulo (tenant_id, modulo, usuario_id, estado) values ($1, $2, 'u1', 'atendida')`, [E, D]))).rejects.toThrow(/permission denied/);
    await sistema.query(`update core.solicitudes_modulo set estado = 'atendida', atendido_en = now() where tenant_id = $1`, [E]);
    await expect(sistema.query(`update core.solicitudes_modulo set nota = 'cambiada'`)).rejects.toThrow(/permission denied/);
  });
});

describe('lista de plataforma: capaz_sistema tiene exactamente lo previsto', () => {
  // Cada fase que abra algo a la plataforma lo agrega aquí; todo lo demás debe seguir cerrado.
  const PERMITIDO: Record<string, string[]> = {
    'core.modulos': ['select', 'insert', 'update', 'delete'],
    'core.planes': ['select', 'insert', 'update', 'delete'],
    'core.plan_modulos': ['select', 'insert', 'update', 'delete'],
    'core.empresa_modulos': ['select', 'insert', 'update'],
    'core.empresa_modulos_eventos': ['select', 'insert'],
    'core.solicitudes_modulo': ['select'],
    'core.plataforma_admins': ['select', 'insert', 'delete'],
    'core.confirmaciones_usadas': ['delete'],
    'core.idempotencia': ['delete'],
    'core.eventos_salida': ['delete'],
    'core.eventos_procesados': ['delete'],
    'core.auditoria_plataforma': ['select', 'insert'],
    'core.v_empresas_plataforma': ['select'],
    'core.conectores': ['select', 'insert', 'update', 'delete'],
  };

  it('ninguna otra tabla es accesible, y las permitidas tienen justo esos permisos', async () => {
    const { rows } = await owner.query<{ tabla: string; priv: string; tiene: boolean }>(`
      select n.nspname || '.' || c.relname as tabla, p.priv, has_table_privilege('capaz_sistema', c.oid, p.priv) as tiene
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('select'), ('insert'), ('update'), ('delete')) as p(priv)
      where c.relkind in ('r', 'v') and n.nspname in ('core', 'registro', 'cotizador', 'crm', 'ordenes', 'auth')`);
    const reales: Record<string, string[]> = {};
    for (const r of rows) if (r.tiene) (reales[r.tabla] ??= []).push(r.priv);
    const ordenar = (o: Record<string, string[]>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]));
    expect(ordenar(reales)).toEqual(ordenar(PERMITIDO));
  });

  // Permisos SOLO por columna (no se ven con has_table_privilege): tabla -> privilegio -> columnas.
  const PERMITIDO_POR_COLUMNA: Record<string, Record<string, string[]>> = {
    'core.solicitudes_modulo': { update: ['atendido_en', 'estado'] },
    'core.confirmaciones_usadas': { select: ['tenant_id', 'usado_en'] },
    'core.idempotencia': { select: ['creado_en', 'tenant_id'] },
    'core.eventos_salida': {
      select: ['creado_en', 'disponible_en', 'fallido_en', 'id', 'intentos', 'procesado_en', 'tenant_id', 'tipo'],
      update: ['disponible_en', 'fallido_en', 'intentos', 'procesado_en', 'ultimo_error'],
    },
    'core.eventos_procesados': { select: ['procesado_en', 'tenant_id'] },
    'core.auditoria': { select: ['creado_en', 'tenant_id'] },
    'core.conexiones': { select: ['conector', 'creado_en', 'estado', 'id', 'tenant_id', 'ultimo_uso_en'] },
    'core.claves_api': { select: ['alcance', 'hash', 'id', 'revocada_en', 'tenant_id'], update: ['ultimo_uso_en'] },
    'core.reglas_automaticas': { select: ['activa', 'disparador_tipo', 'id', 'tenant_id'] },
  };

  it('los permisos por columna de capaz_sistema son exactamente los previstos', async () => {
    const { rows } = await owner.query<{ tabla: string; priv: string; columna: string }>(`
      select cp.table_schema || '.' || cp.table_name as tabla, lower(cp.privilege_type) as priv, cp.column_name as columna
      from information_schema.column_privileges cp
      join pg_class c on c.relname = cp.table_name and c.relnamespace = cp.table_schema::regnamespace
      where cp.grantee = 'capaz_sistema' and cp.table_schema in ('core', 'registro', 'cotizador', 'crm', 'ordenes', 'auth')
        and lower(cp.privilege_type) in ('select', 'insert', 'update', 'delete')
        and not has_table_privilege('capaz_sistema', c.oid, cp.privilege_type)`);
    const reales: Record<string, Record<string, string[]>> = {};
    for (const r of rows) ((reales[r.tabla] ??= {})[r.priv] ??= []).push(r.columna);
    const ordenar = (o: Record<string, Record<string, string[]>>) =>
      Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).map(([t, p]) => [t, Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]))]));
    expect(ordenar(reales)).toEqual(ordenar(PERMITIDO_POR_COLUMNA));
  });

  it('capaz_sistema no puede leer la carga de eventos_salida, pero sí sus columnas permitidas', async () => {
    await expect(sistema.query('select carga from core.eventos_salida')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select * from core.eventos_salida')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select ultimo_error from core.eventos_salida')).rejects.toThrow(/permission denied/);
    await sistema.query('select id, tenant_id, tipo, creado_en, disponible_en, procesado_en, intentos, fallido_en from core.eventos_salida');
  });

  it('capaz_sistema no puede leer las credenciales de conexiones, pero sí las columnas permitidas', async () => {
    await expect(sistema.query('select credenciales_cifradas from core.conexiones')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select * from core.conexiones')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select configuracion from core.conexiones')).rejects.toThrow(/permission denied/);
    await sistema.query('select id, tenant_id, conector, estado, ultimo_uso_en, creado_en from core.conexiones');
    await expect(sistema.query('select * from core.webhooks_salientes')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select * from core.borradores')).rejects.toThrow(/permission denied/);
  });

  it('la auditoría de plataforma solo admite inserción de capaz_sistema; capaz_app no la ve', async () => {
    await sistema.query(`insert into core.auditoria_plataforma (actor_usuario_id, herramienta, resultado, request_id) values ('op1', 'ejemplo', 'ok', 'r1')`);
    await expect(sistema.query(`update core.auditoria_plataforma set codigo = 'x'`)).rejects.toThrow(/permission denied/);
    await expect(sistema.query(`delete from core.auditoria_plataforma`)).rejects.toThrow(/permission denied/);
    await expect(app.query('select * from core.auditoria_plataforma')).rejects.toThrow(/permission denied/);
    await expect(app.query('select * from core.v_empresas_plataforma')).rejects.toThrow(/permission denied/);
    await sistema.query('select empresa_id, nombre, alta_en, miembros from core.v_empresas_plataforma');
    await expect(sistema.query('select usuario_id from core.auditoria')).rejects.toThrow(/permission denied/);
  });

  it('no puede leer datos de negocio ni la nota de una solicitud para modificarla', async () => {
    await expect(sistema.query('select * from core.empresa_config')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select * from core.usuario_modulos')).rejects.toThrow(/permission denied/);
    for (const t of ['clientes', 'productos', 'sucursales', 'auditoria', 'contadores']) {
      await expect(sistema.query(`select * from core.${t}`)).rejects.toThrow(/permission denied/);
    }
  });
});
