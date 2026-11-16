import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import {
  crearEmpresaSchema,
  empresaCreadaSchema,
  exito,
  yoSchema,
  type CrearEmpresa,
  type EmpresaCreada,
  type Respuesta,
  type Yo,
} from '@capaz/shared';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { contextoActual } from '../../infra/http/contexto.js';
import { ErrorDeNegocio } from '../../infra/http/error-de-negocio.js';
import { AUTH, type Auth } from '../auth/auth.js';
import { CatalogoDeModulos } from '../modulos/catalogo.js';
import { EmpresasService } from './empresas.service.js';

const slugDe = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'empresa';

@Controller('v1')
export class EmpresasController {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EmpresasService) private readonly empresas: EmpresasService,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
  ) {}

  /** Quién soy: usuario, empresa activa, sus empresas y si puede crear una. Sin empresa también responde. */
  @Get('yo')
  async yo(): Promise<Respuesta<Yo>> {
    const ctx = contextoActual();
    if (!ctx?.usuarioId) throw new ErrorDeNegocio('no_autenticado');
    const { rows: usuario } = await this.db.auth.query<{ id: string; name: string; email: string }>(
      'select id, name, email from auth."user" where id = $1',
      [ctx.usuarioId],
    );
    const { rows: empresas } = await this.db.auth.query<{ id: string; nombre: string; rol: string }>(
      `select o.id, o.name as nombre, m.role as rol from auth.member m
         join auth.organization o on o.id = m.organization_id
        where m.user_id = $1 order by m.created_at`,
      [ctx.usuarioId],
    );
    const { rowCount: filasDeOperador } = await this.db.sistema.query('select 1 from core.plataforma_admins where usuario_id = $1', [ctx.usuarioId]);
    const u = usuario[0];
    if (!u) throw new ErrorDeNegocio('no_autenticado');
    return exito(
      yoSchema.parse({
        usuario: { id: u.id, nombre: u.name, correo: u.email },
        empresa: empresas.find((e) => e.id === ctx.empresaId) ?? null,
        empresas,
        puedeCrearEmpresas: this.config.ALTA_DE_EMPRESAS === 'abierta',
        modulos: this.catalogo.contratables().flatMap((m) => {
          const acceso = ctx.modulos.find((a) => a.codigo === m.codigo);
          return acceso
            ? [{ codigo: m.codigo, nombre: m.nombre, descripcion: m.descripcion, familia: m.familia, orden: m.orden, acento: m.acento, icono: m.icono, enConstruccion: m.enConstruccion, secciones: m.secciones, acceso }]
            : [];
        }),
        permisos: [...ctx.permisos],
        operador: (filasDeOperador ?? 0) > 0,
      }),
    );
  }

  /** Crea la empresa del usuario (solo con alta abierta), la deja activa y la aprovisiona. */
  @Post('empresas')
  async crear(
    @Body({ schema: crearEmpresaSchema }) cuerpo: CrearEmpresa,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Respuesta<EmpresaCreada>> {
    const ctx = contextoActual();
    if (!ctx?.usuarioId) throw new ErrorDeNegocio('no_autenticado');
    if (this.config.ALTA_DE_EMPRESAS !== 'abierta') {
      throw new ErrorDeNegocio('sin_permiso', 'Tu empresa la crea el equipo de Capaz: pídela y te avisamos.');
    }
    const headers = fromNodeHeaders(req.headers);
    const org = await this.auth.api.createOrganization({
      body: { name: cuerpo.nombre, slug: `${slugDe(cuerpo.nombre)}-${randomBytes(3).toString('hex')}` },
      headers,
    });
    if (!org) throw new ErrorDeNegocio('error_interno');
    // Deja la empresa activa en la sesión y reenvía la cookie actualizada al navegador.
    const activada = await this.auth.api.setActiveOrganization({
      headers,
      body: { organizationId: org.id },
      asResponse: true,
    });
    for (const cookie of activada.headers.getSetCookie()) res.append('set-cookie', cookie);
    await this.empresas.asegurar(org.id, ctx.usuarioId);
    return exito(empresaCreadaSchema.parse({ id: org.id, nombre: org.name }));
  }
}
