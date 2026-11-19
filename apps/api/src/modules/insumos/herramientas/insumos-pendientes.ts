import { exito, MAXIMO_DE_TARJETAS } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { tarjetasDeInsumos } from '../domain/pendientes.js';
import { existenciasBajoMinimo } from '../repositories/pendientes.repository.js';
import { MODULO } from './comunes.js';

const FILAS_COMO_MAXIMO = 500;

export const insumosPendientes = definirHerramienta('insumos_pendientes', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de insumos (Mi día)',
    paraQueSirve: 'Lista los insumos que en alguna sucursal quedaron por debajo del mínimo que fijaste (la misma regla que las alertas de Insumos), de prioridad baja.',
    cuandoUsarla: 'La usa el panel «Mi día»; también sirve para saber qué hay que reponer.',
    campos: [{ nombre: 'fecha', queSeAnota: 'El día que se toma como hoy (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'qué insumos están bajo el mínimo',
    ejemploHablado: 'qué me falta reponer',
    erroresComunes: ['Un artículo sin mínimo fijado no aparece.'],
    relacionadas: ['existencias_listar', 'articulo_ver'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { tarjetas: d.tarjetas.length, total: d.total } }) }),
  async ejecutar(args, ctx, tx) {
    const dia = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    // Una fila por sucursal: con el tope de filas alcanza para el tope de tarjetas aunque un artículo falte en varias.
    const tarjetas = tarjetasDeInsumos(await existenciasBajoMinimo(tx, ctx, FILAS_COMO_MAXIMO));
    return exito({ fecha: dia, tarjetas: tarjetas.slice(0, MAXIMO_DE_TARJETAS), anotaciones: [], total: tarjetas.length });
  },
});
