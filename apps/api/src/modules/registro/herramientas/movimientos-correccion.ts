import { exito, formatearSoles, rechazo, type ErrorDeRespuesta, type LineaDeMovimientoEntrada } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { aplicarCorreccion, motivoDeCorreccion, puedeCorregirse, raizDeFamilia, referenciaDeCorreccion, type DatosCorregibles } from '../domain/correccion.js';
import { categoriaUtilizable, fechaDeMovimiento } from '../domain/movimiento.js';
import { esNombreReservado } from '../domain/transferencia.js';
import { verCategoria } from '../repositories/categorias.repository.js';
import type { Cuenta } from '../repositories/cuentas.repository.js';
import { anularMovimiento, bloquearFamiliaDeCorreccion, existeContacto, verMovimiento, type MovimientoConNombres } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe, rechazoDe } from './comun.js';
import { guardarMovimiento, resolverCuenta } from './guardar-movimiento.js';
import { aMovimientoDto, codigoDe, conReemplazo } from './mapeo.js';
import { conLineas, lineasGuardadas, montoDeLasLineas, prepararLineas } from './movimientos-lineas.js';

// Corregir un movimiento ya guardado. ADR-012: un movimiento no se edita; la corrección anula el original y registra
// uno nuevo en la misma transacción, enlazado a la raíz de su cadena de correcciones.

const NO_EXISTE = 'No existe ese movimiento.';

type Rechazo = { ok: false; error: ErrorDeRespuesta };
type Pedido = {
  id: string;
  montoCentimos?: number | undefined;
  fecha?: string | undefined;
  cuentaId?: string | undefined;
  categoriaId?: string | null | undefined;
  contactoId?: string | null | undefined;
  medioDePago?: string | undefined;
  descripcion?: string | null | undefined;
  lineas?: LineaDeMovimientoEntrada[] | undefined;
};
type Preparada = {
  ok: true;
  previo: MovimientoConNombres;
  raiz: string;
  final: DatosCorregibles;
  cambios: Array<{ texto: string }>;
  cuenta: Cuenta;
  hoy: { dia: string; anio: number };
};

const datosDe = (m: MovimientoConNombres, lineas: DatosCorregibles['lineas'] = []): DatosCorregibles => ({
  montoCentimos: m.montoCentimos,
  fecha: m.fecha,
  cuentaId: m.cuentaId,
  categoriaId: m.categoriaId,
  contactoId: m.contactoId,
  medioDePago: m.medioDePago,
  descripcion: m.descripcion,
  lineas,
});

/** Valida solo lo que cambia (lo heredado se conserva aunque hoy no se pudiera elegir); la cuenta se valida siempre. */
async function validarCambios(tx: Transaccion, ctx: ContextoDeEmpresa, previo: MovimientoConNombres, final: DatosCorregibles, hoy: string): Promise<Rechazo | { ok: true; cuenta: Cuenta }> {
  if (final.fecha !== previo.fecha) {
    const f = fechaDeMovimiento(final.fecha, hoy);
    if (!f.ok) return rechazoDe(f);
  }
  const cuenta = await resolverCuenta(tx, ctx, final.cuentaId);
  if (!cuenta.ok) return cuenta;
  if (final.categoriaId && final.categoriaId !== previo.categoriaId) {
    const categoria = await verCategoria(tx, ctx, final.categoriaId);
    if (!categoria) return rechazo('no_encontrado', 'No existe esa categoría.');
    if (esNombreReservado(categoria.nombre)) return rechazo('conflicto', 'La categoría «Transferencia» es solo de las transferencias entre cuentas.');
    const regla = categoriaUtilizable(previo.tipo as 'ingreso' | 'egreso', categoria);
    if (!regla.ok) return rechazoDe(regla);
  }
  if (final.contactoId && final.contactoId !== previo.contactoId && !(await existeContacto(tx, ctx, final.contactoId))) {
    return rechazo('no_encontrado', 'No existe ese contacto.');
  }
  return { ok: true, cuenta: cuenta.cuenta };
}

