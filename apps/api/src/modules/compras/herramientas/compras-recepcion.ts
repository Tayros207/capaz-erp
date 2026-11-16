import { rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { comprobarRecepcion } from '../domain/estados.js';
import { codigoDeOrden } from '../domain/orden.js';
import { comprobarFechaDeRecepcion, prepararRecepcion } from '../domain/recepcion.js';
import { actualizarCompra, lineasDe, verCompra } from '../repositories/compras.repository.js';
import { registrarRecepcion } from '../repositories/recepciones.repository.js';
import { ID, MODULO, NO_EXISTE, alcanceDeCompras, estadoDe, responderCompra } from './comunes.js';

// Recepción total o parcial. Con la orden bloqueada se leen sus líneas, se comprueba que nada pase de
// lo pendiente, se guarda la recepción (no se edita después), se suma lo recibido y se emite
// `compra.recibida` por lo recibido en ESTA recepción; todo en la misma transacción.

export const compraRecibir = definirHerramienta('compra_recibir', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Registrar lo que llegó de una orden de compra',
    paraQueSirve: 'Anota lo que entregó el proveedor, todo o una parte, línea por línea. Cuando llega todo, la orden queda recibida. Inventario y Finanzas reciben una propuesta para aprobar.',
    cuandoUsarla: 'Cuando el proveedor entrega mercadería de una orden enviada.',
    campos: [
      ID,
      { nombre: 'lineas', queSeAnota: 'Por cada línea de la orden que llegó, su identificador y la cantidad recibida en milésimas.', ejemplo: '[{ "ordenLineaId": "0192f0c4-7b1e-7000-8000-000000000021", "cantidadMilesimas": 4000 }]' },
      { nombre: 'fecha', queSeAnota: 'Día en que llegó (opcional; por defecto hoy).', ejemplo: '2026-03-14' },
      { nombre: 'nota', queSeAnota: 'Observación de la entrega (opcional).', ejemplo: 'Llegaron dos cajas abiertas' },
    ],
    ejemploTecleado: 'recibir 4 millares de papel de la orden OC-PRI-2026-0001',
    ejemploHablado: 'llegaron cuatro millares de papel de la orden de compra uno',
    erroresComunes: ['No se recibe más de lo que falta de cada línea.', 'Primero envía la orden al proveedor; después registra lo que llega.', 'La recepción no puede tener una fecha futura.'],
    relacionadas: ['compra_ver', 'compra_enviar'],
  },
  auditar: (a, d) => ({
    entidadTipo: 'compra',
    entidadId: a.id,
    ...(d && { resumen: { codigo: d.codigo, estado: d.estado, recepcion: d.recepciones.at(-1)?.numero ?? 0, importeCentimos: d.recepciones.at(-1)?.importeCentimos ?? 0 } }),
  }),
  async ejecutar(args, ctx, tx) {
    const actual = await verCompra(tx, ctx, args.id, { alcance: alcanceDeCompras(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const paso = comprobarRecepcion(estadoDe(actual));
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    const f = comprobarFechaDeRecepcion(actual.fecha, fecha, hoy.dia);
    if (!f.ok) return rechazo('argumentos_invalidos', f.motivo);
    const p = prepararRecepcion(await lineasDe(tx, ctx, actual.id), args.lineas);
    if (!p.ok) return rechazo(p.codigo, p.motivo);
    const recepcion = await registrarRecepcion(tx, ctx, actual.id, { fecha, nota: args.nota || null }, p.lineas);
    await actualizarCompra(tx, ctx, actual.id, { estado: p.estadoNuevo });
    await emitir(tx, 'compra.recibida', {
      ordenId: actual.id,
      recepcionId: recepcion.id,
      numero: codigoDeOrden(actual.serie, actual.anio, actual.numero),
      proveedorId: actual.proveedorId,
      totalRecibidoCentimos: p.totalRecibidoCentimos,
      lineas: p.lineas.map((l) => ({ productoId: l.productoId, cantidadMilesimas: l.cantidadMilesimas, costoUnitarioMilesimas: l.costoUnitarioMilesimas })),
    });
    return responderCompra(tx, ctx, actual.id);
  },
});
