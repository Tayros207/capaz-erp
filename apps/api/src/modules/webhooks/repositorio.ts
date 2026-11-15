import type { WebhookEnvio, WebhookSaliente } from '@capaz/shared';
import { sql, type SQL } from 'drizzle-orm';
import { arregloDeTexto } from '../../core/conectores/repositorio.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// SQL de webhooks de salida y su cola de envíos. El secreto cifrado solo lo lee la entrega; ninguna salida lo incluye.

const iso = (v: string | Date | null): string | null => (v === null ? null : new Date(v).toISOString());

export type FilaDeSaliente = {
  id: string;
  nombre: string;
  url: string;
  eventos: string[];
  secreto_cifrado: string;
  activo: boolean;
  ultimo_envio_en: string | Date | null;
  ultimo_error: string | null;
  creado_en: string | Date;
  actualizado_en: string | Date;
  marca: string;
};

const COLS = sql`id, nombre, url, eventos, secreto_cifrado, activo, ultimo_envio_en, ultimo_error, creado_en, actualizado_en, creado_en::text as marca`;

export const comoSaliente = (f: FilaDeSaliente): WebhookSaliente => ({
  id: f.id,
  nombre: f.nombre,
  url: f.url,
  eventos: f.eventos,
  activo: f.activo,
  ultimoEnvioEn: iso(f.ultimo_envio_en),
  ultimoError: f.ultimo_error,
  creadoEn: iso(f.creado_en)!,
  actualizadoEn: iso(f.actualizado_en)!,
});

export type Pagina<T> = { filas: T[]; siguiente: string | null };
type Cursor = { marca: string; id: string };

export const codificarCursor = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
export function decodificarCursor(texto: string): Cursor | null {
  try {
    const c = JSON.parse(Buffer.from(texto, 'base64url').toString()) as Cursor;
    return typeof c.marca === 'string' && typeof c.id === 'string' && /^[0-9a-f-]{36}$/.test(c.id) && !Number.isNaN(Date.parse(c.marca)) ? c : null;
  } catch {
    return null;
  }
}

function pagina<T extends { marca: string; id: string }>(filas: T[], limite: number): Pagina<T> {
  const hay = filas.length > limite;
  const dentro = hay ? filas.slice(0, limite) : filas;
  const ultima = dentro[dentro.length - 1];
  return { filas: dentro, siguiente: hay && ultima ? codificarCursor({ marca: ultima.marca, id: ultima.id }) : null };
}

const desde = (c: Cursor | null, columna: string): SQL => (c ? sql`and (${sql.raw(columna)}, id) < (${c.marca}::timestamptz, ${c.id}::uuid)` : sql``);

export async function listarSalientes(tx: Transaccion, o: { activo?: boolean; limite: number }, cursor: Cursor | null): Promise<Pagina<FilaDeSaliente>> {
  const filtro = o.activo === undefined ? sql`` : sql`and activo = ${o.activo}`;
  const r = await tx.execute<FilaDeSaliente>(
    sql`select ${COLS} from core.webhooks_salientes where true ${filtro} ${desde(cursor, 'creado_en')} order by creado_en desc, id desc limit ${o.limite + 1}`,
  );
  return pagina(r.rows, o.limite);
}

export async function buscarSaliente(tx: Transaccion, id: string, bloquear = false): Promise<FilaDeSaliente | undefined> {
  const r = await tx.execute<FilaDeSaliente>(sql`select ${COLS} from core.webhooks_salientes where id = ${id} ${bloquear ? sql`for update` : sql``}`);
  return r.rows[0];
}

export async function insertarSaliente(
  tx: Transaccion,
  s: { id: string; nombre: string; url: string; eventos: string[]; secretoCifrado: string; version: number; usuarioId: string },
): Promise<FilaDeSaliente> {
  const r = await tx.execute<FilaDeSaliente>(
    sql`insert into core.webhooks_salientes (id, tenant_id, nombre, url, eventos, secreto_cifrado, clave_version, creado_por)
        values (${s.id}, current_setting('app.tenant_id', true), ${s.nombre}, ${s.url}, ${arregloDeTexto(s.eventos)}::text[], ${s.secretoCifrado}, ${s.version}, ${s.usuarioId})
        returning ${COLS}`,
  );
  return r.rows[0]!;
}

export type CambiosDeSaliente = { nombre?: string; url?: string; eventos?: string[]; activo?: boolean; secreto?: { cifrado: string; version: number } };

export async function editarSaliente(tx: Transaccion, id: string, c: CambiosDeSaliente): Promise<FilaDeSaliente | undefined> {
  const r = await tx.execute<FilaDeSaliente>(
    sql`update core.webhooks_salientes set
          nombre = coalesce(${c.nombre ?? null}, nombre),
          url = coalesce(${c.url ?? null}, url),
          eventos = coalesce(${c.eventos ? arregloDeTexto(c.eventos) : null}::text[], eventos),
          activo = coalesce(${c.activo ?? null}::boolean, activo),
          secreto_cifrado = coalesce(${c.secreto?.cifrado ?? null}, secreto_cifrado),
          clave_version = coalesce(${c.secreto?.version ?? null}::smallint, clave_version)
        where id = ${id} returning ${COLS}`,
  );
  return r.rows[0];
}

