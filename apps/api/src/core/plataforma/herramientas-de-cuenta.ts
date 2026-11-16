import { exito, rechazo } from '@capaz/shared';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { hashCanonico } from '../herramientas/confirmacion.js';
import { AYUDAS } from './ayudas.js';
import { empresaNoExiste, empresaPorId, isoObligatoria, rechazoDeBase } from './repositorio.js';
import {
  definirHerramientaDePlataforma,
  type Cliente,
  type ContextoDePlataforma,
  type HerramientaDePlataformaRegistrada,
  type ResultadoDeResumenDePlataforma,
} from './tipos.js';

// Estado de cuenta de la empresa entera (ficha FICHA-ESTADO-DE-CUENTA §4). Las tres herramientas llaman
// a las funciones `core.*_cuenta` (sin security definer) con el actor `plataforma:<operador>`.

type Estado = 'activa' | 'prueba' | 'pausada' | 'baja';
type Destino = { empresa: string; motivo?: string | undefined };

const actorDe = (ctx: ContextoDePlataforma) => `plataforma:${ctx.operadorId}`;

export async function cuentaDe(db: Cliente, empresa: string) {
  const { rows } = await db.query<{ estado: Estado; motivo: string | null; cambiado_en: Date }>(
    'select estado, motivo, cambiado_en from core.empresa_cuenta where tenant_id = $1',
    [empresa],
  );
  return rows[0] ?? null;
}

/** Regla 7: una cuenta con un operador de plataforma entre sus miembros no se pausa ni se da de baja. */
async function esCuentaDeLaPlataforma(auth: DatabaseService['auth'], db: Cliente, empresa: string): Promise<boolean> {
  const { rows } = await auth.query<{ user_id: string }>('select user_id from auth.member where organization_id = $1', [empresa]);
  if (!rows.length) return false;
  const { rowCount } = await db.query('select 1 from core.plataforma_admins where usuario_id = any($1::text[])', [rows.map((r) => r.user_id)]);
  return (rowCount ?? 0) > 0;
}

const AVISO_DE_PLATAFORMA = 'Esta cuenta es de la plataforma y no se puede pausar.';

export function herramientasDeCuenta(auth: DatabaseService['auth']): HerramientaDePlataformaRegistrada[] {
  async function resumir(db: Cliente, a: Destino, protegida: boolean, texto: (n: string) => string): Promise<ResultadoDeResumenDePlataforma> {
    const e = await empresaPorId(db, a.empresa);
    if (!e) return empresaNoExiste(a.empresa);
    if (protegida && (await esCuentaDeLaPlataforma(auth, db, a.empresa))) return rechazo('conflicto', AVISO_DE_PLATAFORMA);
    const c = await cuentaDe(db, a.empresa);
    return { ok: true, resumen: { resumen: texto(e.nombre), huella: hashCanonico({ estado: c?.estado ?? 'activa', motivo: c?.motivo ?? null }) } };
  }

  async function cambiar(db: Cliente, a: Destino, protegida: boolean, sql: string, valores: unknown[]) {
    if (!(await empresaPorId(db, a.empresa))) return empresaNoExiste(a.empresa);
    if (protegida && (await esCuentaDeLaPlataforma(auth, db, a.empresa))) return rechazo('conflicto', AVISO_DE_PLATAFORMA);
    try {
      await db.query(sql, valores);
    } catch (e) {
      return rechazoDeBase(e);
    }
    const c = await cuentaDe(db, a.empresa);
    return c
      ? exito({ empresa: a.empresa, estadoCuenta: c.estado, motivoCuenta: c.motivo, cambiadoEn: isoObligatoria(c.cambiado_en) })
      : rechazo('no_encontrado', 'La cuenta no quedó registrada.');
  }

  const auditar = (a: Destino, d: { estadoCuenta: string } | null) => ({
    empresaId: a.empresa,
    resumen: { motivo: a.motivo ?? null, estadoCuenta: d?.estadoCuenta ?? null },
  });

  const pausar = definirHerramientaDePlataforma('plataforma_cuenta_pausar', {
    criticidad: 'critica',
    ayuda: AYUDAS.cuentaPausar,
    resumir: (a, _ctx, db) => resumir(db, a, true, (n) => `Pausar la cuenta de «${n}»: verá todo pero no podrá escribir en ningún módulo.`),
    auditar,
    ejecutar: (a, ctx, db) => cambiar(db, a, true, 'select core.pausar_cuenta($1, $2, $3)', [a.empresa, a.motivo, actorDe(ctx)]),
  });

  const darDeBaja = definirHerramientaDePlataforma('plataforma_cuenta_dar_de_baja', {
    criticidad: 'critica',
    ayuda: AYUDAS.cuentaDarDeBaja,
    resumir: (a, _ctx, db) =>
      resumir(db, a, true, (n) => `Dar de baja la cuenta de «${n}»: queda en solo lectura y se marca que la relación terminó. No se borra ningún dato.`),
    auditar,
    ejecutar: (a, ctx, db) => cambiar(db, a, true, 'select core.dar_baja_cuenta($1, $2, $3)', [a.empresa, a.motivo, actorDe(ctx)]),
  });

  const reactivar = definirHerramientaDePlataforma('plataforma_cuenta_reactivar', {
    criticidad: 'critica',
    ayuda: AYUDAS.cuentaReactivar,
    resumir: (a, _ctx, db) => resumir(db, a, false, (n) => `Reactivar la cuenta de «${n}»: vuelve a escribir, con sus módulos como estaban.`),
    auditar,
    ejecutar: (a, ctx, db) => cambiar(db, a, false, 'select core.reactivar_cuenta($1, $2, $3)', [a.empresa, a.motivo ?? null, actorDe(ctx)]),
  });

  return [pausar, darDeBaja, reactivar];
}
