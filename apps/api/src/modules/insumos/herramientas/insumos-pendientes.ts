import { exito, MAXIMO_DE_TARJETAS } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { tarjetasDeInsumos } from '../domain/pendientes.js';
import { articulosBajoMinimo } from '../repositories/pendientes.repository.js';
import { MODULO } from './comunes.js';

export const insumosPendientes = definirHerramienta('insumos_pendientes', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de insumos (Mi día)',
    paraQueSirve: 'Lista los insumos cuya existencia está por debajo del mínimo que fijaste, de prioridad baja.',
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
    // Se pide uno más del tope para saber si hubo más; el total exacto no hace falta para una alerta de baja prioridad.
    const filas = await articulosBajoMinimo(tx, ctx, MAXIMO_DE_TARJETAS + 1);
    const tarjetas = tarjetasDeInsumos(filas);
    return exito({ fecha: dia, tarjetas: tarjetas.slice(0, MAXIMO_DE_TARJETAS), anotaciones: [], total: tarjetas.length });
  },
});
