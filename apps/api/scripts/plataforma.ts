import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { variable } from './config.ts';

// `pnpm plataforma <comando>`: operar empresas y módulos durante el piloto, hasta que exista la
// consola (fase 9). Corre con los roles de plataforma y de autenticación; NUNCA con el dueño.
//
//   empresas
//   activar|suspender|baja|reactivar --empresa <id> --modulo <codigo> [--prueba-dias N] [--motivo "…"]
//   crear-empresa --nombre "…" --correo <correo de un usuario ya registrado>
//   admin --correo <correo>
//
// Lo de cuentas (restablecer contraseña) llega con el proveedor de correo o con la consola.
// Cada acción deja su actor en el historial: `plataforma:cli`.

export type Urls = { auth: string; sistema: string; app: string };
export type Opciones = Record<string, string | undefined>;

const ACTOR = 'plataforma:cli';
const requerida = (o: Opciones, k: string): string => {
  const v = o[k];
  if (!v) throw new Error(`Falta --${k}.`);
  return v;
};

export function leerArgumentos(argv: readonly string[]): { comando: string; opciones: Opciones } {
  const [comando = '', ...resto] = argv;
  const opciones: Opciones = {};
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i]!;
    if (a.startsWith('--')) opciones[a.slice(2)] = resto[i + 1] && !resto[i + 1]!.startsWith('--') ? resto[++i] : 'true';
  }
  return { comando, opciones };
}

export async function plataforma(comando: string, o: Opciones, urls: Urls): Promise<string> {
  const auth = new pg.Pool({ connectionString: urls.auth, max: 1 });
  const sistema = new pg.Pool({ connectionString: urls.sistema, max: 1 });
  const app = new pg.Pool({ connectionString: urls.app, max: 1 });
  try {
    switch (comando) {
      case 'empresas':
        return await listar(auth, sistema);
      case 'activar':
      case 'suspender':
      case 'baja':
      case 'reactivar':
        return await cambiarModulo(comando, o, auth, sistema);
      case 'crear-empresa':
        return await crearEmpresa(o, auth, sistema, app);
      case 'admin':
        return await hacerAdmin(o, auth, sistema);
      default:
        throw new Error(`Comando desconocido «${comando}». Usa: empresas, activar, suspender, baja, reactivar, crear-empresa, admin.`);
    }
  } finally {
    await Promise.all([auth.end(), sistema.end(), app.end()]);
  }
}

async function existeEmpresa(auth: pg.Pool, id: string): Promise<string> {
  const { rows } = await auth.query<{ name: string }>('select name from auth.organization where id = $1', [id]);
  if (!rows[0]) throw new Error(`La empresa «${id}» no existe.`);
  return rows[0].name;
}

async function listar(auth: pg.Pool, sistema: pg.Pool): Promise<string> {
  const { rows: empresas } = await auth.query<{ id: string; name: string }>('select id, name from auth.organization order by created_at');
  const { rows: contratos } = await sistema.query<{ tenant_id: string; modulo: string; estado: string }>('select tenant_id, modulo, estado from core.empresa_modulos');
  if (!empresas.length) return 'No hay empresas.';
  return empresas
    .map((e) => `${e.id}  ${e.name}  [${contratos.filter((c) => c.tenant_id === e.id).map((c) => `${c.modulo}:${c.estado}`).join(', ') || 'sin módulos'}]`)
    .join('\n');
}

async function cambiarModulo(comando: string, o: Opciones, auth: pg.Pool, sistema: pg.Pool): Promise<string> {
  const empresa = requerida(o, 'empresa');
  const modulo = requerida(o, 'modulo');
  const nombre = await existeEmpresa(auth, empresa); // la plataforma no puede leer `auth`: se valida con el rol de autenticación
  const dias = o['prueba-dias'] ? Number(o['prueba-dias']) : null;
  if (dias !== null && (!Number.isInteger(dias) || dias <= 0)) throw new Error('--prueba-dias debe ser un entero positivo.');
  const motivo = o.motivo ?? null;
  const consultas: Record<string, [string, unknown[]]> = {
    activar: ['select core.activar_modulo($1, $2, $3, $4)', [empresa, modulo, dias, ACTOR]],
    suspender: ['select core.suspender_modulo($1, $2, $3, $4)', [empresa, modulo, motivo, ACTOR]],
    baja: ['select core.dar_baja_modulo($1, $2, $3, $4)', [empresa, modulo, motivo, ACTOR]],
    reactivar: ['select core.reactivar_modulo($1, $2, $3)', [empresa, modulo, ACTOR]],
  };
  const [sql, params] = consultas[comando]!;
  await sistema.query(sql, params);
  return `${nombre}: ${modulo} → ${comando}${dias ? ` (prueba de ${dias} días)` : ''}.`;
}

async function crearEmpresa(o: Opciones, auth: pg.Pool, sistema: pg.Pool, app: pg.Pool): Promise<string> {
  const nombre = requerida(o, 'nombre').trim();
  const correo = requerida(o, 'correo').trim().toLowerCase();
  if (nombre.length < 2) throw new Error('El nombre de la empresa es muy corto.');
  const { rows: usuarios } = await auth.query<{ id: string }>('select id from auth."user" where lower(email) = $1', [correo]);
  if (!usuarios[0]) throw new Error(`No hay un usuario registrado con ${correo}: debe registrarse primero.`);

  const id = randomBytes(16).toString('hex');
  const slug = `${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'empresa'}-${randomBytes(3).toString('hex')}`;
  const c = await auth.connect();
  try {
    await c.query('begin');
    await c.query('insert into auth.organization (id, name, slug, created_at) values ($1, $2, $3, now())', [id, nombre, slug]);
    await c.query(`insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, 'owner', now())`, [randomBytes(16).toString('hex'), id, usuarios[0].id]);
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }

  // Aprovisionamiento: configuración de la empresa (rol de negocio) y módulos por defecto (rol de plataforma).
  const n = await app.connect();
  try {
    await n.query('begin');
    await n.query(`select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)`, [id, usuarios[0].id]);
    await n.query('insert into core.empresa_config (tenant_id) values ($1) on conflict do nothing', [id]);
    await n.query('commit');
  } finally {
    n.release();
  }
  const { rows: porDefecto } = await sistema.query<{ codigo: string; prueba_dias: number | null }>('select codigo, prueba_dias from core.modulos where por_defecto and activo');
  for (const m of porDefecto) await sistema.query('select core.activar_modulo($1, $2, $3, $4)', [id, m.codigo, m.prueba_dias, ACTOR]);
  return `Empresa «${nombre}» creada (${id}) con ${correo} como dueño. Módulos por defecto: ${porDefecto.map((m) => m.codigo).join(', ') || 'ninguno'}.`;
}

async function hacerAdmin(o: Opciones, auth: pg.Pool, sistema: pg.Pool): Promise<string> {
  const correo = requerida(o, 'correo').trim().toLowerCase();
  const { rows } = await auth.query<{ id: string }>('select id from auth."user" where lower(email) = $1', [correo]);
  if (!rows[0]) throw new Error(`No hay un usuario registrado con ${correo}.`);
  await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1) on conflict do nothing', [rows[0].id]);
  return `${correo} es administrador de plataforma.`;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const { comando, opciones } = leerArgumentos(process.argv.slice(2));
  plataforma(comando, opciones, { auth: variable('DATABASE_URL_AUTH'), sistema: variable('DATABASE_URL_SISTEMA'), app: variable('DATABASE_URL_APP') })
    .then((m) => console.log(m))
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
