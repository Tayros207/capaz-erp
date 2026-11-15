import { Body, Controller, Headers, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { estadoHttp, exito, rechazo, type Codigo, type Respuesta } from '@capaz/shared';
import { sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { DatabaseService } from '../../infra/database/database.service.js';
import { MENSAJES } from '../../infra/http/error-de-negocio.js';
import { Publica } from '../../infra/http/decoradores.js';
import { emitir } from '../eventos/emisor.js';
import { firmaDeEntrada, iguales, pareceClaveDeApi, hashDeClave } from './firma.js';
import { LimitadorDeFallos } from './limitador.js';

const NOMBRE_DE_EVENTO = /^[a-z0-9][a-z0-9._-]{0,99}$/i;
const CLAVE_DE_IDEMPOTENCIA = /^[\x21-\x7e]{1,200}$/;
const FALLOS_POR_MINUTO = 30;

type ConRawBody = Request & { rawBody?: Buffer };

/**
 * Entrada de webhooks (ADR-014): pública, sin sesión. Autentica con `Authorization: Bearer <clave de API>`
 * (se busca el HASH de la clave con el grupo de sistema), exige `Idempotency-Key` y guarda el evento en
 * `core.webhooks_entrantes` dentro de la empresa duena de la clave. Un envío repetido responde lo mismo
 * sin duplicar. Si llega `X-Capaz-Firma`, debe ser válida (HMAC-SHA256 del cuerpo con el hash de la clave).
 */
@Controller('v1/entrada')
export class EntradaController {
  private readonly fallos = new LimitadorDeFallos(FALLOS_POR_MINUTO, 60_000);

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Post(':evento')
  @Publica()
  async recibir(
    @Param('evento') evento: string,
    @Headers('authorization') autorizacion: string | undefined,
    @Headers('idempotency-key') idempotencia: string | undefined,
    @Headers('x-capaz-firma') firma: string | undefined,
    @Body() cuerpo: unknown,
    @Req() req: ConRawBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Respuesta<unknown>> {
    res.setHeader('Cache-Control', 'no-store');
    const origen = req.ip ?? 'desconocido';
    const fallar = (codigo: Codigo, contar = false): Respuesta<never> => {
      if (contar) this.fallos.registrar(origen);
      res.status(estadoHttp(codigo));
      return rechazo(codigo, MENSAJES[codigo]);
    };
    if (this.fallos.bloqueado(origen)) return fallar('demasiados_intentos');

    const clave = /^Bearer (\S+)$/.exec(autorizacion ?? '')?.[1];
    if (!clave || !pareceClaveDeApi(clave)) return fallar('no_autenticado', true);
    const hash = hashDeClave(clave);
    const { rows } = await this.db.sistema.query<{ tenant_id: string; id: string; alcance: string[]; revocada_en: Date | null }>(
      'select tenant_id, id, alcance, revocada_en from core.claves_api where hash = $1',
      [hash],
    );
    const duena = rows[0];
    if (!duena || duena.revocada_en) return fallar('no_autenticado', true);
    if (!duena.alcance.includes('entrada')) return fallar('sin_permiso');

    if (!NOMBRE_DE_EVENTO.test(evento) || !idempotencia || !CLAVE_DE_IDEMPOTENCIA.test(idempotencia)) return fallar('solicitud_invalida');
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return fallar('solicitud_invalida');
    if (firma !== undefined) {
      // Con el cuerpo tal como llegó si el servidor lo conserva; si no, con su forma compacta.
      const base = req.rawBody ?? JSON.stringify(cuerpo);
      if (!iguales(firma, firmaDeEntrada(hash, base))) return fallar('no_autenticado', true);
    }

    const guardado = await this.guardar(duena.tenant_id, duena.id, evento.toLowerCase(), idempotencia, cuerpo as Record<string, unknown>);
    void this.db.sistema.query('update core.claves_api set ultimo_uso_en = now() where hash = $1', [hash]).catch(() => undefined);
    res.status(200);
    return exito(guardado);
  }

  private guardar(empresaId: string, claveId: string, evento: string, idempotencia: string, carga: Record<string, unknown>) {
    return this.db.conEmpresa({ empresaId, usuarioId: 'sistema' }, async (tx) => {
      const nuevo = await tx.execute<{ id: string }>(
        sql`insert into core.webhooks_entrantes (tenant_id, clave_api_id, evento, clave_idempotencia, carga)
            values (current_setting('app.tenant_id', true), ${claveId}, ${evento}, ${idempotencia}, ${JSON.stringify(carga)}::jsonb)
            on conflict (tenant_id, clave_api_id, clave_idempotencia) do nothing
            returning id`,
      );
      const id = nuevo.rows[0]?.id;
      if (id) {
        await emitir(tx, 'webhook.recibido', { evento, entradaId: id, carga });
        await tx.execute(sql`update core.webhooks_entrantes set procesado_en = now() where id = ${id}`);
        return { id, evento };
      }
      const previo = await tx.execute<{ id: string; evento: string }>(
        sql`select id, evento from core.webhooks_entrantes where clave_api_id = ${claveId} and clave_idempotencia = ${idempotencia}`,
      );
      return previo.rows[0]!;
    });
  }
}
