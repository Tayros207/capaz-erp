import { createHash } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { exito, MAX_DETALLES_DE_FILA, rechazo, type EntidadDeIntercambio, type FilaConMotivo } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../herramientas/tipos.js';
import { AYUDAS } from './ayudas.js';
import { Invocador } from './invocador.js';
import { escribirCsv } from './csv.js';
import { filasParaExportar } from './exportar.js';
import { planificar, type Plan } from './planificar.js';
import { registrarImportacion } from './repositorio.js';

const PERMISO_DE_VER = { clientes: 'clientes:ver', productos: 'productos:ver' } as const;
const PERMISO_DE_EDITAR = { clientes: 'clientes:editar', productos: 'productos:editar' } as const;
const HERRAMIENTA_DE_ALTA = { clientes: 'clientes_crear', productos: 'productos_crear' } as const;

const sinPermiso = (permiso: string) => rechazo('sin_permiso', `Para esto también necesitas el permiso «${permiso}».`);
const recortar = (f: FilaConMotivo[]) => f.slice(0, MAX_DETALLES_DE_FILA);

const lectura = (p: Plan) => ({
  entidad: p.entidad,
  separador: p.separador,
  total: p.total,
  columnasIgnoradas: p.columnasIgnoradas,
  errores: recortar(p.errores),
  erroresTotal: p.errores.length,
  duplicadas: recortar(p.duplicadas),
  duplicadasTotal: p.duplicadas.length,
});

const nombreDeEntidad = (e: EntidadDeIntercambio, n: number) => (e === 'clientes' ? (n === 1 ? 'cliente' : 'clientes') : n === 1 ? 'producto' : 'productos');

function resumenDe(p: Plan): string {
  const partes = [`Se crearán ${p.nuevas.length} ${nombreDeEntidad(p.entidad, p.nuevas.length)}`];
  partes.push(`${p.duplicadas.length} ya existen o se repiten y se omitirán`);
  partes.push(`${p.errores.length} ${p.errores.length === 1 ? 'fila tiene' : 'filas tienen'} errores y no se importarán`);
  return `${partes.join('; ')}.`;
}

/** Cambia si cambia lo que se crearía: la confirmación deja de valer si alguien creó esos mismos registros mientras tanto. */
const huellaDe = (p: Plan) => createHash('sha256').update(JSON.stringify([p.nuevas.map((n) => n.fila), p.errores.length, p.duplicadas.length])).digest('hex');

export function crearHerramientasDeIntercambio(invocador: Invocador) {
  const exportar = definirHerramienta('exportar_csv', {
    modulo: 'core',
    permiso: 'datos:exportar',
    criticidad: 'lectura',
    ayuda: AYUDAS.exportar,
    auditar: (a) => ({ entidadTipo: a.entidad, resumen: { incluirArchivados: a.incluirArchivados } }),
    async ejecutar(args, ctx, tx) {
      if (!ctx.permisos.includes(PERMISO_DE_VER[args.entidad])) return sinPermiso(PERMISO_DE_VER[args.entidad]);
      const { filas, truncado } = await filasParaExportar(tx, ctx, args.entidad, args.incluirArchivados);
      const hoy = new Date().toISOString().slice(0, 10);
      return exito({
        entidad: args.entidad,
        nombreDeArchivo: `${args.entidad}-${hoy}.csv`,
        contenido: escribirCsv(filas, { separador: args.separador, bom: true }),
        filas: filas.length - 1,
        truncado,
      });
    },
  });

  const previsualizar = definirHerramienta('importar_csv_previsualizar', {
    modulo: 'core',
    permiso: 'datos:importar',
    criticidad: 'lectura',
    ayuda: AYUDAS.previsualizar,
    auditar: (a) => ({ entidadTipo: a.entidad }),
    async ejecutar(args, ctx, tx) {
      if (!ctx.permisos.includes(PERMISO_DE_EDITAR[args.entidad])) return sinPermiso(PERMISO_DE_EDITAR[args.entidad]);
      const r = await planificar(tx, ctx, args);
      if (!r.ok) return r;
      return exito({ ...lectura(r.plan), nuevas: r.plan.nuevas.length });
    },
  });

  const aplicar = definirHerramienta('importar_csv_aplicar', {
    modulo: 'core',
    permiso: 'datos:importar',
    criticidad: 'critica',
    ayuda: AYUDAS.aplicar,
    auditar: (a, d) => ({
      entidadTipo: a.entidad,
      entidadId: d?.sincronizacionId,
      resumen: d ? { creadas: d.creadas, duplicadas: d.duplicadasTotal, errores: d.erroresTotal } : undefined,
    }),
    async resumir(args, ctx, tx) {
      if (!ctx.permisos.includes(PERMISO_DE_EDITAR[args.entidad])) return { ok: false, error: sinPermiso(PERMISO_DE_EDITAR[args.entidad]).error };
      const r = await planificar(tx, ctx, args);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, resumen: { resumen: resumenDe(r.plan), huella: huellaDe(r.plan) } };
    },
    async ejecutar(args, ctx, tx) {
      if (!ctx.permisos.includes(PERMISO_DE_EDITAR[args.entidad])) return sinPermiso(PERMISO_DE_EDITAR[args.entidad]);
      const inicio = new Date();
      const r = await planificar(tx, ctx, args);
      if (!r.ok) return r;
      const { plan } = r;
      const errores = [...plan.errores];
      const duplicadas = [...plan.duplicadas];
      let creadas = 0;
      for (const n of plan.nuevas) creadas += (await crear(invocador, tx, ctx, plan.entidad, n, errores, duplicadas)) ? 1 : 0;
      errores.sort((a, b) => a.fila - b.fila);
      duplicadas.sort((a, b) => a.fila - b.fila);
      const final: Plan = { ...plan, errores, duplicadas };
      const sincronizacionId = await registrarImportacion(tx, ctx, { entidad: plan.entidad, total: plan.total, procesados: creadas, errores: recortar(errores), inicio });
      return exito({ ...lectura(final), creadas, sincronizacionId });
    },
  });

  return [exportar, previsualizar, aplicar];
}

/** Crea una fila por la herramienta de alta, con el contexto de quien importa (permisos, auditoría y eventos incluidos). */
async function crear(
  invocador: Invocador,
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  entidad: EntidadDeIntercambio,
  fila: { fila: number; args: Record<string, unknown> },
  errores: FilaConMotivo[],
  duplicadas: FilaConMotivo[],
): Promise<boolean> {
  const r = await invocador.invocar(tx, ctx, HERRAMIENTA_DE_ALTA[entidad], fila.args);
  if (r.ok) return true;
  if ('error' in r && r.error.codigo === 'conflicto') duplicadas.push({ fila: fila.fila, motivo: 'Se creó otro registro igual mientras se importaba: se omite.' });
  else errores.push({ fila: fila.fila, motivo: 'error' in r ? r.error.mensaje : 'No se pudo crear esta fila.' });
  return false;
}

@Injectable()
export class HerramientasDeIntercambio implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(EjecutorDeHerramientas) private readonly ejecutor: EjecutorDeHerramientas,
  ) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeIntercambio(new Invocador(this.ejecutor)));
  }
}

