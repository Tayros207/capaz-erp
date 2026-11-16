import { randomBytes } from 'node:crypto';
import { exito, rechazo } from '@capaz/shared';
import type { Config } from '../../infra/config/config.js';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { hashCanonico } from '../herramientas/confirmacion.js';
import type { Auth } from '../auth/auth.js';
import { AYUDAS } from './ayudas.js';
import { definirHerramientaDePlataforma, type Cliente, type HerramientaDePlataformaRegistrada } from './tipos.js';

export type DependenciasDeContrasena = { auth: Auth; pool: DatabaseService['auth']; origenes: Config['ORIGENES_PERMITIDOS'] };

const VIGENCIA_EN_SEGUNDOS = 3600;

const MENSAJE_DE_OPERADOR = 'Esa cuenta es de otro operador de la plataforma: no se puede restablecer desde la consola.';

/** Una cuenta de operador (de otra persona) no se toma desde la consola; la propia sí se puede restablecer. */
const esOtroOperador = async (db: Cliente, usuarioId: string, operadorId: string) =>
  usuarioId !== operadorId && ((await db.query('select 1 from core.plataforma_admins where usuario_id = $1', [usuarioId])).rowCount ?? 0) > 0;

/**
 * Cierra el pendiente de la fase 4: genera el enlace de un solo uso del restablecimiento de Better Auth
 * (la ruta de la librería para PEDIRLO sigue cerrada; esta es la única vía) y lo devuelve una vez.
 * Ni el enlace ni el token se guardan en la auditoría ni en el registro.
 */
export function herramientaDeContrasena({ auth, pool, origenes }: DependenciasDeContrasena): HerramientaDePlataformaRegistrada {
  const usuarioPorCorreo = async (correo: string) =>
    (await pool.query<{ id: string }>('select id from auth."user" where lower(email) = $1', [correo])).rows[0]?.id ?? null;

  return definirHerramientaDePlataforma('plataforma_restablecer_contrasena', {
    criticidad: 'critica',
    ayuda: AYUDAS.restablecerContrasena,
    async resumir(a, ctx, db) {
      const id = await usuarioPorCorreo(a.correo);
      if (!id) return rechazo('no_encontrado', `No hay una cuenta con ${a.correo}.`);
      if (await esOtroOperador(db, id, ctx.operadorId)) return rechazo('sin_permiso', MENSAJE_DE_OPERADOR);
      return { ok: true, resumen: { resumen: `Generar un enlace de un solo uso para cambiar la contraseña de ${a.correo}.`, huella: hashCanonico({ id }) } };
    },
    auditar: (a) => ({ resumen: { correo: a.correo } }),
    async ejecutar(a, ctx, db) {
      const id = await usuarioPorCorreo(a.correo);
      if (!id) return rechazo('no_encontrado', `No hay una cuenta con ${a.correo}.`);
      // Se vuelve a comprobar aquí por si la lista cambió entre el resumen y la confirmación.
      if (await esOtroOperador(db, id, ctx.operadorId)) return rechazo('sin_permiso', MENSAJE_DE_OPERADOR);
      const contexto = await auth.$context;
      const token = randomBytes(24).toString('base64url');
      const vence = new Date(Date.now() + VIGENCIA_EN_SEGUNDOS * 1000);
      await contexto.internalAdapter.createVerificationValue({ value: id, identifier: `reset-password:${token}`, expiresAt: vence });
      const destino = encodeURIComponent(`${origenes[0]}/restablecer-contrasena`);
      return exito({ enlace: `${contexto.baseURL}/reset-password/${token}?callbackURL=${destino}`, venceEn: vence.toISOString() });
    },
  });
}
