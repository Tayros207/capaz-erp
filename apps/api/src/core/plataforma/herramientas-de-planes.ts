import { centimosSchema, exito, rechazo } from '@capaz/shared';
import { hashCanonico } from '../herramientas/confirmacion.js';
import { AYUDAS } from './ayudas.js';
import { iso, isoObligatoria } from './repositorio.js';
import { definirHerramientaDePlataforma, type Cliente, type HerramientaDePlataformaRegistrada } from './tipos.js';

type PlanFila = { codigo: string; nombre: string; descripcion: string | null; precio: string; usuarios: number | null; activo: boolean; modulos: string[] };

async function planes(db: Cliente, codigo: string | null): Promise<PlanFila[]> {
  const { rows } = await db.query<PlanFila>(
    `select p.codigo, p.nombre, p.descripcion, p.precio_centimos::text as precio, p.usuarios_incluidos as usuarios, p.activo,
            coalesce((select array_agg(pm.modulo order by pm.modulo) from core.plan_modulos pm where pm.plan = p.codigo), '{}') as modulos
       from core.planes p where $1::text is null or p.codigo = $1 order by p.codigo`,
    [codigo],
  );
  return rows;
}

const comoPlan = (p: PlanFila) => ({
  codigo: p.codigo,
  nombre: p.nombre,
  descripcion: p.descripcion,
  precioCentimos: centimosSchema.parse(Number(p.precio)),
  usuariosIncluidos: p.usuarios,
  activo: p.activo,
  modulos: p.modulos,
});

export function herramientasDePlanes(): HerramientaDePlataformaRegistrada[] {
  const listar = definirHerramientaDePlataforma('plataforma_planes_listar', {
    criticidad: 'lectura',
    ayuda: AYUDAS.planesListar,
    ejecutar: async (_a, _ctx, db) => exito({ items: (await planes(db, null)).map(comoPlan) }),
  });

  const guardar = definirHerramientaDePlataforma('plataforma_planes_guardar', {
    criticidad: 'critica',
    ayuda: AYUDAS.planesGuardar,
    async resumir(a, _ctx, db) {
      const [actual] = await planes(db, a.codigo);
      const texto = actual ? `Cambiar el plan «${a.codigo}»` : `Crear el plan «${a.codigo}»`;
      return { ok: true, resumen: { resumen: `${texto}: ${a.modulos.length} módulos a ${a.precioCentimos} céntimos al mes.`, huella: hashCanonico(actual ?? null) } };
    },
    auditar: (a) => ({ resumen: { plan: a.codigo, precioCentimos: a.precioCentimos, modulos: a.modulos.join(',') } }),
    async ejecutar(a, _ctx, db) {
      const unicos = [...new Set(a.modulos)];
      const { rows: validos } = await db.query<{ codigo: string }>('select codigo from core.modulos where codigo = any($1::text[])', [unicos]);
      const desconocido = unicos.find((m) => !validos.some((v) => v.codigo === m));
      if (desconocido) return rechazo('argumentos_invalidos', `El módulo «${desconocido}» no existe.`);
      await db.query(
        `insert into core.planes (codigo, nombre, descripcion, precio_centimos, usuarios_incluidos, activo)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion,
           precio_centimos = excluded.precio_centimos, usuarios_incluidos = excluded.usuarios_incluidos, activo = excluded.activo`,
        [a.codigo, a.nombre, a.descripcion ?? null, a.precioCentimos, a.usuariosIncluidos ?? null, a.activo],
      );
      await db.query('delete from core.plan_modulos where plan = $1', [a.codigo]);
      if (unicos.length) await db.query('insert into core.plan_modulos (plan, modulo) select $1, unnest($2::text[])', [a.codigo, unicos]);
      const [plan] = await planes(db, a.codigo);
      return plan ? exito(comoPlan(plan)) : rechazo('error_interno', 'El plan no quedó guardado.');
    },
  });

  return [listar, guardar];
}

type SolicitudFila = {
  id: string; tenant_id: string; nombre: string | null; modulo: string; usuario_id: string; nota: string | null;
  estado: 'pendiente' | 'atendida' | 'descartada'; creado_en: Date; atendido_en: Date | null;
};

async function solicitudes(db: Cliente, estado: string, id: string | null): Promise<SolicitudFila[]> {
  const { rows } = await db.query<SolicitudFila>(
    `select s.id, s.tenant_id, v.nombre, s.modulo, s.usuario_id, s.nota, s.estado, s.creado_en, s.atendido_en
       from core.solicitudes_modulo s left join core.v_empresas_plataforma v on v.empresa_id = s.tenant_id
      where ($1 = 'todas' or s.estado = $1) and ($2::uuid is null or s.id = $2)
      order by s.creado_en desc limit 200`,
    [estado, id],
  );
  return rows;
}

const comoSolicitud = (s: SolicitudFila) => ({
  id: s.id, empresa: s.tenant_id, empresaNombre: s.nombre, modulo: s.modulo, usuarioId: s.usuario_id, nota: s.nota,
  estado: s.estado, creadoEn: isoObligatoria(s.creado_en), atendidoEn: iso(s.atendido_en),
});

export function herramientasDeSolicitudes(): HerramientaDePlataformaRegistrada[] {
  const listar = definirHerramientaDePlataforma('plataforma_solicitudes_listar', {
    criticidad: 'lectura',
    ayuda: AYUDAS.solicitudesListar,
    ejecutar: async (a, _ctx, db) => exito({ items: (await solicitudes(db, a.estado, null)).map(comoSolicitud) }),
    auditar: (a) => ({ resumen: { estado: a.estado } }),
  });

  const atender = definirHerramientaDePlataforma('plataforma_solicitud_atender', {
    criticidad: 'critica',
    ayuda: AYUDAS.solicitudAtender,
    async resumir(a, _ctx, db) {
      const [s] = await solicitudes(db, 'todas', a.id);
      if (!s) return rechazo('no_encontrado', 'No existe esa solicitud.');
      return { ok: true, resumen: { resumen: `Marcar como ${a.resultado} la solicitud de «${s.modulo}» de ${s.nombre ?? s.tenant_id}.`, huella: hashCanonico({ estado: s.estado }) } };
    },
    auditar: (a, d) => ({ empresaId: d?.empresa ?? null, resumen: { solicitud: a.id, resultado: a.resultado } }),
    async ejecutar(a, _ctx, db) {
      const { rowCount } = await db.query(`update core.solicitudes_modulo set estado = $2, atendido_en = now() where id = $1 and estado = 'pendiente'`, [a.id, a.resultado]);
      if (!rowCount) return rechazo('conflicto', 'Esa solicitud ya se resolvió o no existe.');
      const [s] = await solicitudes(db, 'todas', a.id);
      return s ? exito(comoSolicitud(s)) : rechazo('no_encontrado', 'No existe esa solicitud.');
    },
  });

  return [listar, atender];
}
