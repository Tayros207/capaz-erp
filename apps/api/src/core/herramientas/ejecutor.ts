import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ARGUMENTOS_DE_CONTEXTO, rechazo, type Codigo, type ErrorDeRespuesta, type Respuesta } from '@capaz/shared';
import type { Logger } from 'pino';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { conPuntoDeGuardado, transaccionEnCurso, type Transaccion } from '../../infra/database/con-empresa.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { MENSAJES } from '../../infra/http/error-de-negocio.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { EscritorDeAuditoria, type EventoParaAuditar } from '../auditoria/escritor.js';
import { guardarRespuesta, reservarClave, reservarConfirmacion } from './almacen-de-estado.js';
import { crearToken, hashCanonico, type CargaDeToken, TTL_CONFIRMACION_SEGUNDOS, verificarToken } from './confirmacion.js';
import { mensajeDeZod, OPCIONES_EN_ESPANOL } from './errores-de-zod.js';
import { RegistroDeHerramientas } from './registro.js';
import type { ContextoDeHerramienta, HerramientaRegistrada, Resumen } from './tipos.js';

/** Lo que el asistente deja en su huella por una acción que SÍ se ejecutó (los rechazos los anota quien llama, aparte). */
export type DatosDeHuellaDeEjecucion = {
  herramienta: string;
  hashArgs: string;
  /** Los argumentos ya validados. */
  args: unknown;
  /** La salida ya validada. */
  despues: unknown;
  /** Solo en las críticas: el resumen que escribió la propia herramienta y sobre el que se confirmó. */
  resumenConfirmado: string | null;
};

/**
 * Lo pone SOLO el servidor del asistente, nunca los argumentos del modelo. Con esto: (1) una crítica puede confirmarse por el
 * canal `agente` con la confirmación propia (token de un solo uso que ve el servidor, no el modelo) y (2) lo que se hizo queda
 * en la huella del asistente en la MISMA transacción que la acción: no hay acción sin huella.
 */
export type OpcionesDelAgente = {
  politica: 'directo' | 'dinero' | 'confirmada';
  registrarHuella: (tx: Transaccion, d: DatosDeHuellaDeEjecucion) => Promise<void>;
};

export type OpcionesDeEjecucion = {
  ctx: ContextoDeHerramienta;
  confirmacion?: string;
  /** Cabecera `Idempotency-Key`; solo cuenta en herramientas con `idempotente: true`. */
  claveDeIdempotencia?: string;
  agente?: OpcionesDelAgente;
};

type Fallo = {
  respuesta: Respuesta<unknown>;
  resultado: 'rechazada' | 'pendiente_confirmacion';
  codigo: string | null;
};

/** Sale de la transacción para revertirla entera; la auditoría del fallo va aparte. */
class Revertir extends Error {
  constructor(readonly fallo: Fallo) {
    super('revertir');
  }
}

const rechazar = (codigo: Codigo, mensaje: string = MENSAJES[codigo]): Revertir =>
  new Revertir(falloDe(codigo, mensaje));

const falloDe = (codigo: Codigo, mensaje: string = MENSAJES[codigo]): Fallo => ({
  respuesta: rechazo(codigo, mensaje),
  resultado: 'rechazada',
  codigo,
});

const LARGO_MINIMO_DEL_SECRETO = 32;

const segundos = (fecha: Date) => Math.floor(fecha.getTime() / 1000);

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  if (valor === undefined) return {};
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

type Previo = { h: HerramientaRegistrada; datos: unknown; hash: string } | { h: HerramientaRegistrada | null; hash: string; fallo: Fallo };

/** Quita lo interno a quien no tiene `costos:ver`: ni el nivel interno del recibo ni los avisos internos. */
function filtrarPorPermisos(respuesta: Respuesta<unknown>, ctx: ContextoDeHerramienta): Respuesta<unknown> {
  if (!respuesta.ok || !('avisos' in respuesta) || ctx.permisos.includes('costos:ver')) return respuesta;
  return {
    ...respuesta,
    recibo: respuesta.recibo && { comercial: respuesta.recibo.comercial },
    avisos: respuesta.avisos.filter((a) => a.nivel === 'comercial'),
  };
}

/**
 * Única puerta de las operaciones de negocio: la pantalla, la voz, el agente y las conexiones
 * llaman esto. Orden: existe la herramienta → argumentos reservados → módulo → permiso → esquema
 * de entrada → idempotencia → confirmación → ejecución → esquema de salida → auditoría.
 * Todo lo que escribe va en UNA transacción: si algo se rechaza o falla, se revierte entera y la
 * auditoría del rechazo se escribe aparte.
 */
