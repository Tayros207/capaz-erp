import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../infra/database/database.service.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { armarDetallePublico, enlaceAplica, estadoDeEnlace, hashDeToken, pareceToken, type DetallePublico } from '../domain/enlaces.js';
import { verCotizacion, type Cotizacion } from '../repositories/cotizaciones.repository.js';
import { contarVistaDelEnlace, enlacePorHash, type Enlace } from '../repositories/enlaces.repository.js';
import { datosDeEmpresaParaCliente } from '../repositories/enlaces-publico.repository.js';
import { lineasDe, registrarEvento, versionDe } from '../repositories/versiones.repository.js';
import { ORIGEN_ENLACE, registrarAceptacion, registrarRechazo, tomarCotizacionPara } from '../herramientas/decision-de-cliente.js';
import type { CodigoDeAviso } from './plantilla-publica.js';
import type { Formulario } from './formulario.js';

// Lo que hace el enlace público con la base. El grupo de sistema SOLO resuelve de qué empresa es el token; todo lo demás
// (leer, contar la vista, aceptar, rechazar) ocurre dentro de `conEmpresa` con el rol de la aplicación, como en
// `core/conectores/entrada.controller.ts`. Todo lo que no sirve (inexistente, vencido, revocado, versión que ya no rige)
// devuelve `null`: el controlador responde lo mismo en todos los casos.

type Resuelto = { empresaId: string; hash: string };
type Fila = { tenant_id: string; vence_en: Date; revocado_en: Date | null };
type Valido = { enlace: Enlace; c: Cotizacion };

@Injectable()
export class EnlacesPublicos {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  /** Del token a la empresa, con las columnas abiertas al grupo de sistema (`core.abrir_a_plataforma`). */
  async resolver(token: string): Promise<Resuelto | null> {
    if (!pareceToken(token)) return null;
    const hash = hashDeToken(token);
    const { rows } = await this.db.sistema.query<Fila>('select tenant_id, vence_en, revocado_en from cotizador.enlaces where token_hash = $1', [hash]);
    const f = rows[0];
    if (!f || estadoDeEnlace({ venceEn: f.vence_en, revocadoEn: f.revocado_en }, new Date()) !== 'vigente') return null;
    return { empresaId: f.tenant_id, hash };
  }

  /** Dentro de la empresa: el enlace sigue vigente y rige para la versión actual de una cotización que no es borrador. */
  private async validar(tx: Transaccion, ctx: ContextoDeEmpresa, hash: string): Promise<Valido | null> {
    const enlace = await enlacePorHash(tx, ctx, hash);
    if (!enlace || estadoDeEnlace(enlace, new Date()) !== 'vigente') return null;
    const c = await verCotizacion(tx, ctx, enlace.cotizacionId, { alcance: 'todos' });
    return c && enlaceAplica(enlace, c) ? { enlace, c } : null;
  }

  /** La cotización para el cliente; con `contar`, suma la vista (a lo sumo una por hora y por enlace). */
  async ver(token: string, contar: boolean): Promise<DetallePublico | null> {
    const r = await this.resolver(token);
    if (!r) return null;
    const ctx = { empresaId: r.empresaId, usuarioId: 'enlace' };
    return this.db.conEmpresa(ctx, async (tx) => {
      const v = await this.validar(tx, ctx, r.hash);
      if (!v) return null;
      const version = await versionDe(tx, ctx, v.c.id, v.c.versionActual);
      if (!version) return null;
      if (contar && (await contarVistaDelEnlace(tx, ctx, v.enlace.id))) {
        await registrarEvento(tx, ctx, v.c.id, version.version, { tipo: 'vista', canal: 'enlace', usuarioId: null });
      }
      const [lineas, empresa] = [await lineasDe(tx, ctx, version.id), await datosDeEmpresaParaCliente(tx, ctx)];
      return armarDetallePublico({ empresa, cotizacion: v.c, version, lineas });
    });
  }

  /** Aprueba o rechaza. `null` si el enlace no sirve; si no, el aviso que se le muestra al volver a la página. */
  async decidir(token: string, accion: 'aprobar' | 'rechazar', f: Formulario): Promise<CodigoDeAviso | null> {
    const r = await this.resolver(token);
    if (!r) return null;
    const ctx = { empresaId: r.empresaId, usuarioId: 'enlace' };
    return this.db.conEmpresa(ctx, async (tx): Promise<CodigoDeAviso | null> => {
      const v = await this.validar(tx, ctx, r.hash);
      if (!v) return null;
      // Con la fila bloqueada, dos respuestas a la vez se turnan: la segunda ya la encuentra decidida y no cambia nada.
      const t = await tomarCotizacionPara(tx, ctx, v.c.id, accion === 'aprobar' ? 'aceptar' : 'rechazar', 'todos');
      if (!t.ok || !enlaceAplica(v.enlace, t.c)) return t.ok ? null : 'sin_cambio';
      if (accion === 'rechazar') {
        await registrarRechazo(tx, ctx, t, f.nota, ORIGEN_ENLACE);
        return 'rechazada';
      }
      const hecho = await registrarAceptacion(tx, ctx, t, t.version.conOpciones ? f.posiciones : undefined, ORIGEN_ENLACE);
      return hecho.ok ? 'aprobada' : 'elige';
    });
  }
}
