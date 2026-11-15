import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ARGUMENTOS_DE_CONTEXTO, rechazo, type Codigo, type Respuesta } from '@capaz/shared';
import type { Logger } from 'pino';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { MENSAJES } from '../../infra/http/error-de-negocio.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { crearToken, hashCanonico, TTL_CONFIRMACION_SEGUNDOS, verificarToken, type CargaDeToken } from '../herramientas/confirmacion.js';
import { mensajeDeZod, OPCIONES_EN_ESPANOL } from '../herramientas/errores-de-zod.js';
import { RegistroDePlataforma } from './registro-de-plataforma.js';
import type { AuditoriaDePlataforma, Cliente, ContextoDePlataforma, HerramientaDePlataformaRegistrada } from './tipos.js';

export type OpcionesDePlataforma = { ctx: ContextoDePlataforma; confirmacion?: string };

type Fallo = { respuesta: Respuesta<unknown>; codigo: string };
type Previo = { fallo: Fallo; h?: undefined; datos?: undefined; hash?: undefined } | { fallo?: undefined; h: HerramientaDePlataformaRegistrada; datos: unknown; hash: string };

/** Sale de la transacción para revertirla entera; la auditoría del fallo va aparte. */
class Revertir extends Error {
  constructor(readonly fallo: Fallo) {
    super('revertir');
  }
}

const falloDe = (codigo: Codigo, mensaje: string = MENSAJES[codigo]): Fallo => ({ respuesta: rechazo(codigo, mensaje), codigo });
const rechazar = (codigo: Codigo, mensaje?: string): Revertir => new Revertir(falloDe(codigo, mensaje));
const segundos = (d: Date) => Math.floor(d.getTime() / 1000);
/** Las confirmaciones de plataforma no son de ninguna empresa. */
const AMBITO = 'plataforma';

const comoObjeto = (v: unknown): Record<string, unknown> | null =>
  v === undefined ? {} : v === null || typeof v !== 'object' || Array.isArray(v) ? null : (v as Record<string, unknown>);

/**
 * Única puerta de las operaciones de plataforma. Orden: existe → argumentos reservados → esquema de
 * entrada → confirmación (si es crítica) → ejecución en UNA transacción del grupo `sistema` → esquema
 * de salida → auditoría en `core.auditoria_plataforma`. Un rechazo revierte todo y se audita aparte.
 * La persona operadora la pone el guardia; aquí no se vuelve a decidir quién puede.
 */
@Injectable()
export class EjecutorDePlataforma {
  reloj: () => Date = () => new Date();
  nuevoJti: () => string = () => randomUUID();

  constructor(
    @Inject(RegistroDePlataforma) private readonly registro: RegistroDePlataforma,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CONFIG) private readonly config: Pick<Config, 'CONFIRMACION_SECRET'>,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async ejecutar(nombre: string, args: unknown, { ctx, confirmacion }: OpcionesDePlataforma): Promise<Respuesta<unknown>> {
    const h = this.registro.obtener(nombre) ?? null;
    const previo = this.comprobar(h, nombre, args);
    if (previo.fallo) {
      await this.auditarAparte(nombre, null, previo.fallo.codigo, ctx, {});
      return previo.fallo.respuesta;
    }
    const cliente = await this.db.sistema.connect();
    try {
      await cliente.query('begin');
      // El actor queda en el historial de contratación (lo lee el disparador de `empresa_modulos`).
      await cliente.query(`select set_config('app.actor', $1, true)`, [`plataforma:${ctx.operadorId}`]);
      const respuesta = await this.correr(cliente, previo.h, previo.datos, previo.hash, ctx, confirmacion);
      await cliente.query('commit');
      return respuesta;
    } catch (e) {
      await cliente.query('rollback').catch(() => undefined);
      const fallo = this.comoFallo(e, nombre, ctx);
      await this.auditarAparte(nombre, previo.h, fallo.codigo, ctx, previo.datos);
      return fallo.respuesta;
    } finally {
      cliente.release();
    }
  }

  private comprobar(h: HerramientaDePlataformaRegistrada | null, nombre: string, crudos: unknown): Previo {
    if (!h) return { fallo: falloDe('herramienta_desconocida', `No existe la herramienta «${nombre}».`) };
    const bruto = comoObjeto(crudos);
    if (!bruto) return { fallo: falloDe('argumentos_invalidos', 'Los argumentos deben ser un objeto.') };
    const prohibido = ARGUMENTOS_DE_CONTEXTO.find((k) => k in bruto);
    if (prohibido) return { fallo: falloDe('argumento_prohibido', `«${prohibido}» no es un argumento: la persona y los permisos los pone el sistema.`) };
    const parseo = h.entrada.safeParse(bruto, OPCIONES_EN_ESPANOL);
    if (!parseo.success) return { fallo: falloDe('argumentos_invalidos', mensajeDeZod(parseo.error)) };
    return { h, datos: parseo.data as unknown, hash: hashCanonico(parseo.data) };
  }

