import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { exito, rechazo, type Respuesta } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type ContextoDeHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { conectarCatalogo, datosDeHerramienta } from './catalogo.js';
import { AYUDAS } from './ayudas.js';
import * as repo from './repositorio.js';

type Fila = NonNullable<Awaited<ReturnType<typeof repo.buscar>>>;
type Previo = { ok: true; fila: Fila } | { ok: false; respuesta: Respuesta<never> };

const noExiste = () => rechazo('no_encontrado', 'No existe ese borrador.');

const puedeEntrar = (ctx: ContextoDeHerramienta, modulo: string) =>
  ctx.modulos.some((m) => m.codigo === modulo && m.puedeEntrar);

/**
 * Lo que protege un borrador es el permiso de la herramienta que propone: quien no puede ejecutarla
 * tampoco lo ve, ni lo corrige, ni lo descarta, ni lo aprueba. Para quien no puede entrar al módulo
 * el borrador no existe.
 */
async function cargar(tx: Transaccion, ctx: ContextoDeHerramienta, id: string, opciones: { bloquear?: boolean; exigirPermiso?: boolean; pendiente?: boolean }): Promise<Previo> {
  const fila = await repo.buscar(tx, id, opciones.bloquear);
  if (!fila || !puedeEntrar(ctx, fila.modulo)) return { ok: false, respuesta: noExiste() };
  const permiso = datosDeHerramienta(fila.herramienta)?.permiso ?? null;
  if (opciones.exigirPermiso && permiso !== null && !ctx.permisos.includes(permiso)) {
    return { ok: false, respuesta: rechazo('sin_permiso', `No tienes permiso para resolver este borrador («${fila.herramienta}»).`) };
  }
  if (opciones.pendiente && fila.estado !== 'pendiente') {
    return { ok: false, respuesta: rechazo('conflicto', 'Este borrador ya se resolvió.') };
  }
  return { ok: true, fila };
}

export function crearHerramientasDeBorradores(ejecutor: EjecutorDeHerramientas): HerramientaRegistrada[] {
  const listar = definirHerramienta('borradores_listar', {
    modulo: 'core',
    permiso: 'borradores:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.listar,
    async ejecutar(args, ctx, tx) {
      const cursor = args.cursor ? repo.decodificarCursor(args.cursor) : null;
      if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
      const modulos = ctx.modulos.filter((m) => m.puedeEntrar).map((m) => m.codigo);
      const { filas, siguiente } = await repo.listar(tx, args, modulos, cursor);
      return exito({ items: filas.map(repo.comoBorrador), siguiente });
    },
  });

  const resumen = definirHerramienta('borradores_resumen', {
    modulo: 'core',
    permiso: 'borradores:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.resumen,
    async ejecutar(_args, ctx, tx) {
      const modulos = ctx.modulos.filter((m) => m.puedeEntrar).map((m) => m.codigo);
      return exito(await repo.contarPendientes(tx, modulos));
    },
  });

  const ver = definirHerramienta('borrador_ver', {
    modulo: 'core',
    permiso: 'borradores:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.ver,
    async ejecutar(args, ctx, tx) {
      const p = await cargar(tx, ctx, args.id, {});
      return p.ok ? exito(repo.comoBorrador(p.fila)) : p.respuesta;
    },
  });

  const corregir = definirHerramienta('borrador_corregir', {
    modulo: 'core',
    permiso: 'borradores:ver',
    criticidad: 'normal',
    ayuda: AYUDAS.corregir,
    auditar: (a) => ({ entidadTipo: 'borrador', entidadId: a.id }),
    async ejecutar(args, ctx, tx) {
      const p = await cargar(tx, ctx, args.id, { bloquear: true, exigirPermiso: true, pendiente: true });
      if (!p.ok) return p.respuesta;
      return exito(repo.comoBorrador(await repo.guardarCorreccion(tx, args.id, args.args)));
    },
  });

  const aprobar = definirHerramienta('borrador_aprobar', {
    modulo: 'core',
    permiso: 'borradores:ver',
    criticidad: 'normal',
    ayuda: AYUDAS.aprobar,
    auditar: (a) => ({ entidadTipo: 'borrador', entidadId: a.id }),
    async ejecutar(args, ctx, tx) {
      if (ctx.canal !== 'ui') {
        return rechazo('confirmacion_solo_ui', 'Un borrador solo se aprueba desde la pantalla.');
      }
      // `for update`: una segunda aprobación espera a la primera y después ve el borrador ya resuelto.
      const p = await cargar(tx, ctx, args.id, { bloquear: true, pendiente: true });
      if (!p.ok) return p.respuesta;
      // Mismas comprobaciones, permisos de quien aprueba y auditoría, dentro de esta transacción.
      const r = await ejecutor.ejecutarDentro(tx, p.fila.herramienta, p.fila.args, { ctx, confirmacion: args.confirmacion });
      // Rechazo (o petición de confirmación) de la propuesta: se responde tal cual y nada cambia.
      if (!r.ok) return r;
      const aprobado = await repo.marcarAprobado(tx, args.id, ctx.usuarioId);
      return exito({ borrador: repo.comoBorrador(aprobado), resultado: r.datos });
    },
  });

  const descartar = definirHerramienta('borrador_descartar', {
    modulo: 'core',
    permiso: 'borradores:ver',
    criticidad: 'normal',
    ayuda: AYUDAS.descartar,
    auditar: (a) => ({ entidadTipo: 'borrador', entidadId: a.id }),
    async ejecutar(args, ctx, tx) {
      const p = await cargar(tx, ctx, args.id, { bloquear: true, exigirPermiso: true, pendiente: true });
      if (!p.ok) return p.respuesta;
      return exito(repo.comoBorrador(await repo.marcarDescartado(tx, args.id, ctx.usuarioId, args.motivo)));
    },
  });

  return [listar, resumen, ver, corregir, aprobar, descartar];
}

@Injectable()
export class HerramientasDeBorradores implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(EjecutorDeHerramientas) private readonly ejecutor: EjecutorDeHerramientas,
  ) {}

  onModuleInit(): void {
    conectarCatalogo((n) => this.registro.obtener(n));
    this.registro.agregar(crearHerramientasDeBorradores(this.ejecutor));
  }
}
