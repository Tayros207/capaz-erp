import { exito, rechazo, type ConteoDto, type Respuesta } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { movimientoDeAjuste } from '../domain/existencia.js';
import { verArticulo } from '../repositories/articulos.repository.js';
import { cantidadActual, sucursalParaMover } from '../repositories/existencias.repository.js';
import {
  agregarLineasDeConteo,
  anotarContada,
  anularConteo,
  articulosParaConteo,
  cerrarConteo,
  conteoAbiertoDe,
  crearConteo,
  fijarMovimientoDeLinea,
  lineasDeConteo,
  listarConteos,
  verConteo,
} from '../repositories/operaciones.repository.js';
import { CAMPO_SUCURSAL, CURSOR_INVALIDO, MODULO, SUCURSAL_INVALIDA } from './comunes.js';
import { aConteoDto, aResumenDeConteoDto } from './operaciones-mapeo.js';
import { registrarMovimiento } from './registrar-movimiento.js';

// Inventario físico: se abre con una foto de lo que dice el sistema, se cuenta y al cerrar ajusta cada diferencia con
// el mismo camino que un ajuste suelto (`registrarMovimiento`). El ajuste se calcula sobre la existencia de ese momento.

export const CLAVE_DE_CONTEO = 'insumos_conteo';
const ID = { nombre: 'id', queSeAnota: 'Identificador del inventario físico.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000050' };
const NO_EXISTE = 'No existe ese inventario físico.';
const NO_ABIERTO = 'Ese inventario físico ya no está abierto.';

async function responder(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<ConteoDto>> {
  const c = await verConteo(tx, ctx, id);
  if (!c) return rechazo('no_encontrado', NO_EXISTE);
  return exito(aConteoDto(c, await lineasDeConteo(tx, ctx, id)));
}

const auditarConteo = (_a: unknown, d: ConteoDto | null) => ({
  entidadTipo: 'conteo_de_inventario',
  entidadId: d?.id,
  ...(d && { resumen: { numero: d.numero, anio: d.anio, estado: d.estado, lineas: d.totalLineas, contadas: d.lineasContadas } }),
});

export const conteoAbrir = definirHerramienta('conteo_abrir', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Abrir un inventario físico',
    paraQueSirve: 'Prepara la hoja de conteo de una sucursal con lo que dice el sistema de cada artículo. Solo puede haber un inventario abierto por sucursal.',
    cuandoUsarla: 'Antes de contar el almacén o la tienda (fin de mes, auditoría).',
    campos: [CAMPO_SUCURSAL, { nombre: 'articuloIds', queSeAnota: 'Solo estos artículos (opcional; sin ellos entran todos los que tienen existencia).', ejemplo: '["0192f0c4-7b1e-7000-8000-000000000020"]' }, { nombre: 'nota', queSeAnota: 'Para qué es el conteo (opcional).', ejemplo: 'Cierre de marzo' }],
    ejemploTecleado: 'abrir inventario físico de Lima',
    ejemploHablado: 'vamos a contar el almacén de Lima',
    erroresComunes: ['Ya hay un inventario abierto en esa sucursal.', 'No hay artículos con existencia en esa sucursal.'],
    relacionadas: ['conteo_registrar', 'conteo_cerrar', 'conteo_anular'],
  },
  auditar: auditarConteo,
  async ejecutar(args, ctx, tx) {
    const sucursal = await sucursalParaMover(tx, ctx, args.sucursalId);
    if (!sucursal) return rechazo('argumentos_invalidos', SUCURSAL_INVALIDA);
    if (await conteoAbiertoDe(tx, ctx, sucursal.id)) return rechazo('conflicto', `Ya hay un inventario físico abierto en ${sucursal.nombre}: ciérralo o anúlalo antes de abrir otro.`);
    const articulos = await articulosParaConteo(tx, ctx, sucursal.id, args.articuloIds);
    if (articulos.length === 0) return rechazo('argumentos_invalidos', 'No hay artículos con existencia en esa sucursal.');
    if (args.articuloIds && articulos.length !== new Set(args.articuloIds).size) return rechazo('argumentos_invalidos', 'Uno de los artículos no existe o está archivado.');
    const hoy = await hoyDeLaEmpresa(tx);
    const numero = await siguienteNumero(tx, CLAVE_DE_CONTEO, { anio: hoy.anio });
    const id = await crearConteo(tx, ctx, { numero, anio: hoy.anio, sucursalId: sucursal.id, nota: args.nota || null });
    await agregarLineasDeConteo(tx, ctx, id, articulos);
    return responder(tx, ctx, id);
  },
});

