import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { CONFIGURACION_POR_DEFECTO } from '../domain/configuracion.js';
import { cotizarDesdeLista, escalonDe, esEstimacion, tablaDePrecios, type RedondeoComercial } from '../domain/precios.js';
import { ajusteDe } from '../repositories/ajustes.repository.js';
import { leerConfiguracion } from '../repositories/configuracion.repository.js';
import { verLista } from '../repositories/listas.repository.js';
import { ID_DE_EJEMPLO, MODULO, rechazoDe } from './comun.js';

// `precio_consultar`: el precio de cualquier cantidad (100 a 5.000) con la lista, el ajuste del cliente y el redondeo. No escribe.

export const precioConsultar = definirHerramienta('precio_consultar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Consultar un precio',
    paraQueSirve: 'Calcula lo que se cobra por una cantidad: la lista, el ajuste del cliente, el redondeo comercial y el ajuste de esta cotización. Muestra importe sin IGV, IGV y total, y la tabla de precios a las cantidades frecuentes (100 a 5.000).',
    cuandoUsarla: 'Para dar un precio al instante, sin crear ninguna cotización.',
    campos: [
      { nombre: 'listaId', queSeAnota: 'El producto de la lista.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'cantidadMilesimas', queSeAnota: 'Cantidad en milésimas: 2.500 unidades son 2500000.', ejemplo: '2500000' },
      { nombre: 'clienteId', queSeAnota: 'Cliente cuyo ajuste se aplica (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'conIgv', queSeAnota: 'true para calcular con IGV (se factura); false para calcular sin IGV. Sin dato, el IGV de la configuración.', ejemplo: 'false' },
      { nombre: 'ajuste', queSeAnota: 'ninguno, precio (fija el importe) o monto (suma o resta), solo para esta consulta.', ejemplo: '{"tipo":"ninguno"}' },
    ],
    ejemploTecleado: 'cuánto cuestan 2500 volantes A5',
    ejemploHablado: 'dame el precio de dos mil quinientos volantes a cinco',
    erroresComunes: ['Fuera de 100 a 5.000 unidades hay que cotizar aparte.', 'La lista está archivada.', 'El precio final debe ser mayor que cero.'],
    relacionadas: ['listas_precio_listar', 'ajuste_cliente_fijar', 'cotizador_configurar'],
  },
  async ejecutar(args, ctx, tx) {
    const lista = await verLista(tx, ctx, args.listaId);
    if (!lista) return rechazo('no_encontrado', 'No existe esa lista de precios.');
    if (lista.archivadoEn) return rechazo('conflicto', `La lista «${lista.nombre}» está archivada.`);
    const config = await leerConfiguracion(tx, ctx);
    const redondeo = (config?.redondeoComercial ?? CONFIGURACION_POR_DEFECTO.redondeoComercial) as RedondeoComercial;
    const igvPorcentaje = args.conIgv === undefined ? (config?.igvPorcentaje ?? CONFIGURACION_POR_DEFECTO.igvPorcentaje) : args.conIgv ? 18 : 0;
    const ajusteCliente = args.clienteId ? await ajusteDe(tx, ctx, args.clienteId) : null;
    const paraCotizar = { ...lista, modoIntermedio: lista.modoIntermedio as 'curva' | 'escalon' };
    const base = { ajusteClientePct: ajusteCliente?.porcentaje ?? null, redondeo, igvPorcentaje };
    const r = cotizarDesdeLista(paraCotizar, { ...base, cantidadMilesimas: args.cantidadMilesimas, ajuste: args.ajuste });
    if (!r.ok) return rechazoDe(r);
    return exito({
      listaId: lista.id,
      nombre: lista.nombre,
      unidad: lista.unidad,
      cantidadMilesimas: args.cantidadMilesimas,
      ...r.valor,
      redondeoComercial: redondeo,
      igvPorcentaje,
      tabla: tablaDePrecios(paraCotizar, base),
      estimacion: esEstimacion(args.cantidadMilesimas),
      escalon: escalonDe(paraCotizar.modoIntermedio, args.cantidadMilesimas),
    });
  },
});