@Injectable()
export class EjecutorDeHerramientas {
  /** Reloj y generador de `jti` reemplazables en las pruebas. */
  reloj: () => Date = () => new Date();
  nuevoJti: () => string = () => randomUUID();
  /**
   * Peticiones de confirmación que ESTE ejecutor firmó. Una herramienta que ejecuta otra con
   * `ejecutarDentro` (bandeja de borradores) puede devolver esa misma respuesta, y solo esa: el
   * objeto no se puede fabricar desde fuera. Una respuesta inventada por la herramienta no está aquí.
   */
  private readonly confirmacionesEmitidas = new WeakSet<object>();

  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EscritorDeAuditoria) private readonly escritor: EscritorDeAuditoria,
    @Inject(CONFIG) private readonly config: Pick<Config, 'CONFIRMACION_SECRET'>,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {
    if (config.CONFIRMACION_SECRET.length < LARGO_MINIMO_DEL_SECRETO) {
      throw new Error(`CONFIRMACION_SECRET debe tener al menos ${LARGO_MINIMO_DEL_SECRETO} caracteres.`);
    }
  }

  async ejecutar(nombre: string, args: unknown, opciones: OpcionesDeEjecucion): Promise<Respuesta<unknown>> {
    if (transaccionEnCurso()) {
      throw new Error('ejecutar() abre su propia transacción: dentro de una, usa ejecutarDentro().');
    }
    const inicio = performance.now();
    const { ctx } = opciones;
    const previo = this.comprobar(nombre, args, ctx);
    if ('fallo' in previo) {
      await this.escritor.registrarAparte(this.eventoDeFallo(nombre, previo.h, previo.hash, previo.fallo, ctx, inicio));
      return previo.fallo.respuesta;
    }
    try {
      return await this.db.conEmpresa({ empresaId: ctx.empresaId, usuarioId: ctx.usuarioId }, (tx) =>
        this.correr(tx, previo.h, previo.datos, previo.hash, opciones, inicio),
      );
    } catch (e) {
      const fallo = this.comoFallo(e, nombre, ctx);
      await this.escritor.registrarAparte(this.eventoDeFallo(nombre, previo.h, previo.hash, fallo, ctx, inicio));
      return fallo.respuesta;
    }
  }

  /**
   * Para una herramienta que ejecuta otra (bandeja de borradores): mismas comprobaciones y auditoría,
   * dentro de la transacción de quien llama, sin abrir otra. Lo que escribió la herramienta rechazada
   * se deshace con un punto de guardado; quien llama debe responder ese mismo rechazo para que todo
   * lo suyo se revierta junto (la auditoría del rechazo queda en SU transacción).
   */
  async ejecutarDentro(
    tx: Transaccion,
    nombre: string,
    args: unknown,
    opciones: Omit<OpcionesDeEjecucion, 'claveDeIdempotencia'>,
  ): Promise<Respuesta<unknown>> {
    const inicio = performance.now();
    const { ctx } = opciones;
    const previo = this.comprobar(nombre, args, ctx);
    if ('fallo' in previo) {
      await this.escritor.registrar(tx, this.eventoDeFallo(nombre, previo.h, previo.hash, previo.fallo, ctx, inicio));
      return previo.fallo.respuesta;
    }
    try {
      return await conPuntoDeGuardado(tx, (punto) => this.correr(punto, previo.h, previo.datos, previo.hash, opciones, inicio));
    } catch (e) {
      const fallo = this.comoFallo(e, nombre, ctx);
      await this.escritor.registrar(tx, this.eventoDeFallo(nombre, previo.h, previo.hash, fallo, ctx, inicio));
      return fallo.respuesta;
    }
  }

  /**
   * Las comprobaciones previas de `ejecutar()` (existe, argumentos reservados, módulo, permiso y esquema) sin ejecutar ni
   * auditar nada. Lo usa quien PROPONE un borrador (el asistente): no debe proponerse lo que ya no podría ejecutarse.
   */
  validar(nombre: string, args: unknown, ctx: ContextoDeHerramienta): { ok: true; herramienta: HerramientaRegistrada; datos: unknown } | { ok: false; respuesta: Respuesta<unknown> } {
    const previo = this.comprobar(nombre, args, ctx);
    return 'fallo' in previo ? { ok: false, respuesta: previo.fallo.respuesta } : { ok: true, herramienta: previo.h, datos: previo.datos };
  }

  // --- comprobaciones previas, sin tocar la base ---

  private comprobar(nombre: string, argsCrudos: unknown, ctx: ContextoDeHerramienta): Previo {
    const h = this.registro.obtener(nombre) ?? null;
    const hash = hashCanonico(argsCrudos ?? {});
    if (!h) return { h, hash, fallo: falloDe('herramienta_desconocida', `No existe la herramienta «${nombre}».`) };
    const bruto = comoObjeto(argsCrudos);
    if (!bruto) return { h, hash, fallo: falloDe('argumentos_invalidos', 'Los argumentos deben ser un objeto.') };
    const prohibido = ARGUMENTOS_DE_CONTEXTO.find((k) => k in bruto);
    if (prohibido) {
      const mensaje = `«${prohibido}» no es un argumento: la empresa, la persona y los permisos los pone el sistema.`;
      return { h, hash, fallo: falloDe('argumento_prohibido', mensaje) };
    }
    const sinAcceso = this.comprobarAcceso(h, ctx);
    if (sinAcceso) return { h, hash, fallo: sinAcceso };
    const parseo = h.entrada.safeParse(bruto, OPCIONES_EN_ESPANOL);
    if (!parseo.success) return { h, hash, fallo: falloDe('argumentos_invalidos', mensajeDeZod(parseo.error)) };
    return { h, datos: parseo.data, hash: hashCanonico(parseo.data) };
  }

  private comprobarAcceso(h: HerramientaRegistrada, ctx: ContextoDeHerramienta): Fallo | null {
    const acceso = ctx.modulos.find((m) => m.codigo === h.modulo);
    if (!acceso?.puedeEntrar) return falloDe('modulo_no_disponible');
    // El núcleo no se contrata ni se da de baja: lo que un `member` puede escribir ahí lo decide el
    // permiso (p. ej. `clientes:editar`), no `puedeEscribir`, que en `core` solo dice «es administrador».
    if (h.criticidad !== 'lectura' && h.modulo !== 'core' && !acceso.puedeEscribir) {
      return falloDe('modulo_solo_lectura');
    }
    if (h.permiso !== null && !ctx.permisos.includes(h.permiso)) {
      return falloDe('sin_permiso', `No tienes permiso para usar «${h.nombre}».`);
    }
    return null;
  }

  // --- dentro de la transacción ---

  private async correr(
    tx: Transaccion,
    h: HerramientaRegistrada,
    datos: unknown,
    hash: string,
    opciones: OpcionesDeEjecucion,
    inicio: number,
  ): Promise<Respuesta<unknown>> {
    const { ctx } = opciones;
    // La clave se aísla por persona: nadie recibe la respuesta guardada de otra.
    const clave =
      h.idempotente && opciones.claveDeIdempotencia ? `${ctx.usuarioId}:${opciones.claveDeIdempotencia}` : null;
    if (clave) {
      const reserva = await reservarClave(tx, ctx.empresaId, clave, h.nombre, hash);
      if (reserva.tipo === 'conflicto') {
        throw rechazar('conflicto', 'Esa clave de idempotencia ya se usó con otra operación u otros datos.');
      }
      if (reserva.tipo === 'repetida') return reserva.respuesta;
    }
    const resumenConfirmado = h.criticidad === 'critica' ? await this.confirmar(tx, h, datos, hash, opciones) : null;
    const respuesta = filtrarPorPermisos(await this.ejecutarYValidar(tx, h, datos, ctx), ctx);
    if (clave) await guardarRespuesta(tx, ctx.empresaId, clave, respuesta);
    await this.escritor.registrar(tx, {
      ctx,
      modulo: h.modulo,
      herramienta: h.nombre,
      resultado: 'ok',
      codigo: null,
      hashArgs: hash,
      datos: h.auditar?.(datos, respuesta.ok ? respuesta.datos : null),
      duracionMs: performance.now() - inicio,
    });
    if (opciones.agente && h.criticidad !== 'lectura') {
      await opciones.agente.registrarHuella(tx, { herramienta: h.nombre, hashArgs: hash, args: datos, despues: respuesta.ok ? respuesta.datos : null, resumenConfirmado });
    }
    return respuesta;
  }

  private async ejecutarYValidar(
    tx: Transaccion,
    h: HerramientaRegistrada,
    datos: unknown,
    ctx: ContextoDeHerramienta,
  ): Promise<Respuesta<unknown>> {
    const r = await h.ejecutar(datos, ctx, tx);
    if ('requiereConfirmacion' in r) {
      // Solo el ejecutor puede pedir confirmación: un token no firmado por él no valdría nada. Se
      // reenvía únicamente la que él mismo emitió para una herramienta propuesta (`ejecutarDentro`);
      // se revierte todo y no se gasta nada, igual que al pedirla de una herramienta crítica directa.
      if (this.confirmacionesEmitidas.has(r)) {
        throw new Revertir({ respuesta: r, resultado: 'pendiente_confirmacion', codigo: null });
      }
      throw rechazar('error_interno', 'Una herramienta no puede pedir confirmación por su cuenta.');
    }
    if (!r.ok) throw new Revertir({ respuesta: r, resultado: 'rechazada', codigo: r.error.codigo });
    const salida = h.salida.safeParse(r.datos, OPCIONES_EN_ESPANOL);
    if (!salida.success) throw rechazar('error_interno', `La salida de «${h.nombre}» no cumple su esquema.`);
    return { ...r, datos: salida.data };
  }

  private async confirmar(
    tx: Transaccion,
    h: HerramientaRegistrada,
    datos: unknown,
    hash: string,
    { ctx, confirmacion, agente }: OpcionesDeEjecucion,
  ): Promise<string> {
    // Por la pantalla, siempre. Por el canal `agente` solo con la confirmación propia que armó el servidor del asistente.
    const confirmaElAgente = ctx.canal === 'agente' && agente?.politica === 'confirmada';
    if (ctx.canal !== 'ui' && !confirmaElAgente) {
      throw rechazar('confirmacion_solo_ui', 'Las acciones críticas deben confirmarse desde la pantalla.');
    }
    if (h.resumir === null) throw rechazar('error_interno', `La herramienta crítica «${h.nombre}» no define su resumen.`);
    const r = await h.resumir(datos, ctx, tx);
    if (!r.ok) throw this.rechazoDeHerramienta(r.error);
    if (confirmacion === undefined) throw this.pedirConfirmacion(h, hash, r.resumen, ctx);
    const carga = this.validarToken(confirmacion, h, hash, ctx);
    // Primero se reserva el `jti` y después se compara la huella: un token repetido responde «ya usada»
    // aunque lo que hizo cambiara el estado; si la huella no coincide, se revierte y el `jti` no se gasta.
    if (!(await reservarConfirmacion(tx, ctx.empresaId, carga.jti))) throw rechazar('confirmacion_ya_usada');
    if (carga.huella !== r.resumen.huella) throw rechazar('confirmacion_desactualizada');
    return r.resumen.resumen;
  }

  private rechazoDeHerramienta(error: ErrorDeRespuesta): Revertir {
    return new Revertir({ respuesta: { ok: false, error }, resultado: 'rechazada', codigo: error.codigo });
  }

  private pedirConfirmacion(h: HerramientaRegistrada, hashArgs: string, resumen: Resumen, ctx: ContextoDeHerramienta): Revertir {
    const exp = segundos(this.reloj()) + TTL_CONFIRMACION_SEGUNDOS;
    const token = crearToken(
      { herramienta: h.nombre, hashArgs, huella: resumen.huella, usuarioId: ctx.usuarioId, empresaId: ctx.empresaId, jti: this.nuevoJti(), exp },
      this.config.CONFIRMACION_SECRET,
    );
    const respuesta: Respuesta<unknown> = {
      ok: false,
      requiereConfirmacion: { resumen: resumen.resumen, token, venceEn: new Date(exp * 1000).toISOString() },
    };
    this.confirmacionesEmitidas.add(respuesta);
    return new Revertir({
      respuesta,
      resultado: 'pendiente_confirmacion',
      codigo: null,
    });
  }

  /** Devuelve la carga si el token vale para ESTA llamada (falta la huella); si no, lanza el rechazo que corresponde. */
  private validarToken(token: string, h: HerramientaRegistrada, hash: string, ctx: ContextoDeHerramienta): CargaDeToken {
    const v = verificarToken(token, this.config.CONFIRMACION_SECRET, segundos(this.reloj()));
    if (!v.ok) throw rechazar(v.motivo === 'vencido' ? 'confirmacion_vencida' : 'confirmacion_invalida');
    const { carga } = v;
    if (
      carga.herramienta !== h.nombre ||
      carga.hashArgs !== hash ||
      carga.usuarioId !== ctx.usuarioId ||
      carga.empresaId !== ctx.empresaId
    ) {
      throw rechazar('confirmacion_no_coincide');
    }
    return carga;
  }

  // --- fallos y auditoría ---

  private comoFallo(e: unknown, nombre: string, ctx: ContextoDeHerramienta): Fallo {
    if (e instanceof Revertir) return e.fallo;
    // Nunca se registra el error completo: el de la base puede traer los parámetros de la consulta.
    this.logger.error(
      { herramienta: nombre, requestId: ctx.requestId, tipo: e instanceof Error ? e.name : typeof e },
      'Falló una herramienta',
    );
    return falloDe('error_interno', 'Ocurrió un error inesperado; no se aplicó ningún cambio.');
  }

  private eventoDeFallo(
    nombre: string,
    h: HerramientaRegistrada | null,
    hashArgs: string,
    fallo: Fallo,
    ctx: ContextoDeHerramienta,
    inicio: number,
  ): EventoParaAuditar {
    return {
      ctx,
      modulo: h?.modulo ?? 'desconocido',
      herramienta: nombre,
      resultado: fallo.resultado,
      codigo: fallo.codigo,
      hashArgs,
      duracionMs: performance.now() - inicio,
    };
  }
}
