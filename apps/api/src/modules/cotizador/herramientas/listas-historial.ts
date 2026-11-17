import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { codigoDeCotizacion } from '../domain/cotizacion.js';
import type { EstadoDeCotizacion } from '../domain/estados.js';
import { verLista } from '../repositories/listas.repository.js';
import { historialDeLista } from '../repositories/listas-origen.repository.js';
import { alcanceDeCotizaciones } from './cotizacion-comun.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { listaADto } from './listas-respuesta.js';

export const listaPrecioHistorial = definirHerramienta('lista_precio_historial', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Historial de un producto de la lista',
    paraQueSirve: 'Muestra de qué cotización por partes salieron sus precios y en qué cotizaciones se usó, de la más reciente a la más antigua.',
    cuandoUsarla: 'Antes de cambiar un precio, para saber a quién se le cotizó y de dónde salió.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador de la lista.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'limite', queSeAnota: 'Cuántas cotizaciones por página, hasta 50 (opcional).', ejemplo: '20' },
    ],
    ejemploTecleado: 'a quién le cotizamos los volantes A5',
    ejemploHablado: 'dónde usamos el precio de los volantes',
    erroresComunes: ['La lista no existe o es de otra empresa.', 'El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['lista_precio_ver', 'cotizacion_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const lista = await verLista(tx, ctx, args.id);
    if (!lista) return rechazo('no_encontrado', 'No existe esa lista de precios.');
    const r = await historialDeLista(tx, ctx, alcanceDeCotizaciones(ctx), lista.id, { limite: args.limite, ...(args.cursor && { cursor: args.cursor }) });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const { origen } = await listaADto(tx, ctx, lista, await hoyDeLaEmpresa(tx));
    return exito({
      origen,
      items: r.items.map((f) => ({
        cotizacionId: f.cotizacionId,
        codigo: codigoDeCotizacion(f.numero, f.anio, f.version),
        titulo: f.titulo,
        estado: f.estado as EstadoDeCotizacion,
        clienteNombre: f.clienteNombre,
        version: f.version,
        fecha: f.fecha.toISOString(),
        cantidadMilesimas: f.cantidadMilesimas,
        precioUnitarioMilesimas: f.precioUnitarioMilesimas,
        importeCentimos: f.importeCentimos,
      })),
      siguiente: r.siguiente,
    });
  },
});
