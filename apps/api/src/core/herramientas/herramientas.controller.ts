import { Body, Controller, Headers, Inject, Param, Post, Res } from '@nestjs/common';
import { cuerpoDeHerramientaSchema, estadoHttp, rechazo, type Respuesta } from '@capaz/shared';
import type { Response } from 'express';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { contextoActual } from '../../infra/http/contexto.js';
import { RequiereEmpresa } from '../../infra/http/decoradores.js';
import { MENSAJES } from '../../infra/http/error-de-negocio.js';
import { EjecutorDeHerramientas } from './ejecutor.js';

/** Caracteres imprimibles, sin espacios, hasta 200: cabe un UUID o cualquier clave razonable. */
const CLAVE_VALIDA = /^[\x21-\x7e]{1,200}$/;

/**
 * La puerta HTTP de las herramientas (canal `ui`). Empresa, persona y permisos salen de la sesión
 * (`contextoActual()`, que llena el guardia); el cuerpo solo trae `args` y `confirmacion`.
 */
@Controller('v1/herramientas')
export class HerramientasController {
  constructor(
    @Inject(EjecutorDeHerramientas) private readonly ejecutor: EjecutorDeHerramientas,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post(':nombre')
  @RequiereEmpresa()
  async llamar(
    @Param('nombre') nombre: string,
    @Body() cuerpo: unknown,
    @Headers('origin') origen: string | undefined,
    @Headers('idempotency-key') clave: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Respuesta<unknown>> {
    res.setHeader('Cache-Control', 'no-store');
    // Antes de ejecutar nada: una llamada con la cookie pero desde otro sitio no pasa.
    if (!origen || !this.config.ORIGENES_PERMITIDOS.includes(origen)) {
      return this.rechazar(res, 'origen_invalido');
    }
    const ctx = contextoActual();
    if (!ctx?.empresaId || !ctx.usuarioId) return this.rechazar(res, 'sin_empresa');
    const parseo = cuerpoDeHerramientaSchema.safeParse(cuerpo ?? {});
    if (!parseo.success) return this.rechazar(res, 'solicitud_invalida');
    if (clave !== undefined && !CLAVE_VALIDA.test(clave)) {
      return this.rechazar(res, 'solicitud_invalida', 'La clave de idempotencia no es válida.');
    }
    const respuesta = await this.ejecutor.ejecutar(nombre, parseo.data.args, {
      ctx: {
        requestId: ctx.requestId,
        empresaId: ctx.empresaId,
        usuarioId: ctx.usuarioId,
        rol: ctx.rol,
        permisos: ctx.permisos,
        modulos: ctx.modulos,
        // El canal de esta puerta es siempre la pantalla; el cuerpo no puede cambiarlo.
        canal: 'ui',
      },
      confirmacion: parseo.data.confirmacion,
      claveDeIdempotencia: clave,
    });
    if (!respuesta.ok && 'error' in respuesta) res.status(estadoHttp(respuesta.error.codigo));
    else res.status(200);
    return respuesta;
  }

  private rechazar(res: Response, codigo: 'origen_invalido' | 'sin_empresa' | 'solicitud_invalida', mensaje?: string): Respuesta<never> {
    res.status(estadoHttp(codigo));
    return rechazo(codigo, mensaje ?? MENSAJES[codigo]);
  }
}
