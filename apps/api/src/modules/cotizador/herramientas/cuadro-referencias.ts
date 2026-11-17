import { exito, formatearSoles, rechazo, type ErrorDeRespuesta, type ArgsDe } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { generarReferenciasDeCuadro } from '../domain/cuadro-referencias.js';
import { evaluarReferencias, normalizarNombre, resumenDeCambioDePrecios, type EstadoDePrecios } from '../domain/lista.js';
import { asegurarConfiguracion } from '../repositories/configuracion.repository.js';
import { crearLista, editarLista, listaActivaConNombre, listaActivaDeProducto, productoVivo, verLista, type CambiosDeLista, type ListaDePrecio } from '../repositories/listas.repository.js';
import { MODULO } from './comun.js';
import { veCostos } from './cotizacion-comun.js';
import { auditarCuadro, cargarCuadroDe, ID_DE_COTIZACION } from './cuadro-comun.js';
import { configuracionVigente } from './cuadro-version.js';
import { listaADto } from './listas-respuesta.js';
import { nombreRepetido, productoYaTieneLista } from './listas-edicion.js';

// Los tres precios de referencia del cuadro (100 / 1.000 / 5.000) y su paso a la lista de precios, para que la cotización rápida los use.

export const cuadroGenerarReferencias = definirHerramienta('cuadro_generar_referencias', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Generar los tres precios de referencia',
    paraQueSirve: 'Corre el cuadro a 100, 1.000 y 5.000 unidades según la escala de cada fila y devuelve el precio sugerido del lote a cada cantidad, en céntimos y sin IGV. Los revisa: si el total no crece con la cantidad no se pueden guardar; si el unitario no baja, se avisa. El margen de cada una solo sale con permiso de costos. No guarda nada.',
    cuandoUsarla: 'Cuando el cuadro de un producto está completo y se quiere ofrecerlo por escala.',
    campos: [ID_DE_COTIZACION],
    ejemploTecleado: 'generar las referencias del cuadro de volantes',
    ejemploHablado: 'genera los precios de cien, mil y cinco mil',
    erroresComunes: ['Generarlas con el cuadro incompleto: falta la cantidad o el papel y la imposición.', 'Confundir estos precios con una cotización: son el lote completo a cada cantidad, no el unitario.'],
    relacionadas: ['cuadro_guardar_referencias', 'cuadro_calcular', 'precio_consultar'],
  },
  auditar: (a) => ({ entidadTipo: 'cotizacion', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    const c = await cargarCuadroDe(tx, ctx, args.id, { editable: false });
    if (!c.ok) return c;
    const vigente = await configuracionVigente(tx, ctx);
    const g = generarReferenciasDeCuadro(c.cuadro, vigente.motor);
    if (!g.ok) return rechazo('conflicto', g.error.mensaje);
    const { margenes, ...referencias } = g.valor;
    return exito({
      cotizacionId: c.c.id,
      referencias: { p100Centimos: referencias.p100Centimos, p1000Centimos: referencias.p1000Centimos, p5000Centimos: referencias.p5000Centimos },
      validacion: referencias.validacion,
      ...(veCostos(ctx) ? { margenes } : {}),
    });
  },
});

type Preparada = { ok: true; datos: DatosDeGuardado } | { ok: false; error: ErrorDeRespuesta };
type DatosDeGuardado = {
  actual: ListaDePrecio | null;
  nombre: string;
  unidad: string;
  productoId: string | null;
  antes: EstadoDePrecios | null;
  despues: EstadoDePrecios;
  aConfirmado: boolean;
};

const estadoDe = (l: ListaDePrecio): EstadoDePrecios => ({ p100Centimos: l.p100Centimos, p1000Centimos: l.p1000Centimos, p5000Centimos: l.p5000Centimos, modoIntermedio: l.modoIntermedio as EstadoDePrecios['modoIntermedio'], precioMinimoCentimos: l.precioMinimoCentimos });

/** La lista a la que van los precios: la indicada, la del producto o ninguna (se creará). Una sola lista por producto. */
async function destinoDe(tx: Transaccion, ctx: ContextoDeHerramienta, args: ArgsDe<'cuadro_guardar_referencias'>): Promise<{ ok: true; actual: ListaDePrecio | null; unidad: string | null } | { ok: false; error: ErrorDeRespuesta }> {
  const producto = args.productoId ? await productoVivo(tx, ctx, args.productoId) : null;
  if (args.productoId && !producto) return rechazo('no_encontrado', 'No existe ese producto o está archivado.');
  let actual: ListaDePrecio | null = null;
  if (args.listaId) {
    actual = await verLista(tx, ctx, args.listaId);
    if (!actual) return rechazo('no_encontrado', 'No existe esa lista de precios.');
    if (actual.archivadoEn) return rechazo('conflicto', 'Una lista archivada no se edita.');
    const otra = producto && producto.id !== actual.productoId ? await listaActivaDeProducto(tx, ctx, producto.id, actual.id) : null;
    if (otra) return productoYaTieneLista(otra);
  } else if (producto) {
    actual = await listaActivaDeProducto(tx, ctx, producto.id);
  }
  return { ok: true, actual, unidad: producto?.unidad.slice(0, 20) ?? null };
}

