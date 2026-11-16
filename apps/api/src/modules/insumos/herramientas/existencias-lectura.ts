import { exito, rechazo } from '@capaz/shared';
import { normalizarNombre } from '../../../core/clientes/domain/normalizacion.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { listarExistencias } from '../repositories/existencias.repository.js';
import { listarMovimientos } from '../repositories/movimientos.repository.js';
import { cifrasDeInsumos } from '../repositories/resumen.repository.js';
import { CAMPO_ARTICULO, CURSOR_INVALIDO, MODULO, alcanceDeInsumos } from './comunes.js';
import { aExistenciaDto, aMovimientoDto } from './mapeo.js';

export const existenciasListar = definirHerramienta('existencias_listar', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver las existencias',
    paraQueSirve: 'Muestra cuánto hay de cada artículo activo en cada sucursal, en orden alfabético, y marca lo que está bajo el mínimo.',
    cuandoUsarla: 'Cuando revisas el almacén de una sucursal o quieres la lista de lo que hay que reponer.',
    campos: [
      { nombre: 'sucursalId', queSeAnota: 'Solo esa sucursal (opcional; sin ella, todas).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000030' },
      { nombre: 'buscar', queSeAnota: 'Parte del nombre o el código exacto del producto (opcional).', ejemplo: 'tinta' },
      { nombre: 'soloBajoMinimo', queSeAnota: 'Solo lo que está bajo el mínimo.', ejemplo: 'true' },
    ],
    ejemploTecleado: 'qué hay que reponer en la sucursal principal',
    ejemploHablado: 'qué se está acabando en el almacén',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['articulos_listar', 'existencia_mover'],
  },
  async ejecutar(args, ctx, tx) {
    const buscarNormalizado = args.buscar ? normalizarNombre(args.buscar) : undefined;
    const r = await listarExistencias(tx, ctx, { ...args, buscarNormalizado });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', CURSOR_INVALIDO);
    return exito({ items: r.items.map(aExistenciaDto), siguiente: r.siguiente });
  },
});

export const existenciasMovimientosListar = definirHerramienta('existencias_movimientos_listar', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Historial de movimientos del inventario',
    paraQueSirve: 'Muestra las entradas, salidas y ajustes, del más nuevo al más antiguo, con lo que quedó después de cada uno. El historial no se edita ni se borra.',
    cuandoUsarla: 'Cuando quieres saber qué pasó con un artículo: quién lo movió, cuándo y por qué.',
    campos: [
      { ...CAMPO_ARTICULO, queSeAnota: 'Solo los de ese artículo (opcional).' },
      { nombre: 'sucursalId', queSeAnota: 'Solo los de esa sucursal (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000030' },
      { nombre: 'tipo', queSeAnota: 'entrada, salida o ajuste (opcional).', ejemplo: 'salida' },
    ],
    ejemploTecleado: 'movimientos del papel bond A4',
    ejemploHablado: 'qué movimientos tuvo el papel bond',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['articulo_ver', 'existencia_mover'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarMovimientos(tx, ctx, alcanceDeInsumos(ctx), args);
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', CURSOR_INVALIDO);
    return exito({ items: r.items.map(aMovimientoDto), siguiente: r.siguiente });
  },
});

export const insumosResumen = definirHerramienta('insumos_resumen', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Resumen del inventario',
    paraQueSirve: 'Cuenta los artículos activos y los que están bajo el mínimo, y las entradas, salidas y ajustes registrados en el período.',
    cuandoUsarla: 'Cuando quieres saber cómo va el almacén sin recorrer la lista.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período.', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período.', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'resumen del inventario de marzo',
    ejemploHablado: 'cómo va el inventario este mes',
    erroresComunes: ['Tu acceso es solo a tus propios registros: el resumen es de toda la empresa.', 'El período empieza antes de terminar.'],
    relacionadas: ['existencias_listar', 'existencias_movimientos_listar'],
  },
  async ejecutar(args, ctx, tx) {
    if (alcanceDeInsumos(ctx) === 'propios') return rechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.');
    const hoy = await hoyDeLaEmpresa(tx);
    const cifras = await cifrasDeInsumos(tx, { desde: args.desde, hasta: args.hasta, zona: hoy.zona });
    return exito({ desde: args.desde, hasta: args.hasta, ...cifras });
  },
});
