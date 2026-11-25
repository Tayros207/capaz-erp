import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { exito, rechazo, type ConfiguracionDelAgente } from '@capaz/shared';
import { agenteConfiguracion } from '../../db/esquema/core-agente.js';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { hashCanonico } from '../herramientas/confirmacion.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { AYUDAS } from './ayudas.js';
import { catalogoConPrecios, configuracionDe, modeloEfectivo, validarEleccion } from './modelos.js';
import { PreciosDeModelos } from './precios-de-modelos.js';
import { gastoDelMes, leerConfiguracion, zonaDeLaEmpresa } from './repositorio-de-uso.js';

// Cambiar el modelo y el tope del asistente es una operación de negocio (regla 3): va por herramienta registrada, auditada y con
// confirmación en dos pasos. El asistente NO puede usarlas (está en `PROHIBIDAS`): no cambia su propio modelo ni su tope.

type Dependencias = { config: Pick<Config, 'AGENTE_MODELO' | 'AGENTE_TOPE_MENSUAL_USD'>; precios: Pick<PreciosDeModelos, 'vivos'> };

const dolares = (micro: number): string => `US$ ${(micro / 1_000_000).toFixed(2)}`;

type Cambios = { modelo?: string | null; topeMensualMicrousd?: number | null; escrituraDirecta?: boolean; dineroDirecto?: boolean; internet?: boolean; topePorOperacionCentimos?: number | null };

/** El resumen que la persona lee antes de confirmar, en palabras sencillas y sin repetir nada que no deba verse. */
function describirCambios(args: Cambios, hoy: ConfiguracionDelAgente, config: Dependencias['config']): string {
  const cambios: string[] = [];
  if (args.modelo !== undefined) cambios.push(`el modelo de «${hoy.modeloEfectivo}» a «${modeloEfectivo(config, args.modelo)}»`);
  if (args.topeMensualMicrousd !== undefined) {
    const nuevo = args.topeMensualMicrousd ?? Math.round(config.AGENTE_TOPE_MENSUAL_USD * 1_000_000);
    cambios.push(nuevo === 0 ? 'el tope mensual a cero (el asistente quedará detenido)' : `el tope mensual de ${dolares(hoy.topeEfectivoMicrousd)} a ${dolares(nuevo)}`);
  }
  if (args.escrituraDirecta !== undefined) cambios.push(args.escrituraDirecta ? 'que el asistente pueda hacer algunos cambios al momento' : 'que el asistente deje todos los cambios como borrador');
  if (args.dineroDirecto !== undefined) cambios.push(args.dineroDirecto ? 'que el asistente pueda mover dinero por sí solo (con huella y topes)' : 'que todo el dinero del asistente quede como borrador');
  if (args.internet !== undefined) cambios.push(args.internet ? 'que el asistente pueda buscar en internet' : 'que el asistente no busque en internet');
  if (args.topePorOperacionCentimos !== undefined) cambios.push(`el tope por operación de dinero a ${args.topePorOperacionCentimos === null ? 'el del sistema' : `S/ ${(args.topePorOperacionCentimos / 100).toFixed(2)}`}`);
  return `Cambiarás ${cambios.join(', ')}.`;
}

/** Solo lo que vino: lo que no se envía no se toca. Un valor nulo vuelve al del sistema. */
const soloLoEnviado = (args: Cambios): Cambios => ({
  ...(args.modelo !== undefined && { modelo: args.modelo }),
  ...(args.topeMensualMicrousd !== undefined && { topeMensualMicrousd: args.topeMensualMicrousd }),
  ...(args.escrituraDirecta !== undefined && { escrituraDirecta: args.escrituraDirecta }),
  ...(args.dineroDirecto !== undefined && { dineroDirecto: args.dineroDirecto }),
  ...(args.internet !== undefined && { internet: args.internet }),
  ...(args.topePorOperacionCentimos !== undefined && { topePorOperacionCentimos: args.topePorOperacionCentimos }),
});

async function modeloValido(modelo: unknown, precios: Dependencias['precios']): Promise<string | null> {
  if (typeof modelo !== 'string') return null;
  const eleccion = validarEleccion(modelo, await precios.vivos());
  return eleccion.ok ? null : eleccion.error;
}

export function crearHerramientasDeAgente({ config, precios }: Dependencias): HerramientaRegistrada[] {
  const ver = definirHerramienta('agente_configuracion_ver', {
    modulo: 'core',
    permiso: 'empresa:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.ver,
    async ejecutar(_args, _ctx, tx) {
      const [fila, vivos] = await Promise.all([leerConfiguracion(tx), precios.vivos()]);
      const gasto = await gastoDelMes(tx, new Date(), await zonaDeLaEmpresa(tx));
      return exito({ configuracion: configuracionDe(config, fila, gasto), catalogo: catalogoConPrecios(vivos), preciosDisponibles: vivos !== null });
    },
  });

  const configurar = definirHerramienta('agente_configurar', {
    modulo: 'core',
    permiso: 'empresa:configurar',
    criticidad: 'critica',
    ayuda: AYUDAS.configurar,
    // Lee la fila bloqueada: el estado sobre el que se confirma no cambia hasta que termina la llamada.
    async resumir(args, ctx, tx) {
      const [fila] = await tx.select().from(agenteConfiguracion).where(eq(agenteConfiguracion.tenantId, ctx.empresaId)).for('update');
      const invalido = await modeloValido(args.modelo, precios);
      if (invalido) return { ok: false, error: { codigo: 'argumentos_invalidos', mensaje: invalido } };
      const hoy = configuracionDe(config, fila ?? null, 0);
      return { ok: true, resumen: { resumen: describirCambios(args, hoy, config), huella: hashCanonico({ modelo: hoy.modelo, tope: hoy.topeMensualMicrousd, escrituraDirecta: hoy.escrituraDirecta, dineroDirecto: hoy.dineroDirecto, internet: hoy.internet, topeOperacion: hoy.topePorOperacionCentimos }) } };
    },
    auditar: (args) => ({ entidadTipo: 'agente_configuracion', resumen: { campos: Object.keys(args).filter((k) => args[k as keyof typeof args] !== undefined).sort().join(',') } }),
    async ejecutar(args, ctx, tx) {
      const invalido = await modeloValido(args.modelo, precios);
      if (invalido) return rechazo('argumentos_invalidos', invalido);
      const cambios = soloLoEnviado(args);
      await tx
        .insert(agenteConfiguracion)
        // La columna nace en `false`, pero el asistente actúa por defecto: la primera configuración no debe apagarlo en silencio.
        .values({ tenantId: ctx.empresaId, actualizadoPor: ctx.usuarioId, escrituraDirecta: true, internet: true, ...cambios })
        .onConflictDoUpdate({ target: agenteConfiguracion.tenantId, set: { ...cambios, actualizadoPor: ctx.usuarioId, actualizadoEn: sql`now()` } });
      const [fila, gasto] = await Promise.all([leerConfiguracion(tx), gastoDelMes(tx, new Date(), await zonaDeLaEmpresa(tx))]);
      return exito({ configuracion: configuracionDe(config, fila, gasto) });
    },
  });
  return [ver, configurar];
}

/** Registra las dos herramientas al arrancar. El contrato y las herramientas entran en el MISMO paso (si no, el registro no arranca). */
@Injectable()
export class HerramientasDeAgente implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(PreciosDeModelos) private readonly precios: PreciosDeModelos,
  ) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeAgente({ config: this.config, precios: this.precios }));
  }
}