/** Lo comparten `resumir` y `ejecutar`: lo que se confirma es lo que se guarda. Solo lee. */
async function prepararGuardado(tx: Transaccion, ctx: ContextoDeHerramienta, args: ArgsDe<'cuadro_guardar_referencias'>): Promise<Preparada> {
  const c = await cargarCuadroDe(tx, ctx, args.id, { editable: false });
  if (!c.ok) return c;
  const g = generarReferenciasDeCuadro(c.cuadro, (await configuracionVigente(tx, ctx)).motor);
  if (!g.ok) return rechazo('conflicto', g.error.mensaje);
  const nombre = args.nombre ?? c.cuadro.trabajo.producto.trim();
  if (nombre === '') return rechazo('argumentos_invalidos', 'Indica el nombre de la lista (el cuadro no tiene nombre de producto).');
  const destino = await destinoDe(tx, ctx, args);
  if (!destino.ok) return destino;
  const { actual } = destino;
  const despues: EstadoDePrecios = {
    p100Centimos: g.valor.p100Centimos,
    p1000Centimos: g.valor.p1000Centimos,
    p5000Centimos: g.valor.p5000Centimos,
    modoIntermedio: args.modoIntermedio,
    precioMinimoCentimos: args.precioMinimoCentimos === undefined ? (actual?.precioMinimoCentimos ?? null) : args.precioMinimoCentimos,
  };
  const v = evaluarReferencias(despues, args.confirmarUnitarioNoBaja);
  if (!v.ok) return rechazo(v.codigo, v.mensaje);
  const otra = await listaActivaConNombre(tx, ctx, normalizarNombre(nombre), actual?.id);
  if (otra) return nombreRepetido(otra);
  return { ok: true, datos: { actual, nombre, unidad: destino.unidad ?? actual?.unidad ?? 'unidad', productoId: args.productoId ?? actual?.productoId ?? null, antes: actual ? estadoDe(actual) : null, despues, aConfirmado: v.aConfirmado } };
}

const soles = (c: number) => formatearSoles(c);

export const cuadroGuardarReferencias = definirHerramienta('cuadro_guardar_referencias', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'critica',
  idempotente: false,
  ayuda: {
    titulo: 'Guardar los precios del cuadro en la lista de precios',
    paraQueSirve: 'Pasa los tres precios de referencia del cuadro (100, 1.000 y 5.000) a la lista de precios, para cotizar rápido ese producto. Con productoId la lista queda enlazada al producto del catálogo (una lista por producto: si ya tiene una, se actualiza); con listaId se actualiza esa lista. Pide confirmación porque cambia lo que se cobra. Si el total no crece con la cantidad no se guarda; si el unitario no baja, confirma con confirmarUnitarioNoBaja.',
    cuandoUsarla: 'Después de cuadro_generar_referencias, cuando los precios están bien.',
    campos: [
      ID_DE_COTIZACION,
      { nombre: 'nombre', queSeAnota: 'Cómo se llamará la lista; por defecto, el producto del trabajo.', ejemplo: 'Volantes A5 4/4 couché 150 g' },
      { nombre: 'productoId', queSeAnota: 'Producto del catálogo al que se enlaza (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000051' },
      { nombre: 'listaId', queSeAnota: 'Una lista existente que se actualiza (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000052' },
      { nombre: 'modoIntermedio', queSeAnota: 'Entre referencias: curva (por defecto) o escalon.', ejemplo: 'curva' },
      { nombre: 'precioMinimoCentimos', queSeAnota: 'Piso del precio del lote en céntimos (opcional).', ejemplo: '25000' },
      { nombre: 'confirmarUnitarioNoBaja', queSeAnota: 'true si aceptas que el unitario no baje al subir la cantidad.', ejemplo: 'false' },
    ],
    ejemploTecleado: 'guardar los precios del cuadro como lista de volantes A5',
    ejemploHablado: 'guarda esos precios en la lista de precios',
    erroresComunes: ['El total no crece con la cantidad: corrige el cuadro.', 'El producto ya tiene una lista: se actualiza, no se crea otra.', 'Ya existe una lista con ese nombre.', 'El unitario no baja: confirma para guardarlo igual.'],
    relacionadas: ['cuadro_generar_referencias', 'lista_precio_ver', 'precio_consultar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'lista_precio', entidadId: d?.id, resumen: { cotizacionId: a.id } }),
  async resumir(args, ctx, tx) {
    const p = await prepararGuardado(tx, ctx, args);
    if (!p.ok) return p;
    const { actual, nombre, antes, despues } = p.datos;
    const d = despues;
    const resumen = actual && antes
      ? resumenDeCambioDePrecios(actual.nombre, antes, despues)
      : `Se creará la lista «${nombre}»: 100 → ${soles(d.p100Centimos)}, 1.000 → ${soles(d.p1000Centimos)}, 5.000 → ${soles(d.p5000Centimos)} (sin IGV). La cotización rápida la usará.`;
    return { ok: true, resumen: { resumen, huella: hashCanonico({ id: args.id, destino: actual?.id ?? null, antes, despues, nombre, productoId: p.datos.productoId }) } };
  },
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const p = await prepararGuardado(tx, ctx, args);
    if (!p.ok) return p;
    const { actual, nombre, unidad, productoId, despues, aConfirmado } = p.datos;
    const hoy = await hoyDeLaEmpresa(tx);
    if (actual) {
      const cambios: CambiosDeLista = { ...despues, aConfirmado, preciosFijadosEn: new Date(), ...(args.productoId ? { productoId: args.productoId } : {}) };
      return exito(await listaADto(tx, ctx, await editarLista(tx, ctx, actual.id, cambios), hoy));
    }
    const r = await crearLista(tx, ctx, { nombre, nombreNormalizado: normalizarNombre(nombre), unidad, productoId, ...despues, aConfirmado });
    return r.creada ? exito(await listaADto(tx, ctx, r.lista, hoy)) : nombreRepetido(r.existente);
  },
});