export const conteoRegistrar = definirHerramienta('conteo_registrar', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anotar lo contado',
    paraQueSirve: 'Guarda las cantidades que contaste de uno o varios artículos del inventario físico abierto. Puedes volver a anotar para corregir mientras siga abierto.',
    cuandoUsarla: 'Mientras cuentas, por tandas o al terminar.',
    campos: [ID, { nombre: 'lineas', queSeAnota: 'Por línea, el artículo y lo contado en milésimas (12 = 12000).', ejemplo: '[{ "articuloId": "0192f0c4-7b1e-7000-8000-000000000020", "contadaMilesimas": 12000 }]' }],
    ejemploTecleado: 'conté 12 paquetes de papel bond',
    ejemploHablado: 'conté doce paquetes de papel bond',
    erroresComunes: ['Ese inventario ya no está abierto.', 'Ese artículo no está en este inventario.', 'Lo contado no puede ser negativo.'],
    relacionadas: ['conteo_ver', 'conteo_cerrar'],
  },
  auditar: auditarConteo,
  async ejecutar(args, ctx, tx) {
    const c = await verConteo(tx, ctx, args.id, { bloquear: true });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    if (c.estado !== 'abierto') return rechazo('conflicto', NO_ABIERTO);
    for (const l of args.lineas) {
      if (!(await anotarContada(tx, ctx, c.id, l.articuloId, l.contadaMilesimas))) return rechazo('no_encontrado', 'Uno de los artículos no está en este inventario.');
    }
    return responder(tx, ctx, c.id);
  },
});

/** Las líneas contadas y la diferencia de cada una contra lo que hay AHORA: lo que el cierre va a ajustar. */
async function diferenciasDeCierre(tx: Transaccion, ctx: ContextoDeHerramienta, conteoId: string, sucursalId: string) {
  const lineas = (await lineasDeConteo(tx, ctx, conteoId)).filter((l) => l.contadaMilesimas !== null);
  const filas = [];
  for (const l of lineas) {
    const articulo = await verArticulo(tx, ctx, l.articuloId);
    if (!articulo) continue;
    const actual = await cantidadActual(tx, ctx, l.articuloId, sucursalId);
    filas.push({ linea: l, actual, movimiento: movimientoDeAjuste(actual, l.contadaMilesimas!) });
  }
  return filas;
}

export const conteoCerrar = definirHerramienta('conteo_cerrar', {
  modulo: MODULO,
  permiso: 'insumos:ajustar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Cerrar el inventario físico',
    paraQueSirve: 'Ajusta la existencia de cada artículo contado a lo que contaste; cada diferencia queda como un ajuste en el historial. Los artículos sin contar no se tocan. Pide confirmación.',
    cuandoUsarla: 'Cuando terminaste de contar y las cantidades son las definitivas.',
    campos: [ID],
    ejemploTecleado: 'cerrar el inventario físico de Lima',
    ejemploHablado: 'ya terminé de contar, cierra el inventario',
    erroresComunes: ['No se contó ningún artículo.', 'Ese inventario ya no está abierto.', 'La existencia cambió mientras confirmabas: vuelve a pedir el cierre.'],
    relacionadas: ['conteo_registrar', 'existencia_ajustar'],
  },
  auditar: auditarConteo,
  async resumir(args, ctx, tx) {
    const c = await verConteo(tx, ctx, args.id);
    if (!c) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE } };
    if (c.estado !== 'abierto') return { ok: false, error: { codigo: 'conflicto', mensaje: NO_ABIERTO } };
    const filas = await diferenciasDeCierre(tx, ctx, c.id, c.sucursalId);
    if (filas.length === 0) return { ok: false, error: { codigo: 'conflicto', mensaje: 'No se contó ningún artículo: nada que cerrar.' } };
    const conAjuste = filas.filter((f) => f.movimiento !== null).length;
    return {
      ok: true,
      resumen: {
        resumen: `Se cerrará el inventario físico ${c.numero}-${c.anio} de ${c.sucursalCodigo}: ${filas.length} artículos contados, ${conAjuste} con diferencia que se ajustará en el historial. Los no contados no se tocan.`,
        huella: hashCanonico({ id: c.id, filas: filas.map((f) => [f.linea.articuloId, f.linea.contadaMilesimas, f.actual]) }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const c = await verConteo(tx, ctx, args.id, { bloquear: true });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    if (c.estado !== 'abierto') return rechazo('conflicto', NO_ABIERTO);
    const sucursal = await sucursalParaMover(tx, ctx, c.sucursalId);
    if (!sucursal) return rechazo('argumentos_invalidos', SUCURSAL_INVALIDA);
    const contadas = (await lineasDeConteo(tx, ctx, c.id)).filter((l) => l.contadaMilesimas !== null).sort((a, b) => a.articuloId.localeCompare(b.articuloId));
    if (contadas.length === 0) return rechazo('conflicto', 'No se contó ningún artículo: nada que cerrar.');
    let ajustes = 0;
    for (const l of contadas) {
      const articulo = await verArticulo(tx, ctx, l.articuloId, { bloquear: true });
      if (!articulo) return rechazo('no_encontrado', 'No existe uno de los artículos.');
      const r = await registrarMovimiento(tx, ctx, {
        articulo,
        sucursal,
        movimiento: (actual) => movimientoDeAjuste(actual, l.contadaMilesimas!),
        costoUnitarioMilesimas: null,
        motivo: `Inventario físico ${c.numero}-${c.anio}`,
        origen: { tipo: 'conteo', id: c.id },
      });
      if (r.ok) {
        ajustes += 1;
        await fijarMovimientoDeLinea(tx, ctx, l.id, r.movimientoId);
      } else if (r.motivo !== 'sin_cambio') return rechazo('conflicto', 'No se pudo ajustar uno de los artículos.');
    }
    await cerrarConteo(tx, ctx, c.id);
    await emitir(tx, 'conteo.cerrado', { id: c.id, sucursalId: c.sucursalId, ajustes });
    return responder(tx, ctx, c.id);
  },
});

