import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { calcularKardex } from '../domain/kardex.js';
import { verArticulo } from '../repositories/articulos.repository.js';
import { sucursalParaMover } from '../repositories/existencias.repository.js';
import { movimientosParaKardex } from '../repositories/operaciones.repository.js';
import { CAMPO_ARTICULO, CAMPO_SUCURSAL, MODULO, NO_EXISTE, SUCURSAL_INVALIDA } from './comunes.js';
import { aKardexDto } from './operaciones-mapeo.js';

export const existenciasKardex = definirHerramienta('existencias_kardex', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver el kardex valorizado de un artículo',
    paraQueSirve: 'Recorre todos los movimientos de un artículo con su saldo, su costo promedio y el valor en soles. Sin sucursal, suma todas.',
    cuandoUsarla: 'Para saber cuánto vale lo que hay en el almacén o auditar cómo se llegó a una cantidad.',
    campos: [CAMPO_ARTICULO, CAMPO_SUCURSAL],
    ejemploTecleado: 'kardex del papel bond A4',
    ejemploHablado: 'cuánto vale el papel bond que tengo',
    erroresComunes: ['Las entradas sin costo se valorizan con el promedio vigente: el valor es una estimación (costosIncompletos).'],
    relacionadas: ['existencias_movimientos_listar', 'articulo_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const articulo = await verArticulo(tx, ctx, args.articuloId);
    if (!articulo) return rechazo('no_encontrado', NO_EXISTE);
    if (args.sucursalId && !(await sucursalParaMover(tx, ctx, args.sucursalId))) return rechazo('argumentos_invalidos', SUCURSAL_INVALIDA);
    const k = calcularKardex(await movimientosParaKardex(tx, ctx, articulo.id, args.sucursalId));
    return exito(aKardexDto({ id: articulo.id, nombre: articulo.nombre, unidad: articulo.unidad }, args.sucursalId ?? null, k));
  },
});
