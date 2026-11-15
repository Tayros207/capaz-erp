import { exito, rechazo } from '@capaz/shared';
import { hashCanonico } from '../herramientas/confirmacion.js';
import { AYUDAS } from './ayudas.js';
import { comoContrato, contratoDe, empresaNoExiste, empresaPorId, huellaDeContrato, rechazoDeBase } from './repositorio.js';
import {
  definirHerramientaDePlataforma,
  type AuditoriaDePlataforma,
  type Cliente,
  type ContextoDePlataforma,
  type HerramientaDePlataformaRegistrada,
  type ResultadoDeResumenDePlataforma,
} from './tipos.js';

type Destino = { empresa: string; modulo: string; motivo?: string | undefined };

const actorDe = (ctx: ContextoDePlataforma) => `plataforma:${ctx.operadorId}`;

async function resumirCambio(db: Cliente, a: Destino, texto: (empresa: string) => string): Promise<ResultadoDeResumenDePlataforma> {
  const e = await empresaPorId(db, a.empresa);
  if (!e) return empresaNoExiste(a.empresa);
  const c = await contratoDe(db, a.empresa, a.modulo);
  return { ok: true, resumen: { resumen: texto(e.nombre), huella: hashCanonico(huellaDeContrato(c)) } };
}

const auditarCambio = (a: Destino, datos: { estado: string } | null): AuditoriaDePlataforma => ({
  empresaId: a.empresa,
  resumen: { modulo: a.modulo, motivo: a.motivo ?? null, estado: datos?.estado ?? null },
});

/** Llama a la función de contratación de la base y devuelve cómo quedó el módulo. */
async function cambiar(db: Cliente, a: Destino, sql: string, valores: unknown[]) {
  if (!(await empresaPorId(db, a.empresa))) return empresaNoExiste(a.empresa);
  try {
    await db.query(sql, valores);
  } catch (e) {
    return rechazoDeBase(e);
  }
  const c = await contratoDe(db, a.empresa, a.modulo);
  return c ? exito(comoContrato(a.empresa, c)) : rechazo('no_encontrado', 'El módulo no quedó contratado.');
}

export function herramientasDeModulos(): HerramientaDePlataformaRegistrada[] {
  const activar = definirHerramientaDePlataforma('plataforma_modulo_activar', {
    criticidad: 'critica',
    ayuda: AYUDAS.moduloActivar,
    resumir: (a, _ctx, db) =>
      resumirCambio(db, a, (n) => `Dar a «${n}» el módulo «${a.modulo}»${a.pruebaDias ? ` en prueba por ${a.pruebaDias} días` : ' activo'}.`),
    auditar: (a, d) => ({ ...auditarCambio(a, d), resumen: { ...auditarCambio(a, d).resumen, pruebaDias: a.pruebaDias ?? null } }),
    ejecutar: (a, ctx, db) => cambiar(db, a, 'select core.activar_modulo($1, $2, $3, $4)', [a.empresa, a.modulo, a.pruebaDias ?? null, actorDe(ctx)]),
  });

  const suspender = definirHerramientaDePlataforma('plataforma_modulo_suspender', {
    criticidad: 'critica',
    ayuda: AYUDAS.moduloSuspender,
    resumir: (a, _ctx, db) => resumirCambio(db, a, (n) => `Suspender el módulo «${a.modulo}» de «${n}»: lo verá pero no podrá escribir.`),
    auditar: auditarCambio,
    ejecutar: (a, ctx, db) => cambiar(db, a, 'select core.suspender_modulo($1, $2, $3, $4)', [a.empresa, a.modulo, a.motivo ?? null, actorDe(ctx)]),
  });

  const darDeBaja = definirHerramientaDePlataforma('plataforma_modulo_dar_de_baja', {
    criticidad: 'critica',
    ayuda: AYUDAS.moduloDarDeBaja,
    resumir: (a, _ctx, db) => resumirCambio(db, a, (n) => `Dar de baja el módulo «${a.modulo}» de «${n}»: queda en solo lectura (los datos no se borran).`),
    auditar: auditarCambio,
    ejecutar: (a, ctx, db) => cambiar(db, a, 'select core.dar_baja_modulo($1, $2, $3, $4)', [a.empresa, a.modulo, a.motivo ?? null, actorDe(ctx)]),
  });

  const reactivar = definirHerramientaDePlataforma('plataforma_modulo_reactivar', {
    criticidad: 'critica',
    ayuda: AYUDAS.moduloReactivar,
    resumir: (a, _ctx, db) => resumirCambio(db, a, (n) => `Reactivar el módulo «${a.modulo}» de «${n}».`),
    auditar: auditarCambio,
    ejecutar: (a, ctx, db) => cambiar(db, a, 'select core.reactivar_modulo($1, $2, $3)', [a.empresa, a.modulo, actorDe(ctx)]),
  });

  const fijar = definirHerramientaDePlataforma('plataforma_contrato_fijar', {
    criticidad: 'critica',
    ayuda: AYUDAS.contratoFijar,
    resumir: (a, _ctx, db) => resumirCambio(db, a, (n) => `Cambiar las condiciones del módulo «${a.modulo}» de «${n}».`),
    auditar: (a) => ({
      empresaId: a.empresa,
      resumen: {
        modulo: a.modulo,
        plan: a.plan ?? null,
        precioAcordadoCentimos: a.precioAcordadoCentimos ?? null,
        vigenteHasta: a.vigenteHasta ?? null,
        maxUsuarios: a.maxUsuarios ?? null,
      },
    }),
    async ejecutar(a, _ctx, db) {
      if (!(await empresaPorId(db, a.empresa))) return empresaNoExiste(a.empresa);
      if (!(await contratoDe(db, a.empresa, a.modulo))) return rechazo('no_encontrado', 'La empresa no tiene ese módulo contratado.');
      if (a.plan) {
        const { rowCount } = await db.query('select 1 from core.planes where codigo = $1', [a.plan]);
        if (!rowCount) return rechazo('argumentos_invalidos', `El plan «${a.plan}» no existe.`);
      }
      // Solo se tocan las columnas que llegaron (`null` borra, `undefined` deja igual). Los nombres son fijos.
      const columnas = { plan: a.plan, precio_acordado_centimos: a.precioAcordadoCentimos, vigente_hasta: a.vigenteHasta, max_usuarios: a.maxUsuarios };
      const cambios = Object.entries(columnas).filter(([, v]) => v !== undefined);
      const asignaciones = cambios.map(([k], i) => `${k} = $${i + 3}`).join(', ');
      await db.query(`update core.empresa_modulos set ${asignaciones} where tenant_id = $1 and modulo = $2`, [a.empresa, a.modulo, ...cambios.map(([, v]) => v)]);
      const c = await contratoDe(db, a.empresa, a.modulo);
      return c ? exito(comoContrato(a.empresa, c)) : rechazo('no_encontrado', 'El módulo no quedó contratado.');
    },
  });

  return [activar, suspender, darDeBaja, reactivar, fijar];
}
