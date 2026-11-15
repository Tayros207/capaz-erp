import { Inject, Injectable } from '@nestjs/common';
import type { Accion, EjecucionDeRegla, ModoDeRegla } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { proponerBorrador } from '../borradores/proponer.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { evaluarCondiciones, sustituir } from './condiciones.js';
import * as repo from './repositorio.js';
import type { RaizDeDatos } from './tipos.js';
import { problemasDeAcciones } from './validacion.js';

type Resultado = EjecucionDeRegla['resultado'];

export type Entrada = RaizDeDatos;
export type Opciones = {
  ahora: Date;
  /** Contexto con el que corre el modo `automatico` (siempre `canal: 'sistema'`); nulo si no hay a quién atribuirlo. */
  contextoAutomatico: () => Promise<ContextoDeHerramienta | null>;
  /** Registrar también las no coincidencias (manual y simulación; los eventos las omiten para no llenar el historial). */
  registrarSinCoincidencia: boolean;
};
export type AccionResuelta = { herramienta: string; args: unknown; problemas: string[] };
export type Salida = { resultado: Resultado; ejecucion: EjecucionDeRegla | null; detalle: unknown };

/** Falla de una acción en modo automático: deshace las anteriores de la misma regla. */
class AccionRechazada extends Error {
  constructor(readonly detalle: Record<string, unknown>) {
    super('acción rechazada');
  }
}

