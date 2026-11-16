import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { movimientoManual } from '../domain/existencia.js';
import { agruparLineas, type LineaDeRecepcion } from '../domain/recepcion.js';
import { verArticulo, type Articulo } from '../repositories/articulos.repository.js';
import { sucursalParaMover, type Sucursal } from '../repositories/existencias.repository.js';
import { bloquearOrigen, movimientosDeOrigen, verMovimientos } from '../repositories/movimientos.repository.js';
import { CAMPO_SUCURSAL, MODULO, SUCURSAL_INVALIDA, type Rechazo } from './comunes.js';
import { aMovimientoDto } from './mapeo.js';
import { registrarMovimiento } from './registrar-movimiento.js';
import { rechazoDeMovimiento } from './respuestas.js';

/**
 * Bloquea los artículos de las líneas en orden de id (dos recepciones a la vez nunca se esperan en cruz) y
 * comprueba que existan y estén activos.
 */
async function articulosDeLineas(tx: Transaccion, ctx: ContextoDeEmpresa, lineas: readonly LineaDeRecepcion[]): Promise<Map<string, Articulo> | Rechazo> {
  const articulos = new Map<string, Articulo>();
  for (const id of lineas.map((l) => l.articuloId).sort((a, b) => a.localeCompare(b))) {
    const a = await verArticulo(tx, ctx, id, { bloquear: true });
    if (!a) return rechazo('argumentos_invalidos', 'Una de las líneas cita un artículo que no existe.');
    if (a.archivadoEn) return rechazo('conflicto', `«${a.nombre}» está archivado: actívalo de nuevo o quítalo de la entrada.`);
    articulos.set(id, a);
  }
  return articulos;
}

type Entrada = { sucursal: Sucursal; lineas: readonly LineaDeRecepcion[]; motivo: string | null; origen: { tipo: string; id: string } };

/** Registra una entrada por línea (ya agrupadas). Devuelve los ids de los movimientos o el primer rechazo. */
async function registrarEntradas(tx: Transaccion, ctx: ContextoDeEmpresa, e: Entrada, articulos: Map<string, Articulo>): Promise<string[] | Rechazo> {
  const ids: string[] = [];
  for (const l of e.lineas) {
    const r = await registrarMovimiento(tx, ctx, {
      articulo: articulos.get(l.articuloId)!,
      sucursal: e.sucursal,
      movimiento: movimientoManual('entrada', l.cantidadMilesimas),
      costoUnitarioMilesimas: l.costoUnitarioMilesimas ?? null,
      motivo: e.motivo,
      origen: e.origen,
    });
    if (!r.ok) return rechazoDeMovimiento(r);
    ids.push(r.movimientoId);
  }
  return ids;
}

export const existenciasRecibir = definirHerramienta('existencias_recibir', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Recibir mercadería en el inventario',
    paraQueSirve: 'Registra de una vez la entrada de varios artículos que llegan juntos desde un mismo origen (por ejemplo, una recepción de compra). El mismo origen nunca suma dos veces.',
    cuandoUsarla: 'Al aprobar en la bandeja la entrada que propone una compra recibida, o al registrar a mano una llegada con su guía.',
    campos: [
      { nombre: 'origenTipo', queSeAnota: 'De dónde viene la entrada.', ejemplo: 'recepcion' },
      { nombre: 'origenId', queSeAnota: 'Identificador de ese origen.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000040' },
      CAMPO_SUCURSAL,
      { nombre: 'lineas', queSeAnota: 'Por línea: el artículo, la cantidad en milésimas y, si se sabe, el costo unitario.', ejemplo: '[{ "articuloId": "0192f0c4-7b1e-7000-8000-000000000020", "cantidadMilesimas": 10000 }]' },
      { nombre: 'motivo', queSeAnota: 'Nota de la entrada (opcional).', ejemplo: 'Compra OC-PRI-2026-0001' },
    ],
    ejemploTecleado: 'recibir 10 paquetes de papel bond y 2 cajas de tinta de la guía 001-245',
    ejemploHablado: 'llegaron diez paquetes de papel bond y dos cajas de tinta',
    erroresComunes: ['Una de las líneas cita un artículo que no existe.', 'El artículo está archivado.', 'La sucursal no existe o está archivada.'],
    relacionadas: ['existencia_mover', 'existencias_movimientos_listar'],
  },
  auditar: (a, d) => ({
    entidadTipo: 'recepcion_de_inventario',
    entidadId: a.origenId,
    resumen: { origenTipo: a.origenTipo, lineas: d?.movimientos.length ?? 0, repetida: d?.repetida ?? false },
  }),
  async ejecutar(args, ctx, tx) {
    const origen = { tipo: args.origenTipo, id: args.origenId };
    await bloquearOrigen(tx, ctx, origen.tipo, origen.id);
    const previos = await movimientosDeOrigen(tx, ctx, origen.tipo, origen.id);
    if (previos.length > 0) return exito({ origenTipo: origen.tipo, origenId: origen.id, repetida: true, movimientos: previos.map(aMovimientoDto) });
    const sucursal = await sucursalParaMover(tx, ctx, args.sucursalId);
    if (!sucursal) return rechazo('argumentos_invalidos', SUCURSAL_INVALIDA);
    const lineas = agruparLineas(args.lineas);
    const articulos = await articulosDeLineas(tx, ctx, lineas);
    if (!(articulos instanceof Map)) return articulos;
    const ids = await registrarEntradas(tx, ctx, { sucursal, lineas, motivo: args.motivo || null, origen }, articulos);
    if (!Array.isArray(ids)) return ids;
    const movimientos = await verMovimientos(tx, ctx, ids);
    return exito({ origenTipo: origen.tipo, origenId: origen.id, repetida: false, movimientos: movimientos.map(aMovimientoDto) });
  },
});
