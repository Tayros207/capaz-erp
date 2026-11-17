import { Controller, Get, Inject, Logger, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Publica } from '../../../infra/http/decoradores.js';
import { LimitadorDeFallos } from '../../../core/conectores/limitador.js';
import { EnlacesPublicos } from './enlaces-publicos.servicio.js';
import { leerFormulario } from './formulario.js';
import { esAviso, paginaDeCotizacion, paginaDeError, paginaDeEspera, paginaNoDisponible } from './plantilla-publica.js';

const FALLOS_POR_MINUTO = 30;
const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

/**
 * Enlace público de una cotización (B3): sin sesión, HTML sin JavaScript. El token (32 bytes en base64url) es la única
 * llave; en la base solo está su sha256. Un token inventado, vencido o revocado recibe EXACTAMENTE la misma página 404.
 * Los intentos fallidos por IP se cuentan: con 30 en un minuto se bloquea ese origen.
 */
@Controller('v1/c')
export class EnlacesPublicosController {
  private readonly registro = new Logger('EnlacesPublicos');
  private readonly fallos = new LimitadorDeFallos(FALLOS_POR_MINUTO, 60_000);

  constructor(@Inject(EnlacesPublicos) private readonly enlaces: EnlacesPublicos) {}

  @Get(':token')
  @Publica()
  ver(@Param('token') token: string, @Query('a') aviso: unknown, @Req() req: Request, @Res() res: Response): Promise<void> {
    return this.mostrar(token, req, res, { contar: true, aviso: esAviso(aviso) ? aviso : undefined });
  }

  @Get(':token/imprimir')
  @Publica()
  imprimir(@Param('token') token: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    return this.mostrar(token, req, res, { contar: false, paraImprimir: true });
  }

  @Post(':token/aprobar')
  @Publica()
  aprobar(@Param('token') token: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    return this.decidir(token, 'aprobar', req, res);
  }

  @Post(':token/rechazar')
  @Publica()
  rechazar(@Param('token') token: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    return this.decidir(token, 'rechazar', req, res);
  }

  private cabeceras(res: Response): void {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  private html(res: Response, estado: number, cuerpo: string): void {
    this.cabeceras(res);
    res.status(estado).type('text/html; charset=utf-8').send(cuerpo);
  }

  /** `true` si el origen está bloqueado (ya respondió). */
  private bloqueado(origen: string, res: Response): boolean {
    if (!this.fallos.bloqueado(origen)) return false;
    res.setHeader('Retry-After', '60');
    this.html(res, 429, paginaDeEspera());
    return true;
  }

  private noDisponible(origen: string, res: Response): void {
    this.fallos.registrar(origen);
    this.html(res, 404, paginaNoDisponible());
  }

  private async mostrar(token: string, req: Request, res: Response, o: { contar: boolean; aviso?: Parameters<typeof paginaDeCotizacion>[1]['aviso']; paraImprimir?: boolean }): Promise<void> {
    const origen = req.ip ?? 'desconocido';
    if (this.bloqueado(origen, res)) return;
    try {
      const detalle = await this.enlaces.ver(token, o.contar);
      if (!detalle) return this.noDisponible(origen, res);
      this.html(res, 200, paginaDeCotizacion(detalle, { ruta: `/api/v1/c/${encodeURIComponent(token)}`, aviso: o.aviso, paraImprimir: o.paraImprimir }));
    } catch (e) {
      this.registro.error(`No se pudo atender el enlace público: ${e instanceof Error ? e.message : 'error desconocido'}`);
      this.html(res, 500, paginaDeError());
    }
  }

  private async decidir(token: string, accion: 'aprobar' | 'rechazar', req: Request, res: Response): Promise<void> {
    const origen = req.ip ?? 'desconocido';
    if (this.bloqueado(origen, res)) return;
    try {
      const aviso = await this.enlaces.decidir(token, accion, await leerFormulario(req));
      if (!aviso) return this.noDisponible(origen, res);
      this.cabeceras(res);
      res.redirect(303, `/api/v1/c/${encodeURIComponent(token)}?a=${aviso}`);
    } catch (e) {
      this.registro.error(`No se pudo atender el enlace público: ${e instanceof Error ? e.message : 'error desconocido'}`);
      this.html(res, 500, paginaDeError());
    }
  }
}
