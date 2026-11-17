import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { exito, MAXIMO_DE_PROPUESTAS_POR_CAPTURA, rechazo } from '@capaz/shared';
import { datosDeHerramienta } from '../borradores/catalogo.js';
import { proponerBorrador } from '../borradores/proponer.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type ContextoDeHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { AYUDAS } from './ayudas.js';
import { MODELO_DE_LENGUAJE, type ModeloDeLenguaje } from './modelo-de-lenguaje.js';
import { RegistroDeInterpretes } from './registro-de-interpretes.js';
import type { PropuestaInterpretada } from './tipos.js';

/**
 * Comprueba, antes de guardar nada, que la persona podría aprobar cada propuesta. Es todo o nada.
 * Una herramienta desconocida o de otro módulo es un error de programación del intérprete.
 */
function revisarPropuestas(propuestas: readonly PropuestaInterpretada[], modulo: string, ctx: ContextoDeHerramienta) {
  if (propuestas.length > MAXIMO_DE_PROPUESTAS_POR_CAPTURA) {
    throw new Error(`El intérprete de «${modulo}» devolvió ${propuestas.length} propuestas: el máximo es ${MAXIMO_DE_PROPUESTAS_POR_CAPTURA}.`);
  }
  for (const p of propuestas) {
    const d = datosDeHerramienta(p.herramienta);
    if (!d || d.modulo !== modulo) throw new Error(`El intérprete de «${modulo}» propuso «${p.herramienta}», que no es de ese módulo.`);
    if (d.permiso !== null && !ctx.permisos.includes(d.permiso)) return rechazo('sin_permiso', 'No tienes permiso para registrar eso.');
  }
  return null;
}

export function crearHerramientasDeCaptura(interpretes: RegistroDeInterpretes, modelo: ModeloDeLenguaje): HerramientaRegistrada[] {
  const proponer = definirHerramienta('captura_proponer', {
    modulo: 'core',
    permiso: 'borradores:ver',
    criticidad: 'normal',
    idempotente: true,
    ayuda: AYUDAS.proponer,
    // Nunca el texto dictado: es dato personal (R26).
    auditar: (a, datos) => ({
      entidadTipo: 'borrador',
      ...(datos?.borradores[0] ? { entidadId: datos.borradores[0].id } : {}),
      resumen: {
        borradores: datos?.borradores.length ?? 0,
        faltan: datos?.faltan.length ?? 0,
        origen: a.origen,
        interpretadoCon: datos?.interpretadoCon ?? null,
      },
    }),
    async ejecutar(args, ctx, tx) {
      // El núcleo está eximido de `puedeEscribir` en el ejecutor: se comprueba aquí.
      const acceso = ctx.modulos.find((m) => m.codigo === args.modulo);
      if (!acceso?.puedeEntrar) return rechazo('modulo_no_disponible', 'Ese módulo no está disponible para ti.');
      if (!acceso.puedeEscribir) return rechazo('modulo_solo_lectura', 'Ese módulo está en solo lectura: no se puede registrar en él.');
      const interprete = interpretes.para(args.modulo);
      if (!interprete) return rechazo('no_encontrado', 'Todavía no se puede dictar para ese módulo.');

      const extraccion =
        interprete.esquemaParaModelo && interprete.instrucciones
          ? await modelo.extraer(interprete.esquemaParaModelo, interprete.instrucciones, args.texto)
          : null;
      const interpretadoCon = extraccion === null ? ('reglas' as const) : ('modelo' as const);
      const r = await interprete.interpretar(tx, ctx, { texto: args.texto, origen: args.origen, modo: args.modo, extraccion });

      const sinPermiso = revisarPropuestas(r.propuestas, interprete.modulo, ctx);
      if (sinPermiso) return sinPermiso;

      // La hora la calcula el servidor: el reloj del aparato solo aporta una duración.
      const capturaIniciadaEn = new Date(Date.now() - args.transcurridoMs);
      const borradores = [];
      for (const p of r.propuestas) {
        const { id } = await proponerBorrador(tx, {
          herramienta: p.herramienta,
          args: p.args,
          resumen: p.resumen,
          origen: args.origen,
          propuestoPor: ctx.usuarioId,
          capturaIniciadaEn,
        });
        borradores.push({ id, herramienta: p.herramienta, resumen: p.resumen, args: p.args, sugerencias: p.sugerencias ?? [] });
      }
      return exito({ borradores, faltan: r.faltan, pista: r.pista, interpretadoCon });
    },
  });
  return [proponer];
}

@Injectable()
export class HerramientasDeCaptura implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(RegistroDeInterpretes) private readonly interpretes: RegistroDeInterpretes,
    @Inject(MODELO_DE_LENGUAJE) private readonly modelo: ModeloDeLenguaje,
  ) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeCaptura(this.interpretes, this.modelo));
  }
}
