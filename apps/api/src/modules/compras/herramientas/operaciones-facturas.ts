import { exito, rechazo, type FacturaDto, type Respuesta } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { verCompra } from '../repositories/compras.repository.js';
import { anularFactura, crearFactura, listarFacturas, totalesParaConciliar, verFactura, type Factura } from '../repositories/operaciones.repository.js';
import { MODULO, comprobarReferencias } from './comunes.js';
import { aFacturaDto } from './operaciones-mapeo.js';

const ID = { nombre: 'id', queSeAnota: 'Identificador de la factura del proveedor.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000070' };
const NO_EXISTE = 'No existe esa factura.';

const deLaOrden = (tx: Transaccion, ctx: ContextoDeHerramienta, f: Factura) => (f.ordenId ? totalesParaConciliar(tx, ctx, f.ordenId) : Promise.resolve(null));

async function responder(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<FacturaDto>> {
  const f = await verFactura(tx, ctx, id);
  if (!f) return rechazo('no_encontrado', NO_EXISTE);
  return exito(aFacturaDto(f, await deLaOrden(tx, ctx, f)));
}

const auditarFactura = (_a: unknown, d: FacturaDto | null) => ({
  entidadTipo: 'factura_de_proveedor',
  entidadId: d?.id,
  ...(d && { resumen: { comprobante: d.comprobante, totalCentimos: d.totalCentimos, conciliacion: d.conciliacion.estado } }),
});

export const facturaRegistrar = definirHerramienta('factura_registrar', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Registrar la factura de un proveedor',
    paraQueSirve: 'Anota el comprobante que mandó el proveedor y lo compara con la orden de compra y con lo que ya se recibió: te dice si cuadra o por cuánto difiere. No mueve inventario ni dinero.',
    cuandoUsarla: 'Cuando llega la factura de un proveedor, antes de pagarla.',
    campos: [
      { nombre: 'proveedorId', queSeAnota: 'Proveedor que emitió la factura.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'ordenId', queSeAnota: 'Orden de compra a la que corresponde (opcional; sin ella no se concilia).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' },
      { nombre: 'serie', queSeAnota: 'Serie del comprobante.', ejemplo: 'F001' },
      { nombre: 'numero', queSeAnota: 'Número del comprobante.', ejemplo: '1234' },
      { nombre: 'subtotalCentimos', queSeAnota: 'Base sin IGV, en céntimos.', ejemplo: '10000' },
      { nombre: 'igvCentimos', queSeAnota: 'IGV, en céntimos.', ejemplo: '1800' },
    ],
    ejemploTecleado: 'factura F001-1234 de Papelera Andina por 118.00 contra la orden OC-PRI-2026-0001',
    ejemploHablado: 'registra la factura F001 1234 de Papelera Andina por ciento dieciocho soles',
    erroresComunes: ['Ya registraste ese comprobante de ese proveedor.', 'La orden es de otro proveedor.', 'El proveedor no existe o está archivado.', 'El vencimiento no puede ser anterior a la fecha.'],
    relacionadas: ['factura_ver', 'compra_ver', 'facturas_listar'],
  },
  auditar: auditarFactura,
  async ejecutar(args, ctx, tx) {
    const falta = await comprobarReferencias(tx, ctx, { proveedorId: args.proveedorId });
    if (falta) return rechazo('argumentos_invalidos', falta);
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    if (args.venceEl && args.venceEl < fecha) return rechazo('argumentos_invalidos', 'El vencimiento no puede ser anterior a la fecha de la factura.');
    if (args.ordenId) {
      const orden = await verCompra(tx, ctx, args.ordenId, { alcance: 'todos' });
      if (!orden) return rechazo('no_encontrado', 'No existe esa orden de compra.');
      if (orden.proveedorId !== args.proveedorId) return rechazo('argumentos_invalidos', 'La orden es de otro proveedor.');
    }
    const id = await crearFactura(tx, ctx, {
      proveedorId: args.proveedorId,
      ordenId: args.ordenId ?? null,
      serie: args.serie.toUpperCase(),
      numero: args.numero,
      fecha,
      venceEl: args.venceEl ?? null,
      moneda: args.moneda,
      subtotalCentimos: args.subtotalCentimos,
      igvCentimos: args.igvCentimos,
      totalCentimos: args.subtotalCentimos + args.igvCentimos,
      notas: args.notas || null,
    });
    if (!id) return rechazo('conflicto', 'Ya registraste ese comprobante de ese proveedor.');
    const r = await responder(tx, ctx, id);
    if (r.ok && 'datos' in r) await emitir(tx, 'factura.registrada', { id, proveedorId: args.proveedorId, totalCentimos: r.datos.totalCentimos, conciliacion: r.datos.conciliacion.estado });
    return r;
  },
});

export const facturaAnular = definirHerramienta('factura_anular', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anular una factura de proveedor',
    paraQueSirve: 'Marca la factura como anulada con su motivo; el comprobante queda libre para registrarse de nuevo.',
    cuandoUsarla: 'Cuando se cargó por error o el proveedor la dio de baja.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Se registró con el monto equivocado' }],
    ejemploTecleado: 'anular la factura F001-1234, estaba mal el monto',
    ejemploHablado: 'anula esa factura del proveedor',
    erroresComunes: ['La factura ya está anulada.', 'Indica el motivo.'],
    relacionadas: ['factura_registrar', 'facturas_listar'],
  },
  auditar: auditarFactura,
  async ejecutar(args, ctx, tx) {
    const f = await verFactura(tx, ctx, args.id, { bloquear: true });
    if (!f) return rechazo('no_encontrado', NO_EXISTE);
    if (f.anuladoEn) return rechazo('conflicto', 'Esa factura ya está anulada.');
    await anularFactura(tx, ctx, f.id, args.motivo);
    return responder(tx, ctx, f.id);
  },
});

export const facturaVer = definirHerramienta('factura_ver', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una factura de proveedor',
    paraQueSirve: 'Muestra el comprobante, sus montos y cómo cuadra con la orden y con lo recibido.',
    cuandoUsarla: 'Antes de pagar o para revisar una diferencia.',
    campos: [ID],
    ejemploTecleado: 'ver la factura F001-1234',
    ejemploHablado: 'cuadra la factura de Papelera Andina',
    erroresComunes: ['La factura no existe o es de otra empresa.'],
    relacionadas: ['facturas_listar'],
  },
  async ejecutar(args, ctx, tx) {
    return responder(tx, ctx, args.id);
  },
});

export const facturasListar = definirHerramienta('facturas_listar', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las facturas de proveedores',
    paraQueSirve: 'Muestra las facturas registradas, las más recientes primero, con su conciliación. Se puede filtrar por proveedor u orden.',
    cuandoUsarla: 'Para revisar qué se facturó y qué difiere de lo pedido o recibido.',
    campos: [{ nombre: 'proveedorId', queSeAnota: 'Solo de este proveedor (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' }, { nombre: 'ordenId', queSeAnota: 'Solo de esta orden (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' }, { nombre: 'estado', queSeAnota: 'vigentes, anuladas o todas.', ejemplo: 'vigentes' }],
    ejemploTecleado: 'facturas de Papelera Andina',
    ejemploHablado: 'qué facturas tengo de Papelera Andina',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['factura_ver', 'factura_registrar'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarFacturas(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado, proveedorId: args.proveedorId, ordenId: args.ordenId });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const items = [];
    for (const f of r.items) items.push(aFacturaDto(f, await deLaOrden(tx, ctx, f)));
    return exito({ items, siguiente: r.siguiente });
  },
});
