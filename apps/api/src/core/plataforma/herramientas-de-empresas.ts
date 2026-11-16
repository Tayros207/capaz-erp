import { randomBytes } from 'node:crypto';
import { centimosSchema, exito, rechazo } from '@capaz/shared';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { hashCanonico } from '../herramientas/confirmacion.js';
import type { CatalogoDeModulos } from '../modulos/catalogo.js';
import { planificarAlta } from './alta-guiada.js';
import { AYUDAS } from './ayudas.js';
import { cuentaDe } from './herramientas-de-cuenta.js';
import { empresaNoExiste, empresaPorId, iso, isoObligatoria } from './repositorio.js';
import { definirHerramientaDePlataforma, type HerramientaDePlataformaRegistrada } from './tipos.js';

export type DependenciasDeEmpresas = { auth: DatabaseService['auth']; catalogo: Pick<CatalogoDeModulos, 'porDefecto' | 'porCodigo'> };

const slugDe = (nombre: string) =>
  `${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'empresa'}-${randomBytes(3).toString('hex')}`;

/** La persona dueña, buscada con el rol de autenticación (la plataforma no lee `auth`). */
async function duenoPorCorreo(auth: DatabaseService['auth'], correo: string): Promise<string | null> {
  const { rows } = await auth.query<{ id: string }>('select id from auth."user" where lower(email) = $1', [correo]);
  return rows[0]?.id ?? null;
}

