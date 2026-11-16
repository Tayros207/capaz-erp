import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursorPorFecha } from '../domain/cursor.js';
import { listarMovimientos, verMovimiento } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe } from './comun.js';
import { aMovimientoDto } from './mapeo.js';

// Lecturas de movimientos. Con alcance «propios» solo se ven los que registró la propia persona (R4).

export const movimientoVer = definirHerramienta('movimiento_ver', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un movimiento',
    paraQueSirve: 'Muestra un ingreso o egreso con su cuenta, categoría, contacto y, si fue anulado, el motivo.',
    cuandoUsarla: 'Para revisar el detalle de un movimiento antes de anularlo o de responder una consulta.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del movimiento.', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'ver el movimiento MOV-2026-000123',
    ejemploHablado: 'abre el movimiento ciento veintitrés',
    erroresComunes: ['El movimiento no existe, es de otra empresa o no lo registraste tú.'],
    relacionadas: ['movimientos_listar', 'movimiento_anular'],
  },
  async ejecutar(args, ctx, tx) {
    const f = await verMovimiento(tx, ctx, args.id, propietarioDe(ctx));
    return f ? exito(aMovimientoDto(f)) : rechazo('no_encontrado', 'No existe ese movimiento.');
  },
});

export const movimientosListar = definirHerramienta('movimientos_listar', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar movimientos',
    paraQueSirve: 'Muestra los ingresos y egresos, del más reciente al más antiguo, por páginas y con filtros.',
    cuandoUsarla: 'Para revisar lo que entró y salió en un periodo, de una cuenta o de un contacto.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día (AAAA-MM-DD, opcional).', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día (AAAA-MM-DD, opcional).', ejemplo: '2026-03-31' },
      { nombre: 'tipo', queSeAnota: 'ingreso o egreso (opcional).', ejemplo: 'egreso' },
      { nombre: 'cuentaId', queSeAnota: 'Solo los de una cuenta (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'estado', queSeAnota: 'activos, anulados o todos (por defecto, activos).', ejemplo: 'activos' },
    ],
    ejemploTecleado: 'ver los egresos de marzo',
    ejemploHablado: 'qué gastos tuve este mes',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['movimiento_ver', 'movimiento_registrar'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursorPorFecha(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const { cursor: _c, ...filtros } = args;
    const r = await listarMovimientos(tx, ctx, { ...filtros, cursor }, propietarioDe(ctx));
    return exito({ items: r.items.map(aMovimientoDto), siguiente: r.siguiente });
  },
});
