import { CONDICIONES_VACIAS, exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { evaluarBorrador } from '../domain/cuadro-calculo.js';
import { cuadroNuevo } from '../domain/cuadro-inicial.js';
import { armarRecibo, avisosDelCuadro } from '../domain/cuadro-vista.js';
import { asegurarConfiguracion } from '../repositories/configuracion.repository.js';
import { clienteVigente, crearCotizacion } from '../repositories/cotizaciones.repository.js';
import { crearVersionDeCuadro } from '../repositories/cuadro.repository.js';
import { listarItems } from '../repositories/taller.repository.js';
import { registrarEvento, versionDe } from '../repositories/versiones.repository.js';
import { MODULO } from './comun.js';
import { veCostos } from './cotizacion-comun.js';
import { auditarCuadro, avisosVisibles, cargarCuadroDe, ID_DE_COTIZACION } from './cuadro-comun.js';
import { configuracionVigente, guardarBorrador, vistaDeVersion } from './cuadro-version.js';

// Empezar un cuadro por partes y leerlo (vista y recibo). Costos y margen solo con `cotizador:costos`.

export const cuadroIniciar = definirHerramienta('cuadro_iniciar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Empezar una cotización por partes',
    paraQueSirve: 'Abre una cotización nueva en modo cuadro: «volantes» trae las filas típicas con el costo vacío y «en_blanco» empieza sin filas. La utilidad sale de la configuración y los ítems del taller se copian al cuadro.',
    cuandoUsarla: 'Al cotizar un trabajo que no está en la lista de precios o que hay que costear fila por fila (papel, planchas, tiraje, acabados).',
    campos: [
      { nombre: 'plantilla', queSeAnota: 'Con qué filas arranca el cuadro: volantes o en_blanco (por defecto).', ejemplo: 'volantes' },
      { nombre: 'titulo', queSeAnota: 'Cómo reconoces la cotización (opcional).', ejemplo: 'Volantes de campaña' },
      { nombre: 'producto', queSeAnota: 'El nombre del producto, si ya se sabe (opcional).', ejemplo: 'Volantes A5' },
      { nombre: 'clienteId', queSeAnota: 'El cliente (obligatorio para emitir; se puede poner después con cotizacion_editar).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
    ],
    ejemploTecleado: 'nueva cotización por partes de volantes para Imprenta Sol',
    ejemploHablado: 'cotiza por partes unos volantes para Imprenta Sol',
    erroresComunes: ['El cliente no existe o está archivado.', 'Esperar que la cotización rápida (de la lista de precios) tenga cuadro: aquí se arma uno por partes.'],
    relacionadas: ['cuadro_fijar_trabajo', 'cuadro_linea_agregar', 'cuadro_calcular', 'cotizacion_emitir'],
  },
  auditar: auditarCuadro,
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const cliente = args.clienteId ? await clienteVigente(tx, ctx, args.clienteId) : null;
    if (args.clienteId && !cliente) return rechazo('argumentos_invalidos', 'El cliente no existe o está archivado.');
    const vigente = await configuracionVigente(tx, ctx);
    const items = await listarItems(tx, ctx, 'activas');
    const cuadro = cuadroNuevo({ plantilla: args.plantilla, producto: args.producto, cliente: cliente?.nombre }, vigente.motor, items);
    const id = await crearCotizacion(tx, ctx, { titulo: args.titulo ?? (args.producto || 'Cotización por partes'), clienteId: args.clienteId ?? null, notas: null });
    await crearVersionDeCuadro(
      tx, ctx, id, 1,
      { igvPorcentaje: vigente.igvPorcentaje, conOpciones: false, subtotalCentimos: 0, igvCentimos: 0, totalCentimos: 0, costoCentimos: null, margenPct: null, motivoMargenBajo: null, condiciones: { ...CONDICIONES_VACIAS }, observaciones: null },
      cuadro,
    );
    await registrarEvento(tx, ctx, id, 1, { tipo: 'creada', datos: { modo: 'cuadro' } });
    const version = await versionDe(tx, ctx, id, 1);
    const evaluado = evaluarBorrador(cuadro, vigente.motor);
    if (!version || !evaluado.ok) throw new Error('No se pudo calcular el cuadro nuevo.');
    await guardarBorrador(tx, ctx, version, evaluado.valor, vigente);
    const vista = await vistaDeVersion(tx, ctx, { ...version, entrada: evaluado.valor.cuadro }, veCostos(ctx));
    if (!vista.ok) return rechazo('conflicto', vista.mensaje);
    return exito({ cuadro: vista.vista }, { avisos: avisosVisibles(ctx, avisosDelCuadro(evaluado.valor.calculado)) });
  },
});

