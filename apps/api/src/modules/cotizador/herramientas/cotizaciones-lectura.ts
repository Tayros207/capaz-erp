import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { listarCotizaciones } from '../repositories/cotizaciones.repository.js';
import { resumenDeCotizaciones } from '../repositories/resumen.repository.js';
import { MODULO } from './comun.js';
import { aCotizacionDto } from './cotizacion-mapeo.js';
import { alcanceDeCotizaciones, CAMPO_ID, responderCotizacion } from './cotizacion-comun.js';

// Lecturas de cotizaciones: ver, listar y el resumen del período. No escriben.

export const cotizacionVer = definirHerramienta('cotizacion_ver', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una cotización',
    paraQueSirve: 'Muestra una cotización con sus líneas, sus totales (sin IGV, IGV y total), sus versiones y lo que le pasó. El costo y el margen solo los ve quien tiene permiso de costos.',
    cuandoUsarla: 'Cuando necesitas saber qué se cotizó a un cliente, por cuánto y en qué estado va.',
    campos: [CAMPO_ID, { nombre: 'version', queSeAnota: 'Número de versión a mostrar (opcional; por defecto la vigente).', ejemplo: '1' }],
    ejemploTecleado: 'ver la cotización COT-2026-0001',
    ejemploHablado: 'abre la cotización uno de este año',
    erroresComunes: ['La cotización no existe, es de otra empresa o no está a tu cargo.', 'Esa versión no existe.'],
    relacionadas: ['cotizaciones_listar', 'cotizacion_editar'],
  },
  ejecutar: (args, ctx, tx) => responderCotizacion(tx, ctx, args.id, args.version),
});

export const cotizacionesListar = definirHerramienta('cotizaciones_listar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar cotizaciones',
    paraQueSirve: 'Muestra las cotizaciones, de la más nueva a la más antigua, por páginas, con el total de su versión vigente.',
    cuandoUsarla: 'Cuando quieres ver qué cotizaste, lo que espera respuesta o lo de un cliente.',
    campos: [
      { nombre: 'estado', queSeAnota: 'abiertas, borrador, emitida, enviada, aceptada, rechazada, anulada o todas.', ejemplo: 'abiertas' },
      { nombre: 'clienteId', queSeAnota: 'Solo las de ese cliente (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'buscar', queSeAnota: 'Texto del título o del nombre del cliente (opcional).', ejemplo: 'volantes' },
    ],
    ejemploTecleado: 'ver las cotizaciones abiertas',
    ejemploHablado: 'qué cotizaciones están esperando respuesta',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['cotizacion_ver', 'cotizacion_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarCotizaciones(tx, ctx, alcanceDeCotizaciones(ctx), args);
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    return exito({ items: r.items.map(aCotizacionDto), siguiente: r.siguiente });
  },
});

export const cotizadorResumen = definirHerramienta('cotizador_resumen', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Resumen de cotizaciones',
    paraQueSirve: 'Cuenta las cotizaciones creadas en un período por estado, lo aceptado en esos días y las que ya vencieron sin respuesta.',
    cuandoUsarla: 'Cuando quieres saber cómo va la venta por cotización sin recorrer la lista.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período.', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período.', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'resumen de cotizaciones de marzo',
    ejemploHablado: 'cómo van las cotizaciones este mes',
    erroresComunes: ['Tu acceso es solo a tus propios registros: el resumen es de toda la empresa.', 'El período empieza antes de terminar.'],
    relacionadas: ['cotizaciones_listar'],
  },
  async ejecutar(args, ctx, tx) {
    if (alcanceDeCotizaciones(ctx) === 'propios') return rechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.');
    const hoy = await hoyDeLaEmpresa(tx);
    const r = await resumenDeCotizaciones(tx, ctx, { desde: args.desde, hasta: args.hasta, hoy: hoy.dia, zona: hoy.zona });
    return exito({ desde: args.desde, hasta: args.hasta, ...r });
  },
});
