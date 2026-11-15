import type { ClaveApi, Conexion } from '@capaz/shared';
import { sql } from 'drizzle-orm';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// SQL de conexiones y claves de API (dentro de `conEmpresa`; la RLS aísla por empresa). Las credenciales
// cifradas solo se leen con `credencialesDe`, que usa el servicio que las necesita; ninguna salida las incluye.

const iso = (v: string | Date | null): string | null => (v === null ? null : new Date(v).toISOString());

type FilaDeConexion = {
  id: string;
  conector: string;
  estado: Conexion['estado'];
  configuracion: Record<string, unknown>;
  tiene_credenciales: boolean;
  ultimo_error: string | null;
  ultimo_uso_en: string | Date | null;
  creado_en: string | Date;
  actualizado_en: string | Date;
};

const COLUMNAS_DE_CONEXION = sql`id, conector, estado, configuracion, (credenciales_cifradas is not null) as tiene_credenciales,
  ultimo_error, ultimo_uso_en, creado_en, actualizado_en`;

export const comoConexion = (f: FilaDeConexion): Conexion => ({
  id: f.id,
  conector: f.conector,
  estado: f.estado,
  configuracion: f.configuracion,
  credencialesConfiguradas: f.tiene_credenciales,
  ultimoError: f.ultimo_error,
  ultimoUsoEn: iso(f.ultimo_uso_en),
  creadoEn: iso(f.creado_en)!,
  actualizadoEn: iso(f.actualizado_en)!,
});

export async function buscarConexion(tx: Transaccion, conector: string, bloquear = false): Promise<FilaDeConexion | undefined> {
  const r = await tx.execute<FilaDeConexion>(
    sql`select ${COLUMNAS_DE_CONEXION} from core.conexiones where conector = ${conector} ${bloquear ? sql`for update` : sql``}`,
  );
  return r.rows[0];
}

export async function estadosDeConexiones(tx: Transaccion): Promise<Map<string, Conexion['estado']>> {
  const r = await tx.execute<{ conector: string; estado: Conexion['estado'] }>(sql`select conector, estado from core.conexiones`);
  return new Map(r.rows.map((f) => [f.conector, f.estado]));
}

export type GuardadoDeConexion = {
  conector: string;
  estado: Conexion['estado'];
  configuracion: Record<string, unknown>;
  /** `undefined` conserva las credenciales que ya había. */
  credenciales?: { cifrado: string; version: number };
  usuarioId: string;
};

export async function guardarConexion(tx: Transaccion, g: GuardadoDeConexion): Promise<FilaDeConexion> {
  const cifrado = g.credenciales?.cifrado ?? null;
  const version = g.credenciales?.version ?? null;
  const r = await tx.execute<FilaDeConexion>(
    sql`insert into core.conexiones (tenant_id, conector, estado, configuracion, credenciales_cifradas, clave_version, creado_por)
        values (current_setting('app.tenant_id', true), ${g.conector}, ${g.estado}, ${JSON.stringify(g.configuracion)}::jsonb, ${cifrado}, ${version}, ${g.usuarioId})
        on conflict (tenant_id, conector) do update set
          estado = excluded.estado,
          configuracion = excluded.configuracion,
          credenciales_cifradas = coalesce(excluded.credenciales_cifradas, core.conexiones.credenciales_cifradas),
          clave_version = coalesce(excluded.clave_version, core.conexiones.clave_version),
          ultimo_error = null
        returning ${COLUMNAS_DE_CONEXION}`,
  );
  return r.rows[0]!;
}

export async function desactivarConexion(tx: Transaccion, conector: string): Promise<FilaDeConexion | undefined> {
  const r = await tx.execute<FilaDeConexion>(
    sql`update core.conexiones set estado = 'desactivada' where conector = ${conector} returning ${COLUMNAS_DE_CONEXION}`,
  );
  return r.rows[0];
}

/** Solo para el código que USA la credencial (un conector al enviar). Nunca se devuelve por la API. */
export async function credencialesDe(tx: Transaccion, conector: string): Promise<string | null> {
  const r = await tx.execute<{ c: string | null }>(sql`select credenciales_cifradas as c from core.conexiones where conector = ${conector}`);
  return r.rows[0]?.c ?? null;
}

// ---- Claves de API --------------------------------------------------------------------------

type FilaDeClave = {
  id: string;
  nombre: string;
  prefijo: string;
  alcance: string[];
  creado_por: string;
  creado_en: string | Date;
  ultimo_uso_en: string | Date | null;
  revocada_en: string | Date | null;
};

const COLUMNAS_DE_CLAVE = sql`id, nombre, prefijo, alcance, creado_por, creado_en, ultimo_uso_en, revocada_en`;

export const comoClave = (f: FilaDeClave): ClaveApi => ({
  id: f.id,
  nombre: f.nombre,
  prefijo: f.prefijo,
  alcance: f.alcance as ClaveApi['alcance'],
  creadoPor: f.creado_por,
  creadoEn: iso(f.creado_en)!,
  ultimoUsoEn: iso(f.ultimo_uso_en),
  revocadaEn: iso(f.revocada_en),
});

export async function listarClaves(tx: Transaccion): Promise<FilaDeClave[]> {
  return (await tx.execute<FilaDeClave>(sql`select ${COLUMNAS_DE_CLAVE} from core.claves_api order by creado_en desc, id`)).rows;
}

export async function insertarClave(tx: Transaccion, c: { hash: string; nombre: string; prefijo: string; alcance: string[]; usuarioId: string }): Promise<FilaDeClave> {
  const r = await tx.execute<FilaDeClave>(
    sql`insert into core.claves_api (hash, tenant_id, nombre, prefijo, alcance, creado_por)
        values (${c.hash}, current_setting('app.tenant_id', true), ${c.nombre}, ${c.prefijo}, ${arregloDeTexto(c.alcance)}::text[], ${c.usuarioId})
        returning ${COLUMNAS_DE_CLAVE}`,
  );
  return r.rows[0]!;
}

export async function buscarClave(tx: Transaccion, id: string, bloquear = false): Promise<FilaDeClave | undefined> {
  const r = await tx.execute<FilaDeClave>(sql`select ${COLUMNAS_DE_CLAVE} from core.claves_api where id = ${id} ${bloquear ? sql`for update` : sql``}`);
  return r.rows[0];
}

export async function revocarClave(tx: Transaccion, id: string): Promise<FilaDeClave | undefined> {
  const r = await tx.execute<FilaDeClave>(
    sql`update core.claves_api set revocada_en = coalesce(revocada_en, now()) where id = ${id} returning ${COLUMNAS_DE_CLAVE}`,
  );
  return r.rows[0];
}

/** Literal de arreglo de PostgreSQL para pasar listas de texto como un solo parámetro (`::text[]`). */
export const arregloDeTexto = (xs: readonly string[]): string => `{${xs.map((x) => `"${x.replace(/(["\\])/g, '\\$1')}"`).join(',')}}`;