export const cuadroVer = definirHerramienta('cuadro_ver', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver el cuadro por partes',
    paraQueSirve: 'Devuelve el cuadro completo: el trabajo, la imposición con el papel calculado, las filas, las tres columnas (100 / 1.000 / 5.000) y el precio. Los costos, la utilidad y el margen solo salen con permiso de costos. No cambia nada.',
    cuandoUsarla: 'Para leer de vuelta lo anotado o releer una cotización ya emitida.',
    campos: [ID_DE_COTIZACION],
    ejemploTecleado: 'ver el cuadro de la cotización de Imprenta Sol',
    ejemploHablado: '¿cómo va el cuadro de Imprenta Sol?',
    erroresComunes: ['La cotización no existe o es de otra empresa.', 'La cotización es rápida, no por partes: no tiene cuadro.'],
    relacionadas: ['cuadro_calcular', 'cotizacion_ver'],
  },
  auditar: auditarCuadro,
  async ejecutar(args, ctx, tx) {
    const c = await cargarCuadroDe(tx, ctx, args.id, { editable: false });
    if (!c.ok) return c;
    const vista = await vistaDeVersion(tx, ctx, c.version, veCostos(ctx));
    if (!vista.ok) return rechazo('conflicto', vista.mensaje);
    const avisos = vista.vista.estado === 'borrador' ? avisosDelCuadro(vista.evaluado.calculado) : [];
    return exito({ cuadro: vista.vista }, { avisos: avisosVisibles(ctx, avisos) });
  },
});

export const cuadroCalcular = definirHerramienta('cuadro_calcular', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Recibo de costos del cuadro',
    paraQueSirve: 'El recibo: el precio y el unitario para cualquiera, y con permiso de costos el costo por factor, el precio sugerido, la utilidad, el margen real y el semáforo; además el desglose de pliegos (poses, pliegos de máquina y pliegos madre). No cambia nada.',
    cuandoUsarla: 'Para ver cuánto queda y qué margen deja antes de emitir.',
    campos: [ID_DE_COTIZACION],
    ejemploTecleado: 'calcular el cuadro de la cotización de Imprenta Sol',
    ejemploHablado: '¿cuánto queda y con qué margen?',
    erroresComunes: ['Esperar ver el margen sin permiso de costos: el recibo interno no se muestra.', 'Olvidar que el unitario es informativo: el total del lote es el que manda.'],
    relacionadas: ['cuadro_ver', 'cuadro_fijar_precio_final', 'cotizacion_emitir'],
  },
  auditar: (a) => ({ entidadTipo: 'cotizacion', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    const c = await cargarCuadroDe(tx, ctx, args.id, { editable: false });
    if (!c.ok) return c;
    const vista = await vistaDeVersion(tx, ctx, c.version, veCostos(ctx));
    if (!vista.ok) return rechazo('conflicto', vista.mensaje);
    const meta = { cotizacionId: c.version.cotizacionId, version: c.version.version, verCostos: veCostos(ctx) };
    const avisos = vista.vista.estado === 'borrador' ? avisosDelCuadro(vista.evaluado.calculado) : [];
    return exito(armarRecibo(vista.evaluado, meta, vista.vista), { avisos: avisosVisibles(ctx, avisos) });
  },
});