/** Evalúa una regla ya cargada contra un disparo y aplica su modo. Todo dentro de la transacción de quien llama. */
@Injectable()
export class MotorDeReglas {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(EjecutorDeHerramientas) private readonly ejecutor: EjecutorDeHerramientas,
  ) {}

  /**
   * Sustituye plantillas y comprueba cada acción sin ejecutar. `problemas` impiden aplicarla; `avisos` solo
   * informan (un borrador admite argumentos incompletos: se validan al aprobar).
   */
  resolverAcciones(acciones: readonly Accion[], raiz: Entrada, modo: ModoDeRegla): AccionResuelta[] {
    return acciones.map((a) => {
      const { valor, faltantes } = sustituir(a.args, raiz);
      const problemas = faltantes.map((f) => `Falta el dato «${f}».`);
      const h = this.registro.obtener(a.herramienta);
      if (!h) problemas.push(`La herramienta «${a.herramienta}» no existe.`);
      else if (faltantes.length === 0) {
        const r = h.entrada.safeParse(valor);
        if (!r.success) {
          const m = `Los argumentos no cumplen el contrato: ${r.error.issues.map((i) => `${i.path.join('.') || 'args'}: ${i.message}`).join('; ')}`;
          if (modo === 'automatico') problemas.push(m);
          else problemas.push(`Aviso: ${m}`);
        }
      }
      return { herramienta: a.herramienta, args: valor, problemas };
    });
  }

  /** «Qué haría»: no ejecuta nada ni propone borradores; solo deja una ejecución simulada. */
  async simular(tx: Transaccion, regla: repo.FilaDeRegla, raiz: Entrada, ahora: Date) {
    const zona = await repo.zonaHorariaDeLaEmpresa(tx);
    const coincide = evaluarCondiciones(regla.condiciones as never, raiz);
    const acciones = coincide ? this.resolverAcciones(regla.acciones as Accion[], raiz, regla.modo as ModoDeRegla) : [];
    const limiteAlcanzado = (await repo.contarDeHoy(tx, regla.id, ahora, zona)) >= regla.limiteDiario;
    const todos = [
      ...problemasDeAcciones(regla.acciones as Accion[], regla.modo as ModoDeRegla, this.registro),
      ...acciones.flatMap((a) => a.problemas),
    ];
    const problemas = todos.filter((p) => !p.startsWith('Aviso:'));
    const resultado: Resultado = !coincide ? 'sin_coincidencia' : limiteAlcanzado ? 'omitida_por_limite' : problemas.length ? 'rechazada' : 'ok';
    const resumen = this.resumirSimulacion(regla.modo as ModoDeRegla, coincide, limiteAlcanzado, acciones, problemas);
    const e = await repo.registrarEjecucion(tx, {
      reglaId: regla.id,
      disparadoPor: raiz.disparo,
      simulada: true,
      resultado,
      detalle: { acciones, problemas: todos, resumen },
      ahora,
    });
    return { coincide, limiteAlcanzado, modo: regla.modo as ModoDeRegla, acciones, resumen, ejecucionId: e.id };
  }

  private resumirSimulacion(modo: ModoDeRegla, coincide: boolean, limite: boolean, acciones: AccionResuelta[], problemas: string[]): string {
    if (!coincide) return 'Las condiciones no se cumplen con esos datos: no haría nada.';
    if (limite) return 'Se alcanzó el límite diario de la regla: no haría nada hoy.';
    if (problemas.length) return `No se podría aplicar: ${problemas.join(' ')}`;
    const lista = acciones.map((a) => a.herramienta).join(', ');
    if (modo === 'automatico') return `Ejecutaría sin pedir aprobación: ${lista}.`;
    return `Dejaría en la bandeja ${acciones.length === 1 ? 'un borrador' : `${acciones.length} borradores`}${modo === 'pide_aprobacion' ? ' con prioridad alta' : ''}: ${lista}.`;
  }

  /** Ejecución real. Bloquea la regla para que el límite diario no se pase con disparos simultáneos. */
  async procesar(tx: Transaccion, regla: repo.FilaDeRegla, raiz: Entrada, o: Opciones): Promise<Salida> {
    await repo.buscar(tx, regla.id, true);
    const log = async (resultado: Resultado, detalle?: unknown, borradorId?: string | null): Promise<Salida> => {
      const f = await repo.registrarEjecucion(tx, { reglaId: regla.id, disparadoPor: raiz.disparo, simulada: false, resultado, detalle, borradorId, ahora: o.ahora });
      return { resultado, ejecucion: repo.comoEjecucion(f), detalle };
    };
    if (!evaluarCondiciones(regla.condiciones as never, raiz)) {
      return o.registrarSinCoincidencia ? log('sin_coincidencia') : { resultado: 'sin_coincidencia', ejecucion: null, detalle: null };
    }
    const zona = await repo.zonaHorariaDeLaEmpresa(tx);
    if ((await repo.contarDeHoy(tx, regla.id, o.ahora, zona)) >= regla.limiteDiario) {
      return log('omitida_por_limite', { limiteDiario: regla.limiteDiario });
    }
    const modo = regla.modo as ModoDeRegla;
    const acciones = this.resolverAcciones(regla.acciones as Accion[], raiz, modo);
    const graves = [...problemasDeAcciones(regla.acciones as Accion[], modo, this.registro), ...acciones.flatMap((a) => a.problemas)].filter((p) => !p.startsWith('Aviso:'));
    if (graves.length) return log('rechazada', { problemas: graves });
    return modo === 'automatico' ? this.ejecutarAutomatico(tx, regla, acciones, o, log) : this.proponer(tx, regla, acciones, modo, log);
  }

  private async proponer(tx: Transaccion, regla: repo.FilaDeRegla, acciones: AccionResuelta[], modo: ModoDeRegla, log: (r: Resultado, d?: unknown, b?: string | null) => Promise<Salida>): Promise<Salida> {
    const ids: string[] = [];
    for (const a of acciones) {
      const titulo = this.registro.obtener(a.herramienta)?.ayuda.titulo ?? a.herramienta;
      const { id } = await proponerBorrador(tx, {
        herramienta: a.herramienta as never,
        args: a.args,
        resumen: `Regla «${regla.nombre}»: ${titulo}`,
        origen: 'regla',
        origenRef: regla.id,
        prioridad: modo === 'pide_aprobacion' ? 'alta' : 'normal',
        propuestoPor: `regla:${regla.id}`,
      });
      ids.push(id);
    }
    return log('borrador_creado', { borradores: ids }, ids[0]);
  }

  private async ejecutarAutomatico(tx: Transaccion, regla: repo.FilaDeRegla, acciones: AccionResuelta[], o: Opciones, log: (r: Resultado, d?: unknown, b?: string | null) => Promise<Salida>): Promise<Salida> {
    const base = await o.contextoAutomatico();
    if (!base) return log('rechazada', { problemas: ['Quien creó la regla ya no es miembro de la empresa.'] });
    const ctx: ContextoDeHerramienta = { ...base, canal: 'sistema', requestId: `regla-${regla.id}` };
    try {
      const salidas: unknown[] = [];
      // Un punto de guardado: si una acción falla, las anteriores de esta regla se deshacen.
      await tx.transaction(async (sp) => {
        for (const a of acciones) {
          const r = await this.ejecutor.ejecutarDentro(sp, a.herramienta, a.args, { ctx });
          if (!r.ok) {
            const error = 'error' in r ? r.error : { codigo: 'confirmacion_requerida', mensaje: 'La acción pidió confirmación.' };
            throw new AccionRechazada({ herramienta: a.herramienta, codigo: error.codigo, mensaje: error.mensaje });
          }
          salidas.push({ herramienta: a.herramienta, ok: true });
        }
      });
      return await log('ok', { acciones: salidas });
    } catch (e) {
      if (e instanceof AccionRechazada) return log('rechazada', { problemas: [`«${String(e.detalle.herramienta)}»: ${String(e.detalle.mensaje)}`], rechazo: e.detalle });
      throw e;
    }
  }
}
