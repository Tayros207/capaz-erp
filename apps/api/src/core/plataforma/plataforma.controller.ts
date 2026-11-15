import { Body, Controller, Headers, Inject, Param, Post, Res, UseGuards } from '@nestjs/common';
import { cuerpoDeHerramientaSchema, estadoHttp, rechazo, type Respuesta } from '@capaz/shared';
import type { Response } from 'express';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { contextoActual } from '../../infra/http/contexto.js';
import { MENSAJES } from '../../infra/http/error-de-negocio.js';
import { EjecutorDePlataforma } from './ejecutor-de-plataforma.js';
import { GuardiaDePlataforma } from './guardia-de-plataforma.js';

/**
 * La puerta HTTP de la consola: `POST /api/v1/plataforma/herramientas/:nombre`. La persona operadora
 * sale de la sesión (la global la identifica y `GuardiaDePlataforma` la autoriza); el cuerpo solo
 * trae `args` y `confirmacion`. No hay empresa: la plataforma no actúa «como» una empresa.
 */
@Controller('v1/plataforma')
@UseGuards(GuardiaDePlataforma)
export class PlataformaController {
  constructor(
    @Inject(EjecutorDePlataforma) private readonly ejecutor: EjecutorDePlataforma,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post('herramientas/:nombre')
  async llamar(
    @Param('nombre') nombre: string,
    @Body() cuerpo: unknown,
    @Headers('origin') origen: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Respuesta<unknown>> {
    res.setHeader('Cache-Control', 'no-store');
    if (!origen || !this.config.ORIGENES_PERMITIDOS.includes(origen)) return this.rechazar(res, 'origen_invalido');
    const ctx = contextoActual();
    if (!ctx?.usuarioId) return this.rechazar(res, 'no_autenticado');
    const parseo = cuerpoDeHerramientaSchema.safeParse(cuerpo ?? {});
    if (!parseo.success) return this.rechazar(res, 'solicitud_invalida');
    const respuesta = await this.ejecutor.ejecutar(nombre, parseo.data.args, {
      ctx: { requestId: ctx.requestId, operadorId: ctx.usuarioId, canal: 'ui' },
      confirmacion: parseo.data.confirmacion,
    });
    if (!respuesta.ok && 'error' in respuesta) res.status(estadoHttp(respuesta.error.codigo));
    else res.status(200);
    return respuesta;
  }

  private rechazar(res: Response, codigo: 'origen_invalido' | 'no_autenticado' | 'solicitud_invalida'): Respuesta<never> {
    res.status(estadoHttp(codigo));
    return rechazo(codigo, MENSAJES[codigo]);
  }
}