/**
 * Con productos, el monto es la suma de sus subtotales. Si llegan productos nuevos, el monto sale de ellos; si el
 * movimiento ya tenía productos y solo llega otro monto, se rechaza (el monto no puede contradecir a las líneas).
 */
async function pedidoConProductos(tx: Transaccion, ctx: ContextoDeEmpresa, previo: MovimientoConNombres, previas: DatosCorregibles['lineas'], args: Pedido): Promise<Rechazo | { ok: true; pedido: Parameters<typeof aplicarCorreccion>[1] }> {
  const { lineas: entradas, ...resto } = args;
  if (entradas === undefined) {
    if ((previas?.length ?? 0) > 0 && args.montoCentimos !== undefined && args.montoCentimos !== previo.montoCentimos) {
      return rechazo('argumentos_invalidos', 'Este movimiento tiene productos: el monto es la suma de ellos. Cambia las cantidades o los precios, o quita los productos.');
    }
    return { ok: true, pedido: resto };
  }
  const nuevas = await prepararLineas(tx, ctx, entradas, previas);
  if (!nuevas.ok) return nuevas;
  if (nuevas.lineas.length === 0) return { ok: true, pedido: { ...resto, lineas: [] } };
  const cuadra = montoDeLasLineas(args.montoCentimos, nuevas.totalCentimos);
  if (!cuadra.ok) return cuadra;
  return { ok: true, pedido: { ...resto, montoCentimos: nuevas.totalCentimos, lineas: nuevas.lineas } };
}

/** Lo común de `resumir` (sin bloquear) y `ejecutar` (bloqueando la cadena entera): leer, comprobar reglas y calcular. */
async function prepararCorreccion(tx: Transaccion, ctx: ContextoDeHerramienta, args: Pedido, bloquear: boolean): Promise<Rechazo | Preparada> {
  const propietario = propietarioDe(ctx);
  let previo = await verMovimiento(tx, ctx, args.id, propietario);
  if (!previo) return rechazo('no_encontrado', NO_EXISTE);
  const raiz = raizDeFamilia(previo);
  if (bloquear) {
    // La raíz hace de candado: corregir y restaurar sobre la misma cadena se turnan (mismo orden de bloqueo en ambas).
    await bloquearFamiliaDeCorreccion(tx, ctx, raiz);
    previo = await verMovimiento(tx, ctx, args.id, propietario);
    if (!previo) return rechazo('no_encontrado', NO_EXISTE);
  }
  const elegible = puedeCorregirse(previo);
  if (!elegible.ok) return rechazoDe(elegible);
  const previas = await lineasGuardadas(tx, ctx, previo.id);
  const pedido = await pedidoConProductos(tx, ctx, previo, previas, args);
  if (!pedido.ok) return pedido;
  const aplicado = aplicarCorreccion(datosDe(previo, previas), pedido.pedido);
  if (!aplicado.ok) return rechazoDe(aplicado);
  const hoy = await hoyDeLaEmpresa(tx);
  const valido = await validarCambios(tx, ctx, previo, aplicado.final, hoy.dia);
  if (!valido.ok) return valido;
  return { ok: true, previo, raiz, final: aplicado.final, cambios: aplicado.cambios, cuenta: valido.cuenta, hoy };
}

