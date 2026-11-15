import { AsyncResource } from 'node:async_hooks';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { CONFIG, type Config } from '../../infra/config/config.js';
import type { ContextoDeEmpresa, Transaccion } from '../../infra/database/con-empresa.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { Cifrador } from '../../core/conectores/cifrado.js';
import { DestinoNoPermitido, resolverDestino, resolverReal, type Resolver } from '../../core/conectores/destinos.js';
import { enviarJson, type ResultadoDeEnvio } from '../../core/conectores/enviar.js';
import { firmarEnvio } from '../../core/conectores/firma.js';
import { CIFRADOR } from '../../core/conectores/tokens.js';
import type { Consumidor, EventoEntregado } from '../../core/eventos/tipos.js';
import { MAX_INTENTOS } from '../../core/eventos/relevo.js';
import * as repo from './repositorio.js';

export const RESOLVER = Symbol('RESOLVER_DE_DESTINOS');
/** Tope de envíos por webhook y por minuto, contado en la base. */
export const MAX_ENVIOS_POR_MINUTO = 60;
export const MAX_CUERPO_DE_SALIDA = 1_000_000;

export const aadDeSecreto = (empresaId: string, webhookId: string) => `webhook:${empresaId}:${webhookId}`;

/**
 * Entrega de webhooks de salida. El consumidor `'*'` crea un envío por suscripción que coincide y lo envía.
 * Si alguno falla, LANZA y el relevo reintenta el evento completo; lo ya `enviado` no se repite (el envío
 * es único por webhook y evento). El estado de cada envío se guarda en su PROPIA transacción, fuera de la
 * del relevo, para que sobreviva a ese lanzamiento (que revierte la transacción del relevo).
 */
@Injectable()
export class EntregaDeWebhooks {
  /** Recurso creado fuera de toda transacción: ejecutar con él da un contexto limpio (otra conexión). */
  private readonly fuera = new AsyncResource('capaz-webhooks');
  private readonly resolver: Resolver;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CONFIG) private readonly config: Pick<Config, 'PERMITIR_DESTINOS_LOCALES'>,
    @Optional() @Inject(CIFRADOR) private readonly cifrador: Cifrador | null,
    @Optional() @Inject(RESOLVER) resolver?: Resolver,
  ) {
    this.resolver = resolver ?? resolverReal;
  }

  consumidor(): Consumidor {
    return { nombre: 'webhooks_salida', modulo: 'webhooks', evento: '*', manejar: (e, ctx, tx) => this.alEvento(e, ctx.empresaId, tx) };
  }

  /** Valida un destino con la misma regla del envío (para crear y editar). */
  validarDestino(url: string) {
    return resolverDestino(url, { permitirLocales: this.config.PERMITIR_DESTINOS_LOCALES, resolver: this.resolver });
  }

  private enOtraTransaccion<T>(ctx: ContextoDeEmpresa, fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    return this.fuera.runInAsyncScope(() => this.db.conEmpresa(ctx, fn));
  }

  async alEvento(e: EventoEntregado, empresaId: string, tx: Transaccion): Promise<void> {
    const suscritos = await repo.suscritosA(tx, e.tipo);
    const errores: string[] = [];
    for (const s of suscritos) {
      try {
        await this.entregarA(s, e, empresaId);
      } catch (error) {
        errores.push(`${s.id}: ${error instanceof Error ? error.message : 'error'}`);
      }
    }
    if (errores.length) throw new Error(`Falló el envío de webhooks (${errores.join('; ')}).`);
  }

  private async entregarA(s: repo.FilaDeSaliente, e: EventoEntregado, empresaId: string): Promise<void> {
    const ctx = { empresaId, usuarioId: 'sistema' };
    const envio = await this.enOtraTransaccion(ctx, (t) => repo.asegurarEnvio(t, s.id, e.id, e.tipo));
    if (envio.estado !== 'pendiente') return;
    if ((await this.enOtraTransaccion(ctx, (t) => repo.enviosDelUltimoMinuto(t, s.id, envio.id))) >= MAX_ENVIOS_POR_MINUTO) {
      throw new Error('limite_por_minuto');
    }
    const r = await this.enviar(s, empresaId, { id: envio.id, eventoId: e.id, tipo: e.tipo, carga: e.carga, creadoEn: e.creadoEn });
    await this.enOtraTransaccion(ctx, (t) => repo.registrarIntento(t, { id: envio.id, webhookId: s.id }, r, MAX_INTENTOS));
    if (!r.ok) throw new Error(r.error ?? 'error');
  }

  /** Firma y envía un evento a un webhook. Nunca lanza: devuelve el resultado con un código sin datos sensibles. */
  async enviar(
    s: Pick<repo.FilaDeSaliente, 'url' | 'secreto_cifrado' | 'id'>,
    empresaId: string,
    ev: { id: string; eventoId: string; tipo: string; carga: unknown; creadoEn: Date },
  ): Promise<ResultadoDeEnvio> {
    const fallo = (error: string): ResultadoDeEnvio => ({ ok: false, codigoHttp: null, error });
    if (!this.cifrador) return fallo('sin_clave_de_cifrado');
    let secreto: string;
    try {
      secreto = this.cifrador.descifrar(s.secreto_cifrado, aadDeSecreto(empresaId, s.id));
    } catch {
      return fallo('secreto_ilegible');
    }
    const cuerpo = JSON.stringify({ id: ev.eventoId, tipo: ev.tipo, creadoEn: ev.creadoEn.toISOString(), carga: ev.carga });
    if (Buffer.byteLength(cuerpo) > MAX_CUERPO_DE_SALIDA) return fallo('carga_muy_grande');
    let destino;
    try {
      destino = await this.validarDestino(s.url);
    } catch (error) {
      return fallo(error instanceof DestinoNoPermitido ? 'destino_no_permitido' : 'destino_invalido');
    }
    const marca = Math.floor(Date.now() / 1000);
    return enviarJson(destino, cuerpo, {
      'x-capaz-evento': ev.tipo,
      'x-capaz-entrega': ev.id,
      'x-capaz-marca-de-tiempo': String(marca),
      'x-capaz-firma': firmarEnvio(secreto, marca, cuerpo),
    });
  }
}
