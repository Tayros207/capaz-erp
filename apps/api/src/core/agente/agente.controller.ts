import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, RequestMethod, Res, Sse, type MessageEvent } from '@nestjs/common';
import type { Response } from 'express';
import { concatWith, interval, map, Observable, of, take } from 'rxjs';
import {
  consultaDeConversacionesSchema, estadoHttp, exito, favoritaConversacionSchema, rechazo, renombrarConversacionSchema, turnoDelAgenteSchema,
  type ConversacionBorrada, type ConversacionConMensajes, type ConversacionDelAgente, type EstadoDelAgente, type EventoDelAgente, type ListaDeConversaciones, type Respuesta, type TurnoDelAgente,
} from '@capaz/shared';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { contextoActual, type ContextoDePeticion } from '../../infra/http/contexto.js';
import { RequiereEmpresa } from '../../infra/http/decoradores.js';
import { ErrorDeNegocio } from '../../infra/http/error-de-negocio.js';
import { ServicioDeConversaciones } from './servicio-de-conversaciones.js';
import { ServicioDeTurnos } from './servicio-de-turnos.js';

/** El contexto de la sesión, ya con empresa y persona. El guardia lo llena antes del manejador; aquí solo se comprueba. */
function contextoDeSesion(): ContextoDePeticion & { empresaId: string; usuarioId: string } {
  const ctx = contextoActual();
  if (!ctx?.empresaId || !ctx.usuarioId) throw new ErrorDeNegocio('sin_empresa');
  return { ...ctx, empresaId: ctx.empresaId, usuarioId: ctx.usuarioId };
}

/**
 * La puerta del asistente (canal `ui`: es la persona quien habla). Empresa, persona y permisos salen de la sesión; el cuerpo
 * solo trae el mensaje y la pista de pantalla. Lo que el asistente ejecuta lo hace con el canal `agente`, por el ejecutor.
 */
@Controller('v1/agente')
export class AgenteController {
  constructor(
    @Inject(ServicioDeTurnos) private readonly turnos: ServicioDeTurnos,
    @Inject(ServicioDeConversaciones) private readonly conversaciones: ServicioDeConversaciones,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Una petición con la cookie pero desde otro sitio no pasa. */
  private comprobarOrigen(origen: string | undefined): void {
    if (!origen || !this.config.ORIGENES_PERMITIDOS.includes(origen)) throw new ErrorDeNegocio('origen_invalido');
  }

  private responder<T>(res: Response, r: Respuesta<T>): Respuesta<T> {
    res.setHeader('Cache-Control', 'no-store');
    if (!r.ok && 'error' in r) res.status(estadoHttp(r.error.codigo));
    return r;
  }

  @Get('estado')
  @RequiereEmpresa()
  async estado(@Res({ passthrough: true }) res: Response): Promise<Respuesta<EstadoDelAgente>> {
    return this.responder(res, exito(await this.conversaciones.estado(contextoDeSesion())));
  }

  /** El turno viaja por SSE. Los rechazos anteriores al primer evento (cuerpo inválido, origen) salen como JSON normal. */
  @Sse('turno', { method: RequestMethod.POST })
  @HttpCode(200)
  @RequiereEmpresa()
  turno(@Body({ schema: turnoDelAgenteSchema }) cuerpo: TurnoDelAgente, @Headers('origin') origen: string | undefined): Observable<MessageEvent> {
    this.comprobarOrigen(origen);
    return this.turnos.iniciar(contextoDeSesion(), cuerpo);
  }

  /** Tres eventos separados por un segundo y un fin, sin modelo: sirve para comprobar que el streaming llega entero al desplegar. */
  @Sse('latido')
  @RequiereEmpresa()
  latido(): Observable<MessageEvent> {
    const evento = (e: EventoDelAgente): MessageEvent => ({ type: e.type, data: e });
    return interval(1000).pipe(
      take(3),
      map((i) => evento({ type: 'texto', delta: `latido ${i + 1}` })),
      concatWith(of(evento({ type: 'fin', mensajeId: randomUUID(), estado: 'completo' }))),
    );
  }

  @Get('conversaciones')
  @RequiereEmpresa()
  async listar(@Query() consulta: unknown, @Res({ passthrough: true }) res: Response): Promise<Respuesta<ListaDeConversaciones>> {
    const c = consultaDeConversacionesSchema.safeParse(consulta ?? {});
    if (!c.success) return this.responder(res, rechazo('argumentos_invalidos', 'La fecha «antesDe» no es válida.'));
    return this.responder(res, await this.conversaciones.listar(contextoDeSesion(), c.data.antesDe));
  }

  @Get('conversaciones/:id')
  @RequiereEmpresa()
  async ver(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<Respuesta<ConversacionConMensajes>> {
    return this.responder(res, await this.conversaciones.ver(contextoDeSesion(), id));
  }

  @Post('conversaciones/:id/renombrar')
  @RequiereEmpresa()
  async renombrar(@Param('id') id: string, @Body({ schema: renombrarConversacionSchema }) cuerpo: { titulo: string }, @Headers('origin') origen: string | undefined, @Res({ passthrough: true }) res: Response): Promise<Respuesta<ConversacionDelAgente>> {
    this.comprobarOrigen(origen);
    return this.responder(res, await this.conversaciones.renombrar(contextoDeSesion(), id, cuerpo.titulo));
  }

  @Post('conversaciones/:id/favorita')
  @RequiereEmpresa()
  async favorita(@Param('id') id: string, @Body({ schema: favoritaConversacionSchema }) cuerpo: { favorita: boolean }, @Headers('origin') origen: string | undefined, @Res({ passthrough: true }) res: Response): Promise<Respuesta<ConversacionDelAgente>> {
    this.comprobarOrigen(origen);
    return this.responder(res, await this.conversaciones.favorita(contextoDeSesion(), id, cuerpo.favorita));
  }

  @Post('conversaciones/:id/borrar')
  @RequiereEmpresa()
  async borrar(@Param('id') id: string, @Headers('origin') origen: string | undefined, @Res({ passthrough: true }) res: Response): Promise<Respuesta<ConversacionBorrada>> {
    this.comprobarOrigen(origen);
    return this.responder(res, await this.conversaciones.borrar(contextoDeSesion(), id));
  }
}