async function crearOrganizacion(auth: DatabaseService['auth'], nombre: string, duenoId: string): Promise<string> {
  const id = randomBytes(16).toString('hex');
  const c = await auth.connect();
  try {
    await c.query('begin');
    await c.query('insert into auth.organization (id, name, slug, created_at) values ($1, $2, $3, now())', [id, nombre, slugDe(nombre)]);
    await c.query(`insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, 'owner', now())`, [randomBytes(16).toString('hex'), id, duenoId]);
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
  return id;
}

type ModuloAplicado = { modulo: string; nombre: string; estado: 'activo' | 'prueba'; pruebaHasta: string | null; porDependencia: boolean };

export function herramientasDeEmpresas({ auth, catalogo }: DependenciasDeEmpresas): HerramientaDePlataformaRegistrada[] {
  const listar = definirHerramientaDePlataforma('plataforma_empresas_listar', {
    criticidad: 'lectura',
    ayuda: AYUDAS.empresasListar,
    async ejecutar(a, _ctx, db) {
      const { rows: empresas } = await db.query<{ id: string; nombre: string; alta_en: Date; miembros: number }>(
        `select empresa_id as id, nombre, alta_en, miembros from core.v_empresas_plataforma
          where $1::text is null or strpos(lower(nombre), lower($1)) > 0
          order by alta_en desc limit 200`,
        [a.texto || null],
      );
      const ids = empresas.map((e) => e.id);
      const { rows: cuentas } = await db.query<{ tenant_id: string; estado: 'activa' | 'prueba' | 'pausada' | 'baja' }>(
        'select tenant_id, estado from core.empresa_cuenta where tenant_id = any($1::text[])',
        [ids],
      );
      const { rows: modulos } = await db.query<{ tenant_id: string; modulo: string; estado: 'prueba' | 'activo' | 'suspendido' | 'baja'; prueba_hasta: Date | null; vigente_hasta: Date | null }>(
        'select tenant_id, modulo, estado, prueba_hasta, vigente_hasta from core.empresa_modulos where tenant_id = any($1::text[]) order by modulo',
        [ids],
      );
      return exito({
        items: empresas.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          altaEn: isoObligatoria(e.alta_en),
          miembros: e.miembros,
          estadoCuenta: cuentas.find((c) => c.tenant_id === e.id)?.estado ?? 'activa',
          modulos: modulos
            .filter((m) => m.tenant_id === e.id)
            .map((m) => ({ modulo: m.modulo, nombre: catalogo.porCodigo(m.modulo)?.nombre ?? m.modulo, estado: m.estado, pruebaHasta: iso(m.prueba_hasta), vigenteHasta: iso(m.vigente_hasta) })),
        })),
      });
    },
    auditar: (a) => ({ resumen: { texto: a.texto ?? null } }),
  });

  const ver = definirHerramientaDePlataforma('plataforma_empresas_ver', {
    criticidad: 'lectura',
    ayuda: AYUDAS.empresaVer,
    async ejecutar(a, _ctx, db) {
      const e = await empresaPorId(db, a.empresa);
      if (!e) return empresaNoExiste(a.empresa);
      const { rows: modulos } = await db.query<{
        modulo: string; nombre: string; estado: 'prueba' | 'activo' | 'suspendido' | 'baja'; alta_en: Date; prueba_hasta: Date | null; baja_en: Date | null;
        motivo: string | null; plan: string | null; precio: string | null; vigente_hasta: Date | null; max_usuarios: number | null;
      }>(
        `select m.modulo, c.nombre, m.estado, m.alta_en, m.prueba_hasta, m.baja_en, m.motivo, m.plan,
                m.precio_acordado_centimos::text as precio, m.vigente_hasta, m.max_usuarios
           from core.empresa_modulos m join core.modulos c on c.codigo = m.modulo
          where m.tenant_id = $1 order by m.modulo`,
        [a.empresa],
      );
      const { rows: historial } = await db.query<{
        modulo: string; evento: string; estado_anterior: string | null; estado_nuevo: string; motivo: string | null; actor: string | null; creado_en: Date;
      }>(
        `select modulo, evento, estado_anterior, estado_nuevo, motivo, actor, creado_en from core.empresa_modulos_eventos
          where tenant_id = $1 order by creado_en desc, id desc limit 50`,
        [a.empresa],
      );
      const cuenta = await cuentaDe(db, a.empresa);
      const { rows: eventosCuenta } = await db.query<{
        evento: string; estado_anterior: string | null; estado_nuevo: string; motivo: string | null; actor: string | null; creado_en: Date;
      }>(
        `select evento, estado_anterior, estado_nuevo, motivo, actor, creado_en from core.empresa_cuenta_eventos
          where tenant_id = $1 order by creado_en desc, id desc limit 50`,
        [a.empresa],
      );
      // Solo la fecha de lo último que hizo (columnas permitidas a la plataforma): nunca qué hizo.
      const { rows: [actividad] } = await db.query<{ ultima: Date | null }>('select max(creado_en) as ultima from core.auditoria where tenant_id = $1', [a.empresa]);
      return exito({
        id: e.id,
        nombre: e.nombre,
        altaEn: isoObligatoria(e.alta_en),
        miembros: e.miembros,
        ultimaActividadEn: iso(actividad?.ultima),
        estadoCuenta: cuenta?.estado ?? 'activa',
        motivoCuenta: cuenta?.motivo ?? null,
        eventosDeCuenta: eventosCuenta.map((h) => ({
          evento: h.evento, estadoAnterior: h.estado_anterior, estadoNuevo: h.estado_nuevo, motivo: h.motivo, actor: h.actor, creadoEn: isoObligatoria(h.creado_en),
        })),
        modulos: modulos.map((m) => ({
          modulo: m.modulo, nombre: m.nombre, estado: m.estado, altaEn: isoObligatoria(m.alta_en), pruebaHasta: iso(m.prueba_hasta), bajaEn: iso(m.baja_en),
          motivo: m.motivo, plan: m.plan, precioAcordadoCentimos: m.precio === null ? null : centimosSchema.parse(Number(m.precio)), vigenteHasta: iso(m.vigente_hasta), maxUsuarios: m.max_usuarios,
        })),
        historial: historial.map((h) => ({
          modulo: h.modulo, evento: h.evento, estadoAnterior: h.estado_anterior, estadoNuevo: h.estado_nuevo, motivo: h.motivo, actor: h.actor, creadoEn: isoObligatoria(h.creado_en),
        })),
      });
    },
    auditar: (a) => ({ empresaId: a.empresa }),
  });

  const crear = definirHerramientaDePlataforma('plataforma_empresas_crear', {
    criticidad: 'critica',
    ayuda: AYUDAS.empresaCrear,
    async resumir(a, _ctx, db) {
      const dueno = await duenoPorCorreo(auth, a.correoDelDueno);
      if (!dueno) return rechazo('no_encontrado', `No hay una persona registrada con ${a.correoDelDueno}: debe registrarse primero.`);
      const alta = await planificarAlta(db, catalogo, a);
      if ('rechazo' in alta) return alta.rechazo;
      const lista = alta.modulos.map((m) => `${catalogo.porCodigo(m.codigo)?.nombre ?? m.codigo}${m.pruebaDias ? ` (prueba ${m.pruebaDias} días)` : ''}`).join(', ');
      const plan = alta.plan ? ` con el plan «${alta.plan}»` : '';
      return {
        ok: true,
        resumen: { resumen: `Crear la empresa «${a.nombre}»${plan} con ${a.correoDelDueno} como dueña. Módulos: ${lista || 'ninguno'}.`, huella: hashCanonico({ dueno, nombre: a.nombre, alta: alta }) },
      };
    },
    auditar: (a, d) => ({
      empresaId: d?.id ?? null,
      resumen: { nombre: a.nombre, plan: d?.plan ?? a.plan ?? null, modulos: d ? d.modulosActivados.join(',') : null, estadoCuenta: d?.estadoCuenta ?? null },
    }),
    async ejecutar(a, ctx, db) {
      const dueno = await duenoPorCorreo(auth, a.correoDelDueno);
      if (!dueno) return rechazo('no_encontrado', `No hay una persona registrada con ${a.correoDelDueno}: debe registrarse primero.`);
      // Todo lo que puede fallar por catálogo o plan se valida antes de crear nada.
      const alta = await planificarAlta(db, catalogo, a);
      if ('rechazo' in alta) return alta.rechazo;
      // La creación (autenticación) y los módulos (plataforma) usan conexiones distintas y no son atómicas;
      // si lo segundo falla, el primer acceso de la empresa completa los módulos por defecto.
      const id = await crearOrganizacion(auth, a.nombre, dueno);
      const actor = `plataforma:${ctx.operadorId}`;
      await db.query('select core.reactivar_cuenta($1, $2, $3)', [id, 'Alta de la empresa', actor]);
      const modulos: ModuloAplicado[] = [];
      for (const m of alta.modulos) {
        await db.query('select core.activar_modulo($1, $2, $3, $4)', [id, m.codigo, m.pruebaDias, actor]);
        if (alta.plan) await db.query('update core.empresa_modulos set plan = $3 where tenant_id = $1 and modulo = $2', [id, m.codigo, alta.plan]);
        modulos.push({
          modulo: m.codigo,
          nombre: catalogo.porCodigo(m.codigo)?.nombre ?? m.codigo,
          estado: m.pruebaDias ? ('prueba' as const) : ('activo' as const),
          pruebaHasta: null,
          porDependencia: m.porDependencia,
        });
      }
      const { rows } = await db.query<{ modulo: string; prueba_hasta: Date | null }>('select modulo, prueba_hasta from core.empresa_modulos where tenant_id = $1', [id]);
      for (const m of modulos) m.pruebaHasta = iso(rows.find((r) => r.modulo === m.modulo)?.prueba_hasta);
      return exito({ id, nombre: a.nombre, modulosActivados: modulos.map((m) => m.modulo), plan: alta.plan, estadoCuenta: 'activa' as const, modulos });
    },
  });

  return [listar, ver, crear];
}
