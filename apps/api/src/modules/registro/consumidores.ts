import { EVENTOS, formatearSoles } from '@capaz/shared';
import { and, eq } from 'drizzle-orm';
import { proponerBorrador } from '../../core/borradores/proponer.js';
import { borradores } from '../../db/esquema/core-automatizaciones.js';
import type { Consumidor } from '../../core/eventos/tipos.js';
import { normalizarNombre } from './domain/catalogos.js';
import { categoriaConNombre } from './repositories/categorias.repository.js';
import { deudaVivaPorOrigen } from './repositories/deudas.repository.js';

// Consumidores de eventos de otros módulos (ficha §4.5). Regla R5: un consumidor NUNCA ejecuta herramientas ni
// escribe en las tablas del módulo; solo lee sus propias tablas y PROPONE un borrador. El dinero lo confirma una
// persona en la bandeja. Aquí no se importa el ejecutor.

/** El tipo de origen con el que una deuda recuerda el pedido del que nació (par blando, sin llave foránea: R6). */
const ORIGEN_PEDIDO = 'pedido';
/** Ídem para la recepción de una compra (la deuda por pagar nace al recibir, por lo recibido: P3-4). */
const ORIGEN_COMPRA = 'compra';

/** Un pedido confirmado con importe propone su cuenta por cobrar, salvo que ya exista una deuda viva de ese pedido. */
export const registroPedidoConfirmado: Consumidor = {
  nombre: 'registro_pedido_confirmado',
  modulo: 'registro',
  evento: 'pedido.confirmado',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['pedido.confirmado'].parse(e.carga);
    if (carga.totalCentimos <= 0) return;
    if (await deudaVivaPorOrigen(tx, ctx, ORIGEN_PEDIDO, carga.id)) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_crear',
      args: {
        tipo: 'por_cobrar',
        contactoId: carga.clienteId,
        concepto: `Pedido ${carga.codigo}`,
        totalCentimos: carga.totalCentimos,
        venceEn: carga.entregaEl ?? undefined,
        origenTipo: ORIGEN_PEDIDO,
        origenId: carga.id,
      },
      resumen: `Cobrar ${formatearSoles(carga.totalCentimos)} por el pedido ${carga.codigo}`,
      origen: 'modulo',
      origenRef: `pedido:${carga.id}`,
      propuestoPor: 'sistema',
    });
  },
};

/** Un pedido cancelado propone anular su deuda viva, con prioridad alta. Sin deuda viva no hace nada. */
export const registroPedidoCancelado: Consumidor = {
  nombre: 'registro_pedido_cancelado',
  modulo: 'registro',
  evento: 'pedido.cancelado',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['pedido.cancelado'].parse(e.carga);
    const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PEDIDO, carga.id);
    if (!viva) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_anular',
      args: { id: viva.id, motivo: `Pedido ${carga.codigo} cancelado` },
      resumen: `Anular la deuda del pedido ${carga.codigo}, que fue cancelado`,
      origen: 'modulo',
      origenRef: `pedido:${carga.id}`,
      prioridad: 'alta',
      propuestoPor: 'sistema',
    });
  },
};

/** Un pedido entregado con saldo pendiente propone cobrarlo. Sin deuda viva, sin saldo o con un cobro ya propuesto no hace nada. */
export const registroPedidoEntregado: Consumidor = {
  nombre: 'registro_pedido_entregado',
  modulo: 'registro',
  evento: 'pedido.entregado',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['pedido.entregado'].parse(e.carga);
    const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PEDIDO, carga.id);
    if (!viva) return;
    const saldo = viva.totalCentimos - viva.abonadoCentimos;
    if (saldo <= 0) return;
    // Solo lectura: un cobro del saldo aún pendiente en la bandeja no se vuelve a proponer.
    const [pendiente] = await tx
      .select({ id: borradores.id })
      .from(borradores)
      .where(and(eq(borradores.tenantId, ctx.empresaId), eq(borradores.herramienta, 'deuda_abonar'), eq(borradores.origenRef, `pedido:${carga.id}`), eq(borradores.estado, 'pendiente')))
      .limit(1);
    if (pendiente) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_abonar',
      args: { id: viva.id, montoCentimos: saldo },
      resumen: `Cobrar el saldo de ${formatearSoles(saldo)} del pedido ${carga.codigo}`,
      origen: 'modulo',
      origenRef: `pedido:${carga.id}`,
      propuestoPor: 'sistema',
    });
  },
};

/** Una compra recibida con importe propone su cuenta por pagar por lo recibido; el origen es la recepción, así no se duplica. */
export const registroCompraRecibida: Consumidor = {
  nombre: 'registro_compra_recibida',
  modulo: 'registro',
  evento: 'compra.recibida',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['compra.recibida'].parse(e.carga);
    if (carga.totalRecibidoCentimos <= 0) return;
    if (await deudaVivaPorOrigen(tx, ctx, ORIGEN_COMPRA, carga.recepcionId)) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_crear',
      args: {
        tipo: 'por_pagar',
        contactoId: carga.proveedorId,
        concepto: `Compra ${carga.numero}`,
        totalCentimos: carga.totalRecibidoCentimos,
        origenTipo: ORIGEN_COMPRA,
        origenId: carga.recepcionId,
      },
      resumen: `Pagar ${formatearSoles(carga.totalRecibidoCentimos)} por la compra ${carga.numero}`,
      origen: 'modulo',
      origenRef: `compra:${carga.recepcionId}`,
      propuestoPor: 'sistema',
    });
  },
};

/** Un adelanto de sueldo propone un egreso en «Sueldos». El colaborador no viaja: solo el id del adelanto en `origenRef`. */
export const registroAdelantoRegistrado: Consumidor = {
  nombre: 'registro_adelanto_registrado',
  modulo: 'registro',
  evento: 'adelanto.registrado',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['adelanto.registrado'].parse(e.carga);
    if (carga.montoCentimos <= 0) return;
    // Lee su propia tabla; si la empresa borró o archivó «Sueldos», el borrador va sin categoría y la persona la elige.
    const sueldos = await categoriaConNombre(tx, ctx, 'egreso', normalizarNombre('Sueldos'));
    await proponerBorrador(tx, {
      herramienta: 'movimiento_registrar',
      args: {
        tipo: 'egreso',
        montoCentimos: carga.montoCentimos,
        fecha: carga.fecha,
        categoriaId: sueldos?.id,
        descripcion: 'Adelanto de sueldo',
        origen: 'modulo',
        origenRef: `adelanto:${carga.adelantoId}`,
      },
      resumen: `Registrar el egreso de ${formatearSoles(carga.montoCentimos)} por un adelanto de sueldo`,
      origen: 'modulo',
      origenRef: `adelanto:${carga.adelantoId}`,
      propuestoPor: 'sistema',
    });
  },
};

export const CONSUMIDORES_DE_REGISTRO: readonly Consumidor[] = [registroPedidoConfirmado, registroPedidoCancelado, registroPedidoEntregado, registroCompraRecibida, registroAdelantoRegistrado];
