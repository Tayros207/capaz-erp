import { calcularTotalesDePedido, exito, rechazo, type ArgsDe, type CorreccionDePedidoDto, type FotoDeVersionDto, type EstadoDePedido } from '@capaz/shared';
import { emitir } from '../../../core/eventos/emisor.js';
import { abonadoVerificado } from '../../../core/herramientas/contexto-verificado.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import {
  aFavorDelCliente,
  avisosDeCorreccion,
  comprobarGuias,
  comprobarSoloPrecioEIgv,
  comprobarUmbralDeTrabajador,
  diferenciasDeLineas,
  esAdministrador,
  fijarTotal,
  modoDeCorreccion,
  resolverLineas,
  type LineaActual,
  type LineaResultante,
  type LineasResueltas,
} from '../domain/correccion.js';
import { codigoDePedido, comprobarFechas } from '../domain/pedido.js';
import { aplicarLineas, guardarVersion, guiasPorLinea, nombreDeCliente } from '../repositories/correccion.repository.js';
import { cantidadesEnviadas } from '../repositories/guias.repository.js';
import { actualizarPedido, lineasDe, productosPorId, registrarEvento, verPedido, type Pedido } from '../repositories/pedidos.repository.js';
import { ID, MODULO, NO_EXISTE, alcanceDePedidos, comprobarReferencias, estadoDe, responderPedido } from './comunes.js';
import { fichaNormalizada, type LineaACorregir } from '@capaz/shared';
import { fichaCorregida } from '../domain/ficha.js';

// `pedido_corregir`: la «versión 2» de un pedido confirmado. Mismo número; la versión anterior queda como foto inmutable en
// `pedido_versiones`; las líneas se actualizan EN EL SITIO por id (las guías de remisión las citan); cada corrección deja
// huella en el historial (quién, cuándo, antes → después, motivo) y emite `pedido.corregido`. Todo en una transacción.

type Args = ArgsDe<'pedido_corregir'>;
type Rechazo = ReturnType<typeof rechazo>;
type Preparada = {
  resueltas: LineasResueltas;
  resultantes: LineaResultante[];
  totales: ReturnType<typeof calcularTotalesDePedido>;
};

const aEntradas = (actuales: readonly LineaActual[]): LineaACorregir[] =>
  actuales.map((l) => ({ id: l.id, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas, afectoIgv: l.afectoIgv, productoId: l.productoId }));

/** Líneas que quedarían (con `fijarTotalCentimos` aplicado) y sus totales. */
async function prepararLineas(tx: Transaccion, ctx: ContextoDeHerramienta, actual: Pedido, actuales: readonly LineaActual[], args: Args, soloPrecio: boolean): Promise<Preparada | Rechazo> {
  const entradas = args.lineas ?? aEntradas(actuales);
  const r = resolverLineas(actuales, entradas);
  if (!r.ok) return rechazo('argumentos_invalidos', r.motivo);
  if (soloPrecio) {
    const solo = comprobarSoloPrecioEIgv(r.lineas);
    if (!solo.ok) return rechazo('conflicto', solo.motivo);
  }
  const previas = new Map(actuales.map((l) => [l.id, l.productoId]));
  const guardadas = new Map(actuales.map((l) => [l.id, l]));
  const nuevosProductos = entradas.flatMap((e) => (e.productoId && e.productoId !== (e.id ? previas.get(e.id) : null) ? [e.productoId] : []));
  const productos = await productosPorId(tx, ctx, nuevosProductos);
  for (const id of nuevosProductos) if (!productos.get(id) || productos.get(id)!.archivado) return rechazo('argumentos_invalidos', 'Un producto de las líneas no existe o está archivado.');
  let base = entradas.map((e, posicion) => ({ id: e.id ?? null, posicion, productoId: e.productoId ?? null, descripcion: e.descripcion, unidad: e.unidad, cantidadMilesimas: e.cantidadMilesimas, precioUnitarioMilesimas: e.precioUnitarioMilesimas, afectoIgv: e.afectoIgv, ...fichaCorregida(e, e.id ? guardadas.get(e.id) : undefined) }));
  try {
    if (args.fijarTotalCentimos !== undefined) {
      const repartidas = fijarTotal(base, args.fijarTotalCentimos, actual.igvPorcentaje);
      if (!repartidas) return rechazo('argumentos_invalidos', 'No se puede dejar el pedido exactamente en ese total con estas cantidades: ajusta los precios de las líneas.');
      base = repartidas;
    }
    const totales = calcularTotalesDePedido(base, actual.igvPorcentaje);
    return { resueltas: r.lineas, totales, resultantes: base.map((l, i) => ({ ...l, importeCentimos: totales.lineas[i]!.importeCentimos })) };
  } catch {
    return rechazo('argumentos_invalidos', 'El importe del pedido es demasiado grande.');
  }
}