export const conteoAnular = definirHerramienta('conteo_anular', {
  modulo: MODULO,
  permiso: 'insumos:ajustar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anular el inventario físico',
    paraQueSirve: 'Descarta un inventario físico abierto sin ajustar nada. Se queda en la lista como anulado.',
    cuandoUsarla: 'Cuando el conteo se hizo mal o ya no hace falta.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Se contó la sucursal equivocada' }],
    ejemploTecleado: 'anular el inventario físico de Lima, se contó mal',
    ejemploHablado: 'anula ese conteo, nos equivocamos de sucursal',
    erroresComunes: ['Solo se anula un inventario abierto: uno cerrado ya ajustó el historial.', 'Indica el motivo.'],
    relacionadas: ['conteo_abrir'],
  },
  auditar: auditarConteo,
  async ejecutar(args, ctx, tx) {
    const c = await verConteo(tx, ctx, args.id, { bloquear: true });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    if (c.estado !== 'abierto') return rechazo('conflicto', 'Solo se anula un inventario abierto.');
    await anularConteo(tx, ctx, c.id, args.motivo);
    return responder(tx, ctx, c.id);
  },
});

export const conteoVer = definirHerramienta('conteo_ver', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un inventario físico',
    paraQueSirve: 'Muestra la hoja de conteo: lo que decía el sistema, lo contado y la diferencia de cada artículo.',
    cuandoUsarla: 'Mientras cuentas o para revisar un conteo ya cerrado.',
    campos: [ID],
    ejemploTecleado: 'ver el inventario físico abierto de Lima',
    ejemploHablado: 'cómo va el conteo de Lima',
    erroresComunes: ['El inventario no existe o es de otra empresa.'],
    relacionadas: ['conteos_listar', 'conteo_registrar'],
  },
  async ejecutar(args, ctx, tx) {
    return responder(tx, ctx, args.id);
  },
});

export const conteosListar = definirHerramienta('conteos_listar', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar los inventarios físicos',
    paraQueSirve: 'Muestra los inventarios físicos, los más recientes primero, con cuántos artículos van contados.',
    cuandoUsarla: 'Cuando quieres ver los conteos abiertos o el historial de cierres.',
    campos: [{ nombre: 'estado', queSeAnota: 'abiertos, cerrados, anulados o todos (por defecto, todos).', ejemplo: 'abiertos' }, CAMPO_SUCURSAL],
    ejemploTecleado: 'ver los inventarios abiertos',
    ejemploHablado: 'qué conteos tengo abiertos',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['conteo_ver', 'conteo_abrir'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarConteos(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado, sucursalId: args.sucursalId });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', CURSOR_INVALIDO);
    return exito({ items: r.items.map(aResumenDeConteoDto), siguiente: r.siguiente });
  },
});
