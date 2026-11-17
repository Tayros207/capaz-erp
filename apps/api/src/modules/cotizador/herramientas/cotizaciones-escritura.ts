import { CONDICIONES_VACIAS, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { esEditable, type EstadoDeCotizacion } from '../domain/estados.js';
import { margenDe } from '../domain/margen.js';
import { asegurarConfiguracion } from '../repositories/configuracion.repository.js';
import { actualizarCotizacion, crearCotizacion, verCotizacion } from '../repositories/cotizaciones.repository.js';
import { actualizarVersion, crearVersion, lineasDe, registrarEvento, reemplazarLineas, versionDe } from '../repositories/versiones.repository.js';
import { MODULO } from './comun.js';
import { alcanceDeCotizaciones, auditarCotizacion, calcularLineas, CAMPO_ID, comprobarReferencias, entradasDe, NO_EXISTE, responderCotizacion, veCostos } from './cotizacion-comun.js';

// Crear y editar (solo en borrador). El servidor recalcula el precio de cada línea de lista: no confía en la pantalla.

const SIN_COSTOS = 'Para anotar el costo necesitas el permiso de costos.';
const CAMPO_LINEAS = {
  nombre: 'lineas',
  queSeAnota: 'De 1 a 100 líneas: de la lista (listaId y cantidad en milésimas; el servidor calcula el precio) o manuales (descripción, cantidad y precio unitario sin IGV).',
  ejemplo: '[{ "tipo": "lista", "listaId": "0192f0c4-7b1e-7000-8000-000000000001", "cantidadMilesimas": 2500000 }]',
};

export const cotizacionCrear = definirHerramienta('cotizacion_crear', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear una cotización',
    paraQueSirve: 'Abre una cotización en borrador con sus líneas; los precios van sin IGV y el IGV se calcula por línea. Todavía no tiene número: lo recibe al emitirla.',
    cuandoUsarla: 'Cuando un cliente pide precio y quieres dejarlo anotado, con lo que se cotizó.',
    campos: [
      { nombre: 'titulo', queSeAnota: 'Cómo la reconoces.', ejemplo: 'Volantes para la campaña de marzo' },
      { nombre: 'clienteId', queSeAnota: 'Cliente (obligatorio para emitirla; si lo pones, se aplica su ajuste de precio).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      CAMPO_LINEAS,
      { nombre: 'conOpciones', queSeAnota: 'true si las líneas son alternativas (el documento no suma un total general).', ejemplo: 'false' },
      { nombre: 'costoCentimos', queSeAnota: 'Costo en céntimos (opcional; solo con permiso de costos).', ejemplo: '22515' },
    ],
    ejemploTecleado: 'cotizar 2500 volantes A5 a Imprenta Sol',
    ejemploHablado: 'hazle una cotización a Imprenta Sol de dos mil quinientos volantes a cinco',
    erroresComunes: ['El cliente no existe o está archivado.', 'Línea 1: la cantidad está fuera de 100 a 5.000 unidades: hay que cotizar aparte.', 'Para anotar el costo necesitas el permiso de costos.'],
    relacionadas: ['precio_consultar', 'cotizacion_editar', 'cotizacion_emitir'],
  },
  auditar: auditarCotizacion,
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    if (args.costoCentimos != null && !veCostos(ctx)) return rechazo('sin_permiso', SIN_COSTOS);
    const falta = await comprobarReferencias(tx, ctx, args);
    if (falta) return rechazo('argumentos_invalidos', falta);
    const calc = await calcularLineas(tx, ctx, args.lineas, args.clienteId ?? null);
    if ('error' in calc) return calc;
    const id = await crearCotizacion(tx, ctx, { titulo: args.titulo, clienteId: args.clienteId ?? null, notas: args.notas || null });
    const costoCentimos = args.costoCentimos ?? null;
    const versionId = await crearVersion(tx, ctx, id, 1, {
      igvPorcentaje: calc.igvPorcentaje,
      conOpciones: args.conOpciones,
      ...calc.totales,
      costoCentimos,
      margenPct: margenDe(calc.totales.subtotalCentimos, costoCentimos),
      motivoMargenBajo: null,
      condiciones: { ...CONDICIONES_VACIAS, ...args.condiciones },
      observaciones: args.observaciones || null,
    });
    await reemplazarLineas(tx, ctx, versionId, calc.lineas);
    await registrarEvento(tx, ctx, id, 1, { tipo: 'creada' });
    return responderCotizacion(tx, ctx, id);
  },
});