const norm = (v: string | null | undefined): string | null => v?.trim() || null;

const versionDistinta = (esperada: number, actual: number): string =>
  `El pedido ya no es la versión ${esperada} que estabas corrigiendo: ahora es la versión ${actual} (otra corrección se guardó antes, quizá la tuya). Cierra, revisa el historial y, si hace falta, vuelve a corregir sobre lo último.`;

type Datos = CorreccionDePedidoDto['datos'];

/** `abonado`: lo que el cliente ya pagó según `venta_corregir` (`null` = no se sabe; ver `contexto-verificado.ts`). */
async function cambiosDeDatos(tx: Transaccion, ctx: ContextoDeHerramienta, actual: Pedido, args: Args, abonado: number | null): Promise<{ datos: Datos; entregaEl: string | null; notas: string | null; clienteId: string } | Rechazo> {
  const datos: Datos = [];
  const entregaEl = args.entregaEl === undefined ? actual.entregaEl : norm(args.entregaEl);
  const notas = args.notas === undefined ? actual.notas : norm(args.notas);
  if (entregaEl !== actual.entregaEl) {
    const fechas = comprobarFechas(actual.fecha, entregaEl);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    datos.push({ campo: 'entregaEl', antes: actual.entregaEl, despues: entregaEl });
  }
  if (notas !== actual.notas) datos.push({ campo: 'notas', antes: actual.notas, despues: notas });
  const clienteId = args.clienteId ?? actual.clienteId;
  if (clienteId !== actual.clienteId) {
    if (abonado === null) return rechazo('conflicto', 'El cliente solo se cambia con «Corregir venta» y sabiendo que el pedido no tiene pagos: pídelo a quien lleva Finanzas.');
    if (abonado > 0) return rechazo('conflicto', 'No se puede cambiar el cliente: el pedido ya tiene abonos. Anula los abonos o crea otro pedido.');
    const falta = await comprobarReferencias(tx, ctx, { clienteId });
    if (falta) return rechazo('argumentos_invalidos', falta);
    datos.push({ campo: 'clienteId', antes: actual.clienteId, despues: clienteId, antesEtiqueta: actual.clienteNombre, despuesEtiqueta: await nombreDeCliente(tx, ctx, clienteId) });
  }
  return { datos, entregaEl, notas, clienteId };
}

const fotoDe = (p: Pedido, lineas: readonly LineaActual[]): FotoDeVersionDto => ({
  estado: estadoDe(p),
  clienteId: p.clienteId,
  clienteNombre: p.clienteNombre,
  fecha: p.fecha,
  entregaEl: p.entregaEl,
  notas: p.notas,
  igvPorcentaje: p.igvPorcentaje,
  subtotalCentimos: p.subtotalCentimos,
  igvCentimos: p.igvCentimos,
  totalCentimos: p.totalCentimos,
  lineas: lineas.map((l) => ({ id: l.id, posicion: l.posicion, productoId: l.productoId, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas, afectoIgv: l.afectoIgv, importeCentimos: l.importeCentimos, ...fichaNormalizada(l) })),
});

async function comprobarGuiasDe(tx: Transaccion, ctx: ContextoDeHerramienta, pedidoId: string, r: LineasResueltas) {
  const [codigosPorLinea, enviadas] = [await guiasPorLinea(tx, ctx, pedidoId), await cantidadesEnviadas(tx, ctx, [pedidoId])];
  return { guias: comprobarGuias(r, { codigosPorLinea, enviadas }), hayGuias: codigosPorLinea.size > 0 };
}

