import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { exito, rechazo, type Accion, type ModoDeRegla } from '@capaz/shared';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type ContextoDeHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { AYUDAS } from './ayudas.js';
import { MotorDeReglas } from './motor.js';
import * as repo from './repositorio.js';
import { RegistroDeFuentesDeTiempo } from './tipos.js';
import { problemasDeAcciones, problemasDeDisparador } from './validacion.js';

const noExiste = () => rechazo('no_encontrado', 'No existe esa regla.');
const invalida = (p: string[]) => rechazo('argumentos_invalidos', p.join(' '));
const huellaDe = (f: repo.FilaDeRegla) => `${f.actualizadoEn.toISOString()}|${f.modo}|${f.activa}`;

type Dependencias = { registro: RegistroDeHerramientas; fuentes: RegistroDeFuentesDeTiempo; motor: MotorDeReglas };

const problemasDeLaRegla = (d: Dependencias, disparador: repo.DefinicionDeRegla['disparador'], acciones: Accion[], modo: ModoDeRegla) => [
  ...problemasDeDisparador(disparador, d.fuentes),
  ...problemasDeAcciones(acciones, modo, d.registro),
];

export function crearHerramientasDeAutomatizaciones(d: Dependencias): HerramientaRegistrada[] {
  const listar = definirHerramienta('reglas_listar', {
    modulo: 'core',
    permiso: 'automatizaciones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.listar,
    async ejecutar(args, _ctx, tx) {
      const cursor = args.cursor ? repo.decodificarCursor(args.cursor) : null;
      if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
      const { filas, siguiente } = await repo.listar(tx, args, cursor);
      return exito({ items: filas.map(repo.comoRegla), siguiente });
    },
  });

  const ver = definirHerramienta('regla_ver', {
    modulo: 'core',
    permiso: 'automatizaciones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.ver,
    async ejecutar(args, _ctx, tx) {
      const f = await repo.buscar(tx, args.id);
      return f ? exito(repo.comoRegla(f)) : noExiste();
    },
  });

  const guardar = definirHerramienta('regla_guardar', {
    modulo: 'core',
    permiso: 'automatizaciones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.guardar,
    auditar: (a) => ({ entidadTipo: 'regla', entidadId: a.id, resumen: { nombre: a.nombre, modo: a.modo } }),
    async ejecutar(args, ctx, tx) {
      const { id, ...resto } = args;
      const def: repo.DefinicionDeRegla = { ...resto, descripcion: resto.descripcion ?? null };
      const problemas = problemasDeLaRegla(d, def.disparador, def.acciones, def.modo);
      if (problemas.length) return invalida(problemas);
      if (!id) return exito(repo.comoRegla(await repo.crear(tx, def, ctx.usuarioId)));
      const actual = await repo.buscar(tx, id, true);
      if (!actual) return noExiste();
      // Una regla en automático solo se enciende con `regla_activar` (crítica): editarla la apaga.
      return exito(repo.comoRegla(await repo.reemplazar(tx, id, def, def.modo === 'automatico')));
    },
  });

  const activar = definirHerramienta('regla_activar', {
    modulo: 'core',
    permiso: 'automatizaciones:gestionar',
    // Debería ser crítica solo en modo automático; el ejecutor no lo decide por llamada, así que lo es siempre.
    criticidad: 'critica',
    ayuda: AYUDAS.activar,
    auditar: (a) => ({ entidadTipo: 'regla', entidadId: a.id }),
    async resumir(args, _ctx, tx) {
      const f = await repo.buscar(tx, args.id);
      if (!f) return { ok: false, error: { codigo: 'no_encontrado', mensaje: 'No existe esa regla.' } };
      const aviso = f.modo === 'automatico' ? ' Actuará sin pedir aprobación.' : ' Dejará borradores en la bandeja.';
      return { ok: true, resumen: { resumen: `Activar la regla «${f.nombre}».${aviso}`, huella: huellaDe(f) } };
    },
    async ejecutar(args, _ctx, tx) {
      const f = await repo.buscar(tx, args.id, true);
      if (!f) return noExiste();
      const def = repo.comoRegla(f);
      const problemas = problemasDeLaRegla(d, def.disparador, def.acciones, def.modo);
      if (problemas.length) return invalida(problemas);
      return exito(repo.comoRegla(await repo.fijarActiva(tx, args.id, true)));
    },
  });

  const desactivar = definirHerramienta('regla_desactivar', {
    modulo: 'core',
    permiso: 'automatizaciones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.desactivar,
    auditar: (a) => ({ entidadTipo: 'regla', entidadId: a.id }),
    async ejecutar(args, _ctx, tx) {
      const f = await repo.buscar(tx, args.id, true);
      return f ? exito(repo.comoRegla(await repo.fijarActiva(tx, args.id, false))) : noExiste();
    },
  });

  const probar = definirHerramienta('regla_probar', {
    modulo: 'core',
    permiso: 'automatizaciones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.probar,
    auditar: (a) => ({ entidadTipo: 'regla', entidadId: a.id }),
    async ejecutar(args, _ctx, tx) {
      const f = await repo.buscar(tx, args.id);
      if (!f) return noExiste();
      const raiz = { disparo: { tipo: 'prueba' }, datos: args.datos };
      return exito(await d.motor.simular(tx, f, raiz, new Date()));
    },
  });

  return [listar, ver, guardar, activar, desactivar, probar];
}