export const cotizacionEditar = definirHerramienta('cotizacion_editar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar una cotización en borrador',
    paraQueSirve: 'Cambia el título, el cliente, las líneas, las condiciones, las notas o el costo de un borrador. Si envías líneas, reemplazan a todas las anteriores y se recalculan los precios.',
    cuandoUsarla: 'Mientras la cotización no está emitida. Una emitida no se edita: se hace una nueva versión.',
    campos: [CAMPO_ID, CAMPO_LINEAS, { nombre: 'clienteId', queSeAnota: 'Nuevo cliente (null para quitarlo). Las líneas de lista se recalculan con su ajuste.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' }],
    ejemploTecleado: 'cambiar la cotización de Imprenta Sol a 3000 volantes',
    ejemploHablado: 'en la cotización de Imprenta Sol pon tres mil volantes',
    erroresComunes: ['Solo se edita una cotización en borrador.', 'Hay que indicar al menos un dato.', 'La lista de precios de una línea está archivada.'],
    relacionadas: ['cotizacion_ver', 'cotizacion_emitir', 'cotizacion_nueva_version'],
  },
  auditar: (a, d) => ({
    ...auditarCotizacion(a, d),
    entidadId: a.id,
    resumen: { campos: Object.keys(a).filter((k) => k !== 'id' && a[k as keyof typeof a] !== undefined).sort().join(','), ...(d && { totalCentimos: d.totalCentimos }) },
  }),
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const c = await verCotizacion(tx, ctx, args.id, { alcance: alcanceDeCotizaciones(ctx), bloquear: true });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    if (!esEditable(c.estado as EstadoDeCotizacion)) return rechazo('conflicto', 'Solo se edita una cotización en borrador.');
    if (args.costoCentimos !== undefined && !veCostos(ctx)) return rechazo('sin_permiso', SIN_COSTOS);
    const falta = await comprobarReferencias(tx, ctx, args);
    if (falta) return rechazo('argumentos_invalidos', falta);
    const version = await versionDe(tx, ctx, c.id, c.versionActual);
    if (!version) throw new Error('La cotización no tiene su versión vigente.');
    const actuales = await lineasDe(tx, ctx, version.id);
    const clienteId = args.clienteId !== undefined ? args.clienteId : c.clienteId;
    const cambiaCliente = args.clienteId !== undefined && args.clienteId !== c.clienteId;
    const recalcular = args.lineas !== undefined || (cambiaCliente && actuales.some((l) => l.origenPrecio === 'lista'));
    const calc = recalcular ? await calcularLineas(tx, ctx, args.lineas ?? entradasDe(actuales), clienteId) : null;
    if (calc && 'error' in calc) return calc;
    const costoCentimos = args.costoCentimos !== undefined ? args.costoCentimos : version.costoCentimos;
    const subtotal = calc ? calc.totales.subtotalCentimos : version.subtotalCentimos;
    await actualizarVersion(tx, ctx, version.id, {
      ...(calc && { igvPorcentaje: calc.igvPorcentaje, ...calc.totales }),
      ...(args.conOpciones !== undefined && { conOpciones: args.conOpciones }),
      ...(args.observaciones !== undefined && { observaciones: args.observaciones || null }),
      ...(args.condiciones && { condiciones: { ...version.condiciones as object, ...args.condiciones } }),
      costoCentimos,
      margenPct: margenDe(subtotal, costoCentimos),
      motivoMargenBajo: null,
    });
    if (calc) await reemplazarLineas(tx, ctx, version.id, calc.lineas);
    await actualizarCotizacion(tx, ctx, c.id, {
      ...(args.titulo !== undefined && { titulo: args.titulo }),
      ...(args.clienteId !== undefined && { clienteId: args.clienteId }),
      ...(args.notas !== undefined && { notas: args.notas || null }),
    });
    await registrarEvento(tx, ctx, c.id, version.version, { tipo: 'editada' });
    return responderCotizacion(tx, ctx, c.id);
  },
});