export const pedidoCorregir = definirHerramienta('pedido_corregir', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Corregir un pedido confirmado (versión 2)',
    paraQueSirve: 'Cambia las líneas, los precios, el IGV, el total, la entrega, las notas o el cliente de un pedido ya confirmado. El pedido conserva su número y pasa a la versión siguiente; la anterior queda guardada tal como era. Deja constancia de quién, cuándo, qué decía antes y qué dice ahora, y por qué.',
    cuandoUsarla: 'Cuando hay que corregir un importe o una línea de un pedido confirmado (se acordó otro precio, faltó el IGV, se tecleó mal una cantidad). Para ajustar también la deuda del cliente en un solo gesto usa «Corregir venta» (venta_corregir).',
    campos: [
      ID,
      { nombre: 'motivoCodigo', queSeAnota: 'Por qué se corrige: igv, precio_acordado, cantidad, lineas, error_digitacion u otro.', ejemplo: 'precio_acordado' },
      { nombre: 'motivoTexto', queSeAnota: 'Explicación breve (obligatoria con «otro»).', ejemplo: 'El cliente negoció por volumen' },
      { nombre: 'lineas', queSeAnota: 'El pedido completo como debe quedar. Las líneas con id se actualizan; las que faltan se quitan; las sin id se agregan. El precio incluye IGV. La ficha de máquina (material, medida, colores, acabado) es opcional: si no llega, la línea conserva la suya; vacío la borra.', ejemplo: '[{ "id": "...", "descripcion": "Volantes A5", "unidad": "millar", "cantidadMilesimas": 2000, "precioUnitarioMilesimas": 55000, "afectoIgv": true }]' },
      { nombre: 'fijarTotalCentimos', queSeAnota: 'Deja el total en ese importe repartiendo el cambio entre los precios (opcional).', ejemplo: '50000' },
      { nombre: 'entregaEl', queSeAnota: 'Nuevo día de entrega, o vacío para quitarlo (opcional).', ejemplo: '2026-03-22' },
      { nombre: 'notas', queSeAnota: 'Nuevas notas, o vacío para borrarlas (opcional).', ejemplo: 'Precio acordado por teléfono' },
      { nombre: 'clienteId', queSeAnota: 'Otro cliente (solo si el pedido no tiene abonos; lo comprueba «Corregir venta»).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'versionEsperada', queSeAnota: 'La versión del pedido que tenías a la vista (pedido_ver); si cambió, se rechaza para no pisar otra corrección.', ejemplo: '1' },
    ],
    ejemploTecleado: 'corregir el pedido PED-PRI-2026-0007: el precio acordado fue 500 soles en total',
    ejemploHablado: 'el pedido siete se cobró en quinientos, corrígelo',
    erroresComunes: [
      'Un pedido en borrador se edita con pedido_editar; uno cancelado ya no se corrige.',
      'Un pedido entregado solo admite cambios de precio e IGV, y solo del dueño o un administrador.',
      'No se puede quitar una línea que ya figura en una guía de remisión, ni bajar su cantidad por debajo de lo enviado.',
      'Un trabajador corrige hasta 10 % del total y S/ 100 sin aprobación; más allá responde «requiere aprobación».',
      'El total no puede quedar en cero: para eso se cancela el pedido.',
      'Otra persona corrigió el pedido mientras tanto (ya va en otra versión): vuelve a verlo y corrige sobre lo último.',
    ],
    relacionadas: ['venta_corregir', 'pedido_editar_datos', 'pedido_ver', 'pedido_correcciones_listar'],
  },
  auditar: (a, d) => ({
    entidadTipo: 'pedido',
    entidadId: a.id,
    resumen: { motivo: a.motivoCodigo, ...(d && { codigo: d.pedido.codigo, version: d.pedido.version, totalCentimos: d.pedido.totalCentimos, deltaCentimos: d.correccion.deltaCentimos }) },
  }),
  async ejecutar(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    // Ya con el pedido bloqueado: si otra corrección se guardó antes, esta se armó sobre algo que ya no existe.
    if (actual.version !== args.versionEsperada) return rechazo('conflicto', versionDistinta(args.versionEsperada, actual.version));
    const estado: EstadoDePedido = estadoDe(actual);
    const modo = modoDeCorreccion(estado, ctx.rol);
    if (!modo.ok) return rechazo(modo.codigo, modo.motivo);
    if (modo.modo === 'solo_precio' && (args.entregaEl !== undefined || args.notas !== undefined || args.clienteId !== undefined)) {
      return rechazo('conflicto', 'En un pedido entregado solo se corrige el precio o el IGV.');
    }
    const actuales = await lineasDe(tx, ctx, actual.id);
    const prep = await prepararLineas(tx, ctx, actual, actuales, args, modo.modo === 'solo_precio');
    if (!('resueltas' in prep)) return prep;
    const abonado = abonadoVerificado(ctx);
    const datos = await cambiosDeDatos(tx, ctx, actual, args, abonado);
    if (!('datos' in datos)) return datos;
    const diferencias = diferenciasDeLineas(actuales, prep.resultantes);
    if (diferencias.length === 0 && datos.datos.length === 0) return rechazo('argumentos_invalidos', 'No hay nada que cambiar: el pedido ya era así.');
    const total = prep.totales.totalCentimos;
    if (total <= 0) return rechazo('argumentos_invalidos', 'El total no puede quedar en cero: para dejar el pedido sin valor, cancélalo.');
    const { guias, hayGuias } = await comprobarGuiasDe(tx, ctx, actual.id, prep.resueltas);
    if (!guias.ok) return rechazo('conflicto', guias.motivo);
    if (!esAdministrador(ctx.rol)) {
      const umbral = comprobarUmbralDeTrabajador({ totalAnteriorCentimos: actual.totalCentimos, totalNuevoCentimos: total, abonadoCentimos: abonado });
      if (!umbral.ok) return rechazo('requiere_aprobacion', umbral.motivo);
    }
    return aplicar(tx, ctx, actual, actuales, args, { prep, datos, hayGuias, abonado });
  },
});

