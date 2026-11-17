import { exito, rechazo, type FusionDto } from '@capaz/shared';
import { emitir } from '../../eventos/emisor.js';
import { hashCanonico } from '../../herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../herramientas/tipos.js';
import { conPuntoDeGuardado, type Transaccion } from '../../../infra/database/con-empresa.js';
import type { TipoDeCliente } from '../domain/cliente.js';
import { combinarTipos, completarDatos, totalDeFilas } from '../domain/fusion.js';
import type { Cliente } from '../repositories/clientes.repository.js';
import {
  completarDestino,
  contarReferencias,
  esDeSoloInsercion,
  marcarFusionado,
  moverComercial,
  moverContactosYDirecciones,
  paresParecidos,
  reasignar,
  referenciasAClientes,
  tomarPar,
} from '../repositories/fusion.repository.js';

const ID_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';

type Par = { origen: Cliente; destino: Cliente };

/** Valida el par ya bloqueado. Devuelve el rechazo listo si no se puede fusionar. */
async function validarPar(tx: Transaccion, ctx: ContextoDeHerramienta, origenId: string, destinoId: string): Promise<Par | ReturnType<typeof rechazo>> {
  if (origenId === destinoId) return rechazo('argumentos_invalidos', 'El cliente repetido y el que se conserva deben ser distintos.');
  const par = await tomarPar(tx, ctx, origenId, destinoId);
  const [origen, destino] = [par.get(origenId), par.get(destinoId)];
  if (!origen || !destino) return rechazo('no_encontrado', 'No existe uno de los dos clientes.');
  if (origen.fusionadoEn) return rechazo('conflicto', `«${origen.nombre}» ya fue fusionado con otro cliente.`);
  if (destino.fusionadoEn || destino.archivadoEn) return rechazo('conflicto', `«${destino.nombre}» está archivado o fusionado: elige un cliente activo para conservar.`);
  return { origen, destino };
}

const esRechazo = (x: Par | ReturnType<typeof rechazo>): x is ReturnType<typeof rechazo> => !('origen' in x);

export const clientesSimilares = definirHerramienta('clientes_similares', {
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Buscar clientes repetidos',
    paraQueSirve: 'Lista parejas de clientes o proveedores activos cuyo nombre se parece, del más parecido al menos, para decidir si son la misma persona.',
    cuandoUsarla: 'Cuando sospechas duplicados, por ejemplo la deuda de una misma persona partida en dos fichas.',
    campos: [{ nombre: 'umbral', queSeAnota: 'Qué tan parecidos (0.30 a 0.95; por defecto 0.55).', ejemplo: '0.6' }, { nombre: 'limite', queSeAnota: 'Cuántas parejas, hasta 50.', ejemplo: '20' }],
    ejemploTecleado: 'buscar clientes repetidos',
    ejemploHablado: 'hay clientes duplicados',
    erroresComunes: ['Con un umbral muy bajo salen parejas que no son la misma persona: sube el umbral.'],
    relacionadas: ['clientes_fusionar', 'clientes_buscar'],
  },
  async ejecutar(args, ctx, tx) {
    const filas = await paresParecidos(tx, ctx, args.umbral, args.limite);
    const de = (id: string, nombre: string, documentoNumero: string | null, tipo: string) => ({ id, nombre, documentoNumero, tipo: tipo as TipoDeCliente });
    return exito({ items: filas.map((f) => ({ a: de(f.aId, f.aNombre, f.aDocumento, f.aTipo), b: de(f.bId, f.bNombre, f.bDocumento, f.bTipo), similitud: Math.round(f.similitud * 100) / 100 })) });
  },
});

/** Cuántas filas de cada tabla apuntan al repetido hoy: las que la fusión mueve y las de historial que conserva. */
async function contarTodo(tx: Transaccion, origenId: string) {
  const mover: Array<{ tabla: string; filas: number }> = [];
  const conservar: Array<{ tabla: string; filas: number }> = [];
  for (const r of await referenciasAClientes(tx)) {
    const filas = await contarReferencias(tx, r, origenId);
    if (filas > 0) (((await esDeSoloInsercion(tx, r)) ? conservar : mover)).push({ tabla: `${r.esquema}.${r.tabla}`, filas });
  }
  return { mover, conservar };
}