  private async correr(
    db: Cliente,
    h: HerramientaDePlataformaRegistrada,
    datos: unknown,
    hash: string,
    ctx: ContextoDePlataforma,
    confirmacion: string | undefined,
  ): Promise<Respuesta<unknown>> {
    const inicio = performance.now();
    const jti = h.criticidad === 'critica' ? await this.confirmar(db, h, datos, hash, ctx, confirmacion) : null;
    const r = await h.ejecutar(datos, ctx, db);
    if (!r.ok) {
      if ('error' in r) throw new Revertir({ respuesta: r, codigo: r.error.codigo });
      throw rechazar('error_interno', 'Una herramienta no puede pedir confirmación por su cuenta.');
    }
    const salida = h.salida.safeParse(r.datos, OPCIONES_EN_ESPANOL);
    if (!salida.success) throw rechazar('error_interno', `La salida de «${h.nombre}» no cumple su esquema.`);
    const respuesta = { ...r, datos: salida.data };
    const extra = h.auditar?.(datos, salida.data) ?? {};
    await this.escribirAuditoria(db, h.nombre, 'ok', null, ctx, extra, { ...(jti ? { jti } : {}), ms: Math.round(performance.now() - inicio) });
    return respuesta;
  }

  /** Devuelve el `jti` gastado. Sin token pide confirmación; con token, lo valida y lo gasta una sola vez. */
  private async confirmar(
    db: Cliente,
    h: HerramientaDePlataformaRegistrada,
    datos: unknown,
    hash: string,
    ctx: ContextoDePlataforma,
    confirmacion: string | undefined,
  ): Promise<string> {
    if (h.resumir === null) throw rechazar('error_interno', `La herramienta crítica «${h.nombre}» no define su resumen.`);
    const r = await h.resumir(datos, ctx, db);
    if (!r.ok) throw new Revertir({ respuesta: r, codigo: r.error.codigo });
    if (confirmacion === undefined) throw this.pedirConfirmacion(h, hash, r.resumen, ctx);
    const carga = this.validarToken(confirmacion, h, hash, ctx);
    // El `jti` se gasta dejándolo en la auditoría de la misma transacción; el candado impide dos usos a la vez.
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [`plataforma-jti:${carga.jti}`]);
    const { rowCount } = await db.query(
      `select 1 from core.auditoria_plataforma where resultado = 'ok' and resumen->>'jti' = $1 and creado_en > now() - interval '1 day'`,
      [carga.jti],
    );
    if (rowCount) throw rechazar('confirmacion_ya_usada');
    if (carga.huella !== r.resumen.huella) throw rechazar('confirmacion_desactualizada');
    return carga.jti;
  }

  private pedirConfirmacion(h: HerramientaDePlataformaRegistrada, hashArgs: string, resumen: { resumen: string; huella: string }, ctx: ContextoDePlataforma): Revertir {
    const exp = segundos(this.reloj()) + TTL_CONFIRMACION_SEGUNDOS;
    const token = crearToken(
      { herramienta: h.nombre, hashArgs, huella: resumen.huella, usuarioId: ctx.operadorId, empresaId: AMBITO, jti: this.nuevoJti(), exp },
      this.config.CONFIRMACION_SECRET,
    );
    return new Revertir({
      respuesta: { ok: false, requiereConfirmacion: { resumen: resumen.resumen, token, venceEn: new Date(exp * 1000).toISOString() } },
      codigo: 'confirmacion_requerida',
    });
  }

  private validarToken(token: string, h: HerramientaDePlataformaRegistrada, hash: string, ctx: ContextoDePlataforma): CargaDeToken {
    const v = verificarToken(token, this.config.CONFIRMACION_SECRET, segundos(this.reloj()));
    if (!v.ok) throw rechazar(v.motivo === 'vencido' ? 'confirmacion_vencida' : 'confirmacion_invalida');
    const { carga } = v;
    if (carga.herramienta !== h.nombre || carga.hashArgs !== hash || carga.usuarioId !== ctx.operadorId || carga.empresaId !== AMBITO) {
      throw rechazar('confirmacion_no_coincide');
    }
    return carga;
  }

  private comoFallo(e: unknown, nombre: string, ctx: ContextoDePlataforma): Fallo {
    if (e instanceof Revertir) return e.fallo;
    // Nunca se registra el error completo: el de la base puede traer parámetros.
    this.logger.error({ herramienta: nombre, requestId: ctx.requestId, tipo: e instanceof Error ? e.name : typeof e }, 'Falló una herramienta de plataforma');
    return falloDe('error_interno', 'Ocurrió un error inesperado; no se aplicó ningún cambio.');
  }

  // --- auditoría ---

  private async escribirAuditoria(
    db: Pick<Cliente, 'query'>,
    herramienta: string,
    resultado: 'ok' | 'rechazada',
    codigo: string | null,
    ctx: ContextoDePlataforma,
    extra: AuditoriaDePlataforma,
    resumenFijo: Record<string, string | number | boolean | null> = {},
  ): Promise<void> {
    await db.query(
      `insert into core.auditoria_plataforma (actor_usuario_id, herramienta, empresa_id, resultado, codigo, resumen, request_id)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [ctx.operadorId, herramienta.slice(0, 120), extra.empresaId ?? null, resultado, codigo, JSON.stringify({ ...extra.resumen, ...resumenFijo }), ctx.requestId],
    );
  }

  /** La auditoría de un rechazo va fuera de la transacción revertida. Si falla, no tapa la respuesta. */
  private async auditarAparte(nombre: string, h: HerramientaDePlataformaRegistrada | null, codigo: string, ctx: ContextoDePlataforma, datos: unknown): Promise<void> {
    let extra: AuditoriaDePlataforma = {};
    try {
      extra = (h?.auditar?.(datos, null) ?? {}) as AuditoriaDePlataforma;
    } catch {
      extra = {};
    }
    try {
      await this.escribirAuditoria(this.db.sistema, nombre, 'rechazada', codigo, ctx, extra);
    } catch {
      this.logger.error({ herramienta: nombre, requestId: ctx.requestId }, 'No se pudo auditar un rechazo de plataforma');
    }
  }
}