export function crearHerramientasDeEjecucion(d: Dependencias, acceso: (ctx: ContextoDeHerramienta) => ContextoDeHerramienta): HerramientaRegistrada[] {
  const ejecutarHerramienta = definirHerramienta('regla_ejecutar', {
    modulo: 'core',
    permiso: 'automatizaciones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.ejecutar,
    auditar: (a) => ({ entidadTipo: 'regla', entidadId: a.id }),
    async ejecutar(args, ctx, tx) {
      const f = await repo.buscar(tx, args.id);
      if (!f) return noExiste();
      if (!f.activa) return rechazo('conflicto', 'La regla está apagada: actívala antes de ejecutarla.');
      const raiz = { disparo: { tipo: 'manual', por: ctx.usuarioId }, datos: args.datos };
      // En automático corre con los permisos de QUIEN la ejecuta (no de quien la creó), por el canal de sistema.
      const s = await d.motor.procesar(tx, f, raiz, { ahora: new Date(), registrarSinCoincidencia: true, contextoAutomatico: async () => acceso(ctx) });
      return s.ejecucion ? exito(s.ejecucion) : rechazo('error_interno', 'La ejecución no quedó registrada.');
    },
  });

  const ejecuciones = definirHerramienta('regla_ejecuciones_listar', {
    modulo: 'core',
    permiso: 'automatizaciones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.ejecuciones,
    async ejecutar(args, _ctx, tx) {
      const cursor = args.cursor ? repo.decodificarCursor(args.cursor) : null;
      if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
      const { filas, siguiente } = await repo.listarEjecuciones(tx, args, cursor);
      return exito({ items: filas.map(repo.comoEjecucion), siguiente });
    },
  });
  return [ejecutarHerramienta, ejecuciones];
}

export const comoSistema = (ctx: ContextoDeHerramienta): ContextoDeHerramienta => ({ ...ctx, canal: 'sistema' });

@Injectable()
export class HerramientasDeAutomatizaciones implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(RegistroDeFuentesDeTiempo) private readonly fuentes: RegistroDeFuentesDeTiempo,
    @Inject(MotorDeReglas) private readonly motor: MotorDeReglas,
  ) {}

  onModuleInit(): void {
    const d = { registro: this.registro, fuentes: this.fuentes, motor: this.motor };
    this.registro.agregar([...crearHerramientasDeAutomatizaciones(d), ...crearHerramientasDeEjecucion(d, comoSistema)]);
  }
}

