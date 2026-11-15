import { centimosSchema, rechazo, type Respuesta } from '@capaz/shared';
import type { Cliente } from './tipos.js';

// Consultas de la consola con el rol de plataforma. Solo tablas de la lista de plataforma:
// contratos, planes, solicitudes y la vista de empresas (nombre, alta, miembros). Nada de negocio.

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoObligatoria = (d: Date): string => d.toISOString();

export type EmpresaFila = { id: string; nombre: string; alta_en: Date; miembros: number };

export async function empresaPorId(db: Cliente, id: string): Promise<EmpresaFila | null> {
  const { rows } = await db.query<EmpresaFila>(
    'select empresa_id as id, nombre, alta_en, miembros from core.v_empresas_plataforma where empresa_id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export const empresaNoExiste = (id: string) => rechazo('no_encontrado', `La empresa «${id}» no existe.`);

type ContratoFila = {
  modulo: string;
  estado: 'prueba' | 'activo' | 'suspendido' | 'baja';
  prueba_hasta: Date | null;
  plan: string | null;
  precio: string | null;
  vigente_hasta: Date | null;
  max_usuarios: number | null;
};

export async function contratoDe(db: Cliente, empresa: string, modulo: string): Promise<ContratoFila | null> {
  const { rows } = await db.query<ContratoFila>(
    `select modulo, estado, prueba_hasta, plan, precio_acordado_centimos::text as precio, vigente_hasta, max_usuarios
       from core.empresa_modulos where tenant_id = $1 and modulo = $2`,
    [empresa, modulo],
  );
  return rows[0] ?? null;
}

export function comoContrato(empresa: string, f: ContratoFila) {
  return {
    empresa,
    modulo: f.modulo,
    estado: f.estado,
    pruebaHasta: iso(f.prueba_hasta),
    plan: f.plan,
    precioAcordadoCentimos: f.precio === null ? null : centimosSchema.parse(Number(f.precio)),
    vigenteHasta: iso(f.vigente_hasta),
    maxUsuarios: f.max_usuarios,
  };
}

/** Las funciones de contratación lanzan `P0001` con un mensaje en español hecho para mostrarse. */
export function rechazoDeBase(e: unknown): Respuesta<never> {
  if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P0001') {
    return rechazo('conflicto', (e as { message: string }).message);
  }
  throw e;
}

/** Huella del estado de contratación sobre el que se pide confirmar. */
export const huellaDeContrato = (f: ContratoFila | null) =>
  f ? { estado: f.estado, prueba: iso(f.prueba_hasta), plan: f.plan, precio: f.precio, vigencia: iso(f.vigente_hasta), max: f.max_usuarios } : null;
