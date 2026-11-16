import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { movimientoDeAjuste, movimientoManual, textoDeCantidad } from '../domain/existencia.js';
import { cantidadActual } from '../repositories/existencias.repository.js';
import { CAMPO_ARTICULO, CAMPO_SUCURSAL, MODULO, destinoDeMovimiento } from './comunes.js';
import { registrarMovimiento } from './registrar-movimiento.js';
import { SIN_CAMBIO, auditarMovimiento, rechazoDeMovimiento, responderMovimiento } from './respuestas.js';

export const existenciaMover = definirHerramienta('existencia_mover', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Registrar una entrada o una salida',
    paraQueSirve: 'Suma (entrada) o resta (salida) una cantidad a lo que hay de un artículo en una sucursal y lo deja en el historial. Una salida mayor a lo que hay se rechaza y dice cuánto falta.',
    cuandoUsarla: 'Cuando llega mercadería que no vino por una compra registrada, o cuando se usa o se entrega algo del almacén.',
    campos: [
      CAMPO_ARTICULO,
      CAMPO_SUCURSAL,
      { nombre: 'tipo', queSeAnota: 'entrada o salida.', ejemplo: 'salida' },
      { nombre: 'cantidadMilesimas', queSeAnota: 'Cantidad en milésimas (2.5 = 2500), siempre positiva.', ejemplo: '2500' },
      { nombre: 'motivo', queSeAnota: 'Para qué o por qué (opcional).', ejemplo: 'Pedido de la imprenta Sol' },
      { nombre: 'costoUnitarioMilesimas', queSeAnota: 'Costo por unidad en milésimas de sol, solo en entradas (opcional; informativo).', ejemplo: '12500' },
    ],
    ejemploTecleado: 'salida de 3 paquetes de papel bond A4 para el pedido de Imprenta Sol',
    ejemploHablado: 'saca tres paquetes de papel bond para el pedido de la imprenta',
    erroresComunes: ['No alcanza: la salida es mayor a lo que hay.', 'El artículo está archivado.', 'La sucursal no existe o está archivada.', 'El costo solo se anota en una entrada.'],
    relacionadas: ['existencia_ajustar', 'articulo_ver', 'existencias_movimientos_listar'],
  },
  auditar: (_a, d) => auditarMovimiento(d),
  async ejecutar(args, ctx, tx) {
    const destino = await destinoDeMovimiento(tx, ctx, args.articuloId, args.sucursalId, { bloquear: true });
    if ('error' in destino) return destino;
    const r = await registrarMovimiento(tx, ctx, {
      ...destino,
      movimiento: movimientoManual(args.tipo, args.cantidadMilesimas),
      costoUnitarioMilesimas: args.costoUnitarioMilesimas ?? null,
      motivo: args.motivo || null,
      origen: null,
    });
    if (!r.ok) return rechazoDeMovimiento(r);
    return responderMovimiento(tx, ctx, r.movimientoId);
  },
});

export const existenciaAjustar = definirHerramienta('existencia_ajustar', {
  modulo: MODULO,
  permiso: 'insumos:ajustar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Ajustar la existencia a lo contado',
    paraQueSirve: 'Fija lo que hay de un artículo en una sucursal según un conteo físico. La diferencia queda como un ajuste en el historial, con su motivo. Pide confirmación.',
    cuandoUsarla: 'Después de contar el almacén, cuando lo que hay no coincide con lo registrado (mermas, roturas, errores de registro).',
    campos: [
      CAMPO_ARTICULO,
      CAMPO_SUCURSAL,
      { nombre: 'existenciaNuevaMilesimas', queSeAnota: 'Lo que contaste, en milésimas (12 = 12000).', ejemplo: '12000' },
      { nombre: 'motivo', queSeAnota: 'Por qué no coincidía.', ejemplo: 'Conteo de fin de mes: dos paquetes mojados' },
    ],
    ejemploTecleado: 'ajustar el papel bond A4 a 12 paquetes por conteo de fin de mes',
    ejemploHablado: 'conté doce paquetes de papel bond, ajusta el inventario',
    erroresComunes: ['La existencia ya es esa cantidad: no hay nada que ajustar.', 'La existencia cambió mientras confirmabas: vuelve a pedir el ajuste.', 'Indica el motivo del ajuste.'],
    relacionadas: ['existencia_mover', 'articulo_ver'],
  },
  auditar: (_a, d) => auditarMovimiento(d),
  async resumir(args, ctx, tx) {
    const destino = await destinoDeMovimiento(tx, ctx, args.articuloId, args.sucursalId, { bloquear: false });
    if ('error' in destino) return destino;
    const { articulo, sucursal } = destino;
    const actual = await cantidadActual(tx, ctx, articulo.id, sucursal.id);
    const m = movimientoDeAjuste(actual, args.existenciaNuevaMilesimas);
    if (!m) return { ok: false, error: { codigo: 'conflicto', mensaje: SIN_CAMBIO } };
    const diferencia = `${m.cantidadMilesimas > 0 ? '+' : ''}${textoDeCantidad(m.cantidadMilesimas, articulo.unidad)}`;
    return {
      ok: true,
      resumen: {
        resumen: `La existencia de «${articulo.nombre}» en ${sucursal.nombre} pasará de ${textoDeCantidad(actual, articulo.unidad)} a ${textoDeCantidad(args.existenciaNuevaMilesimas, articulo.unidad)} (${diferencia}). El ajuste queda en el historial y no se borra.`,
        huella: hashCanonico({ articuloId: articulo.id, sucursalId: sucursal.id, actual, minimo: articulo.minimoMilesimas }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const destino = await destinoDeMovimiento(tx, ctx, args.articuloId, args.sucursalId, { bloquear: true });
    if ('error' in destino) return destino;
    const r = await registrarMovimiento(tx, ctx, {
      ...destino,
      movimiento: (actual) => movimientoDeAjuste(actual, args.existenciaNuevaMilesimas),
      costoUnitarioMilesimas: null,
      motivo: args.motivo,
      origen: null,
    });
    if (!r.ok) return rechazoDeMovimiento(r);
    return responderMovimiento(tx, ctx, r.movimientoId);
  },
});