async function aplicar(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  actual: Pedido,
  actuales: readonly LineaActual[],
  args: Args,
  c: { prep: Preparada; datos: { datos: Datos; entregaEl: string | null; notas: string | null; clienteId: string }; hayGuias: boolean; abonado: number | null },
) {
  const { totales } = c.prep;
  const versionNueva = actual.version + 1;
  await guardarVersion(tx, ctx, { pedidoId: actual.id, version: actual.version, foto: fotoDe(actual, actuales), motivoCodigo: args.motivoCodigo, motivoTexto: norm(args.motivoTexto) });
  const ids = await aplicarLineas(tx, ctx, actual.id, c.prep.resueltas.quitadas.map((l) => l.id), c.prep.resultantes);
  const finales = c.prep.resultantes.map((l, i) => ({ ...l, id: ids[i]! }));
  await actualizarPedido(tx, ctx, actual.id, {
    clienteId: c.datos.clienteId,
    entregaEl: c.datos.entregaEl,
    notas: c.datos.notas,
    subtotalCentimos: totales.subtotalCentimos,
    igvCentimos: totales.igvCentimos,
    totalCentimos: totales.totalCentimos,
    version: versionNueva,
  });
  const { abonado } = c;
  const correccion: CorreccionDePedidoDto = {
    versionAnterior: actual.version,
    versionNueva,
    motivoCodigo: args.motivoCodigo,
    motivoTexto: norm(args.motivoTexto),
    estadoAlCorregir: estadoDe(actual),
    totalAnteriorCentimos: actual.totalCentimos,
    totalNuevoCentimos: totales.totalCentimos,
    deltaCentimos: totales.totalCentimos - actual.totalCentimos,
    subtotalAnteriorCentimos: actual.subtotalCentimos,
    subtotalNuevoCentimos: totales.subtotalCentimos,
    igvAnteriorCentimos: actual.igvCentimos,
    igvNuevoCentimos: totales.igvCentimos,
    lineas: diferenciasDeLineas(actuales, finales),
    datos: c.datos.datos,
    abonadoCentimos: abonado,
    aFavorCentimos: abonado === null ? null : aFavorDelCliente(abonado, totales.totalCentimos),
  };
  await registrarEvento(tx, ctx, actual.id, { tipo: 'corregido', detalle: { cambios: [], motivo: correccion.motivoTexto, correccion } });
  await emitir(tx, 'pedido.corregido', {
    id: actual.id,
    codigo: codigoDePedido(actual.serie, actual.anio, actual.numero),
    clienteId: c.datos.clienteId,
    versionAnterior: actual.version,
    versionNueva,
    totalAnteriorCentimos: actual.totalCentimos,
    totalNuevoCentimos: totales.totalCentimos,
    entregaAnterior: actual.entregaEl,
    entregaNueva: c.datos.entregaEl,
  });
  const r = await responderPedido(tx, ctx, actual.id);
  if (!r.ok) return r;
  return exito({ pedido: r.datos, correccion, avisos: avisosDeCorreccion(estadoDe(actual), versionNueva, c.hayGuias) });
}