export const movimientoCorregir = definirHerramienta('movimiento_corregir', {
  modulo: MODULO,
  permiso: 'registro:anular',
  criticidad: 'critica',
  mueveDinero: true,
  ayuda: {
    titulo: 'Corregir un movimiento',
    paraQueSirve: 'Arregla un ingreso o egreso mal anotado (monto, fecha, cuenta, categoría, cliente o proveedor, medio de pago, descripción y los productos con su cantidad y precio). El movimiento original queda anulado en la papelera y se registra uno nuevo, con otro número, ya corregido.',
    cuandoUsarla: 'Cuando anotaste algo con un dato equivocado y quieres dejarlo bien sin anular y volver a escribir todo. Si cambia el tipo (ingreso a egreso), anúlalo y regístralo de nuevo.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador del movimiento a corregir.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'montoCentimos', queSeAnota: 'Monto correcto en céntimos (opcional: solo lo que cambia).', ejemplo: '38000' },
      { nombre: 'fecha', queSeAnota: 'Día correcto (AAAA-MM-DD, no futuro).', ejemplo: '2026-03-10' },
      { nombre: 'categoriaId', queSeAnota: 'Categoría correcta, o null para quitarla.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'contactoId', queSeAnota: 'Cliente o proveedor correcto, o null para quitarlo.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'lineas', queSeAnota: 'La lista COMPLETA de productos que debe quedar (descripcion o productoId, cantidadMilesimas, precioUnitarioMilesimas); vacía quita los productos. El monto pasa a ser la suma de sus subtotales.', ejemplo: '[]' },
      { nombre: 'motivo', queSeAnota: 'Nota opcional; el sistema ya anota qué cambió.', ejemplo: 'Me equivoqué al tipear' },
    ],
    ejemploTecleado: 'corregir MOV-2026-000123: el monto era 380 y no 350',
    ejemploHablado: 'corrige el movimiento ciento veintitrés, eran trescientos ochenta soles',
    erroresComunes: [
      'Es el abono de una deuda: se anula y se vuelve a abonar desde la deuda.',
      'Es una transferencia o nació en otro módulo: no se corrige aquí.',
      'No cambiaste nada: indica al menos un dato distinto al actual.',
    ],
    relacionadas: ['movimiento_ver', 'movimiento_anular', 'movimiento_restaurar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'movimiento', entidadId: a.id, resumen: d ? { codigo: d.anulado.codigo, codigoNuevo: d.nuevo.codigo } : undefined }),
  async resumir(args, ctx, tx) {
    const p = await prepararCorreccion(tx, ctx, args, false);
    if (!p.ok) return { ok: false, error: p.error };
    const que = p.cambios.map((c) => c.texto).join('; ');
    const resumen = `Corregirás el ${p.previo.tipo} ${codigoDe(p.previo)} de ${formatearSoles(p.previo.montoCentimos)}: ${que}. Se anula y se registra uno nuevo con otro número; el original queda en la papelera.`;
    return { ok: true, resumen: { resumen, huella: hashCanonico({ estado: p.previo.estado, ...datosDe(p.previo), final: p.final }) } };
  },
  async ejecutar(args, ctx, tx) {
    const p = await prepararCorreccion(tx, ctx, args, true);
    if (!p.ok) return p;
    const original = p.previo;
    // Primero se anula y después se guarda el nuevo: así el aviso de saldo negativo no cuenta el dinero dos veces.
    if (!(await anularMovimiento(tx, ctx, original.id, motivoDeCorreccion(p.cambios, args.motivo)))) return rechazo('conflicto', 'Ese movimiento ya está anulado.');
    await emitir(tx, 'movimiento.anulado', { id: original.id, codigo: codigoDe(original), deudaId: null });
    const r = await guardarMovimiento(tx, ctx, p.hoy.anio, p.cuenta, {
      tipo: original.tipo as 'ingreso' | 'egreso',
      fecha: p.final.fecha,
      montoCentimos: p.final.montoCentimos,
      categoriaId: p.final.categoriaId,
      contactoId: p.final.contactoId,
      medioDePago: p.final.medioDePago,
      descripcion: p.final.descripcion,
      deudaId: null,
      sucursalId: original.sucursalId,
      origen: original.origen,
      origenRef: referenciaDeCorreccion(p.raiz),
      lineas: p.final.lineas ?? [],
      // El reemplazo sigue siendo «de» quien registró el original (con alcance «propios» no deja de verlo).
      creadoPor: original.creadoPor,
    });
    const anulado = await verMovimiento(tx, ctx, original.id, null);
    if (!anulado) throw new Error('El movimiento anulado no se pudo leer.');
    const [nuevo, anuladoConLineas] = await conLineas(tx, ctx, [aMovimientoDto(r.movimiento), aMovimientoDto(anulado)]);
    return exito({ anulado: conReemplazo(anuladoConLineas!, { id: nuevo!.id, codigo: nuevo!.codigo }), nuevo: nuevo! }, { avisos: r.avisos });
  },
});