export const clientesFusionar = definirHerramienta('clientes_fusionar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Fusionar dos clientes repetidos',
    paraQueSirve: 'Reúne en un solo cliente todo lo del repetido: deudas, movimientos, pedidos, compras, oportunidades, cotizaciones, contactos y direcciones. El repetido queda archivado y marcado como fusionado; lo que le falte al que se conserva (teléfono, correo, documento) se completa. Pide confirmación y no se deshace.',
    cuandoUsarla: 'Cuando dos fichas son la misma persona o empresa y quieres un solo saldo y un solo historial.',
    campos: [{ nombre: 'origenId', queSeAnota: 'El cliente repetido, que dejará de usarse.', ejemplo: ID_EJEMPLO }, { nombre: 'destinoId', queSeAnota: 'El cliente que se conserva.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000002' }],
    ejemploTecleado: 'fusionar José Perez en José Pérez',
    ejemploHablado: 'José Perez y José Pérez son la misma persona, únelos',
    erroresComunes: ['El que se conserva debe estar activo.', 'Un cliente ya fusionado no se vuelve a fusionar.', 'Un módulo dado de baja no deja mover sus datos: actívalo o espera.'],
    relacionadas: ['clientes_similares', 'clientes_ver'],
  },
  auditar: (a, d) => ({ entidadTipo: 'cliente', entidadId: a.destinoId, resumen: { origenId: a.origenId, filas: d?.totalFilas ?? 0 } }),
  async resumir(args, ctx, tx) {
    const par = await validarPar(tx, ctx, args.origenId, args.destinoId);
    if (esRechazo(par)) return { ok: false, error: par.error };
    const { mover, conservar } = await contarTodo(tx, par.origen.id);
    const detalle = (mover.length ? mover.map((f) => `${f.filas} en ${f.tabla}`).join(', ') : 'sin registros en otros módulos') + (conservar.length ? `; el historial de solo lectura (${conservar.map((f) => `${f.filas} en ${f.tabla}`).join(', ')}) conserva el nombre anterior` : '');
    return {
      ok: true,
      resumen: {
        resumen: `«${par.origen.nombre}» se fusionará en «${par.destino.nombre}»: ${detalle}. El repetido quedará archivado y la fusión no se deshace.`,
        huella: hashCanonico({ origen: par.origen.id, destino: par.destino.id, mover, conservar, actualizados: [par.origen.actualizadoEn.toISOString(), par.destino.actualizadoEn.toISOString()] }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const par = await validarPar(tx, ctx, args.origenId, args.destinoId);
    if (esRechazo(par)) return par;
    const { origen, destino } = par;
    const reasignadas: Array<{ tabla: string; filas: number }> = [];
    const conservadas: Array<{ tabla: string; filas: number }> = [];
    for (const r of await referenciasAClientes(tx)) {
      if (await esDeSoloInsercion(tx, r)) {
        const filas = await contarReferencias(tx, r, origen.id);
        if (filas > 0) conservadas.push({ tabla: `${r.esquema}.${r.tabla}`, filas });
        continue;
      }
      try {
        const filas = await conPuntoDeGuardado(tx, (punto) => reasignar(punto, r, origen.id, destino.id));
        if (filas > 0) reasignadas.push({ tabla: `${r.esquema}.${r.tabla}`, filas });
      } catch (e) {
        const causa = e instanceof Error ? e.message : String(e);
        return rechazo('conflicto', `No se pudo mover lo de ${r.esquema}.${r.tabla}: ${causa}`);
      }
    }
    const propios = await moverContactosYDirecciones(tx, ctx, origen.id, destino.id);
    await moverComercial(tx, ctx, origen.id, destino.id);
    if (propios > 0) reasignadas.push({ tabla: 'core.cliente_contactos y direcciones', filas: propios });
    // Primero el repetido deja de contar (libera nombre y documento), después el destino se completa con sus datos.
    await marcarFusionado(tx, ctx, origen.id, destino.id);
    await completarDestino(tx, ctx, destino.id, { ...completarDatos(destino, origen), tipo: combinarTipos(destino.tipo as TipoDeCliente, origen.tipo as TipoDeCliente) });
    const total = totalDeFilas(reasignadas);
    await emitir(tx, 'cliente.fusionado', { origenId: origen.id, destinoId: destino.id, filas: total });
    const r: FusionDto = { destinoId: destino.id, origenId: origen.id, reasignadas, conservadas, totalFilas: total };
    return exito(r);
  },
});

export const HERRAMIENTAS_DE_CLIENTES_FUSION = [clientesSimilares, clientesFusionar];
