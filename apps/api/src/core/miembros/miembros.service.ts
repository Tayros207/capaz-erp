import { Inject, Injectable } from '@nestjs/common';
import { rechazo, exito, type Codigo, type Respuesta } from '@capaz/shared';
import { AUTH, type Auth } from '../auth/auth.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { cabecerasDeLaPeticion } from './cabeceras.js';

export type FilaDeInvitacion = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  organizationId: string;
};

export type FilaDeMiembro = { id: string; userId: string; role: string };

const MENSAJES_DE_AUTH: Record<string, string> = {
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: 'Esa persona ya es miembro de la empresa.',
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: 'Esa persona ya tiene una invitación pendiente.',
  INVITATION_LIMIT_REACHED: 'Hay demasiadas invitaciones pendientes.',
  INVITATION_NOT_FOUND: 'No existe esa invitación.',
  MEMBER_NOT_FOUND: 'No existe esa persona en la empresa.',
};

/** Convierte un error de Better Auth en un rechazo del catálogo, sin filtrar su texto en inglés. */
function comoRechazo(e: unknown): Respuesta<never> {
  const x = e as { statusCode?: number; status?: string; body?: { code?: string } };
  if (typeof x?.statusCode !== 'number') throw e;
  const codigo = x.body?.code ?? '';
  const mensaje = MENSAJES_DE_AUTH[codigo];
  const c: Codigo = x.statusCode === 403 || x.statusCode === 401 ? 'sin_permiso' : x.statusCode === 404 ? 'no_encontrado' : mensaje ? 'conflicto' : 'solicitud_invalida';
  return rechazo(c, mensaje ?? 'No se pudo completar la operación.');
}

const SIN_PETICION = 'Esta operación solo se hace desde una petición de una persona con sesión.';

/**
 * Operaciones de Better Auth (plugin de organización) por su API de servidor: sus rutas públicas
 * están cerradas (lista blanca) y por aquí pasan con la sesión de quien actúa. Las lecturas de
 * `auth.*` van por `capaz_auth` y siempre filtradas por la empresa de la sesión.
 */
@Injectable()
export class ServicioDeMiembros {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  async invitar(empresaId: string, correo: string, rol: 'admin' | 'member'): Promise<Respuesta<{ id: string; expiresAt: Date; createdAt: Date }>> {
    const headers = cabecerasDeLaPeticion();
    if (!headers) return rechazo('sin_permiso', SIN_PETICION);
    try {
      const r = await this.auth.api.createInvitation({ headers, body: { email: correo, role: rol, organizationId: empresaId } });
      return exito({ id: r.id, expiresAt: new Date(r.expiresAt), createdAt: new Date(r.createdAt) });
    } catch (e) {
      return comoRechazo(e);
    }
  }

  async anular(invitacionId: string): Promise<Respuesta<true>> {
    const headers = cabecerasDeLaPeticion();
    if (!headers) return rechazo('sin_permiso', SIN_PETICION);
    try {
      await this.auth.api.cancelInvitation({ headers, body: { invitationId: invitacionId } });
      return exito(true as const);
    } catch (e) {
      return comoRechazo(e);
    }
  }

  async cambiarRol(empresaId: string, miembroId: string, rol: string): Promise<Respuesta<true>> {
    const headers = cabecerasDeLaPeticion();
    if (!headers) return rechazo('sin_permiso', SIN_PETICION);
    try {
      await this.auth.api.updateMemberRole({ headers, body: { memberId: miembroId, role: rol, organizationId: empresaId } });
      return exito(true as const);
    } catch (e) {
      return comoRechazo(e);
    }
  }

  async quitar(empresaId: string, miembroId: string): Promise<Respuesta<true>> {
    const headers = cabecerasDeLaPeticion();
    if (!headers) return rechazo('sin_permiso', SIN_PETICION);
    try {
      await this.auth.api.removeMember({ headers, body: { memberIdOrEmail: miembroId, organizationId: empresaId } });
      return exito(true as const);
    } catch (e) {
      return comoRechazo(e);
    }
  }

  // --- lecturas de `auth.*` con `capaz_auth`, siempre acotadas a la empresa de la sesión ---

  async miembroDe(empresaId: string, usuarioId: string): Promise<FilaDeMiembro | null> {
    const { rows } = await this.db.auth.query<{ id: string; user_id: string; role: string }>(
      'select id, user_id, role from auth.member where organization_id = $1 and user_id = $2',
      [empresaId, usuarioId],
    );
    const f = rows[0];
    return f ? { id: f.id, userId: f.user_id, role: f.role } : null;
  }

  async propietarios(empresaId: string): Promise<number> {
    const { rows } = await this.db.auth.query<{ n: string }>(
      "select count(*)::text as n from auth.member where organization_id = $1 and role = 'owner'",
      [empresaId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async correoYaEsMiembro(empresaId: string, correo: string): Promise<boolean> {
    const { rows } = await this.db.auth.query(
      'select 1 from auth.member m join auth."user" u on u.id = m.user_id where m.organization_id = $1 and lower(u.email) = $2',
      [empresaId, correo.toLowerCase()],
    );
    return rows.length > 0;
  }

  async invitaciones(empresaId: string, soloPendientes: boolean): Promise<FilaDeInvitacion[]> {
    const { rows } = await this.db.auth.query<{
      id: string; email: string; role: string | null; status: string; expires_at: Date; created_at: Date; organization_id: string;
    }>(
      `select id, email, role, status, expires_at, created_at, organization_id from auth.invitation
        where organization_id = $1 ${soloPendientes ? "and status = 'pending'" : ''} order by created_at desc`,
      [empresaId],
    );
    return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, status: r.status, expiresAt: r.expires_at, createdAt: r.created_at, organizationId: r.organization_id }));
  }

  async invitacion(invitacionId: string): Promise<FilaDeInvitacion | null> {
    const { rows } = await this.db.auth.query<{
      id: string; email: string; role: string | null; status: string; expires_at: Date; created_at: Date; organization_id: string;
    }>('select id, email, role, status, expires_at, created_at, organization_id from auth.invitation where id = $1', [invitacionId]);
    const r = rows[0];
    return r ? { id: r.id, email: r.email, role: r.role, status: r.status, expiresAt: r.expires_at, createdAt: r.created_at, organizationId: r.organization_id } : null;
  }
}