/** Webhooks activos que escuchan este tipo de evento: exacto, familia `x.*` o `*`. */
export async function suscritosA(tx: Transaccion, tipo: string): Promise<FilaDeSaliente[]> {
  const familia = `${tipo.split('.')[0]}.*`;
  const r = await tx.execute<FilaDeSaliente>(
    sql`select ${COLS} from core.webhooks_salientes where activo and (eventos && array[${tipo}, ${familia}, '*']::text[]) order by creado_en, id`,
  );
  return r.rows;
}

// ---- Envíos ---------------------------------------------------------------------------------

export type FilaDeEnvio = {
  id: string;
  webhook_id: string;
  evento_id: string;
  tipo: string;
  estado: WebhookEnvio['estado'];
  intentos: number;
  codigo_http: number | null;
  ultimo_error: string | null;
  creado_en: string | Date;
  enviado_en: string | Date | null;
  marca: string;
};

const COLS_ENVIO = sql`id, webhook_id, evento_id, tipo, estado, intentos, codigo_http, ultimo_error, creado_en, enviado_en, creado_en::text as marca`;

export const comoEnvio = (f: FilaDeEnvio): WebhookEnvio => ({
  id: f.id,
  webhookId: f.webhook_id,
  eventoId: f.evento_id,
  tipo: f.tipo,
  estado: f.estado,
  intentos: f.intentos,
  codigoHttp: f.codigo_http,
  ultimoError: f.ultimo_error,
  creadoEn: iso(f.creado_en)!,
  enviadoEn: iso(f.enviado_en),
});

/** Crea el envío de este evento para este webhook, o devuelve el que ya existe (un evento no se envía dos veces). */
export async function asegurarEnvio(tx: Transaccion, webhookId: string, eventoId: string, tipo: string): Promise<FilaDeEnvio> {
  await tx.execute(
    sql`insert into core.webhooks_envios (tenant_id, webhook_id, evento_id, tipo)
        values (current_setting('app.tenant_id', true), ${webhookId}, ${eventoId}, ${tipo})
        on conflict (tenant_id, webhook_id, evento_id) do nothing`,
  );
  const r = await tx.execute<FilaDeEnvio>(sql`select ${COLS_ENVIO} from core.webhooks_envios where webhook_id = ${webhookId} and evento_id = ${eventoId}`);
  return r.rows[0]!;
}

export async function buscarEnvio(tx: Transaccion, id: string, bloquear = false): Promise<FilaDeEnvio | undefined> {
  const r = await tx.execute<FilaDeEnvio>(sql`select ${COLS_ENVIO} from core.webhooks_envios where id = ${id} ${bloquear ? sql`for update` : sql``}`);
  return r.rows[0];
}

/** Envíos creados para ese webhook en el último minuto, sin contar `salvo`: el tope por conexión y minuto. */
export async function enviosDelUltimoMinuto(tx: Transaccion, webhookId: string, salvo: string): Promise<number> {
  const r = await tx.execute<{ n: number }>(
    sql`select count(*)::int as n from core.webhooks_envios where webhook_id = ${webhookId} and id <> ${salvo} and creado_en > now() - interval '1 minute'`,
  );
  return r.rows[0]!.n;
}

export async function listarEnvios(
  tx: Transaccion,
  o: { webhookId?: string; estado?: string; limite: number },
  cursor: Cursor | null,
): Promise<Pagina<FilaDeEnvio>> {
  const w = o.webhookId ? sql`and webhook_id = ${o.webhookId}` : sql``;
  const e = o.estado ? sql`and estado = ${o.estado}` : sql``;
  const r = await tx.execute<FilaDeEnvio>(
    sql`select ${COLS_ENVIO} from core.webhooks_envios where true ${w} ${e} ${desde(cursor, 'creado_en')} order by creado_en desc, id desc limit ${o.limite + 1}`,
  );
  return pagina(r.rows, o.limite);
}

export async function reiniciarEnvio(tx: Transaccion, id: string): Promise<void> {
  await tx.execute(sql`update core.webhooks_envios set estado = 'pendiente', intentos = 0, ultimo_error = null where id = ${id} and estado <> 'enviado'`);
}

/** Anota el resultado de un intento. Pasados `maxIntentos` sin éxito, el envío queda `fallido`. */
export async function registrarIntento(
  tx: Transaccion,
  envio: { id: string; webhookId: string },
  r: { ok: boolean; codigoHttp: number | null; error: string | null },
  maxIntentos: number,
): Promise<FilaDeEnvio> {
  const fila = await tx.execute<FilaDeEnvio>(
    sql`update core.webhooks_envios set
          intentos = intentos + 1,
          codigo_http = ${r.codigoHttp},
          ultimo_error = ${r.error},
          estado = case when ${r.ok} then 'enviado' when intentos + 1 >= ${maxIntentos} then 'fallido' else 'pendiente' end,
          enviado_en = case when ${r.ok} then now() else enviado_en end
        where id = ${envio.id} returning ${COLS_ENVIO}`,
  );
  await tx.execute(
    sql`update core.webhooks_salientes set ultimo_error = ${r.error}, ultimo_envio_en = case when ${r.ok} then now() else ultimo_envio_en end where id = ${envio.webhookId}`,
  );
  return fila.rows[0]!;
}

export async function cargaDeEvento(tx: Transaccion, eventoId: string): Promise<{ carga: unknown; creadoEn: Date } | undefined> {
  const r = await tx.execute<{ carga: unknown; creado_en: string | Date }>(sql`select carga, creado_en from core.eventos_salida where id = ${eventoId}`);
  const f = r.rows[0];
  return f ? { carga: f.carga, creadoEn: new Date(f.creado_en) } : undefined;
}
