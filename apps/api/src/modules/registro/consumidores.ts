import { EVENTOS, formatearSoles, type CargaDe } from '@capaz/shared';
import { and, eq } from 'drizzle-orm';
import { proponerBorrador, reproponerBorradores } from '../../core/borradores/proponer.js';
import { borradores } from '../../db/esquema/core-automatizaciones.js';
import type { Consumidor } from '../../core/eventos/tipos.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { hoyDeLaEmpresa } from '../../core/empresas/hoy.js';
import { diaParaResumen, vencimientoDeCompra } from './domain/compra-a-credito.js';
import { normalizarNombre } from './domain/catalogos.js';
import { versionDePedidoEnReferencia } from './domain/ajuste.js';
import { categoriaConNombre } from './repositories/categorias.repository.js';
import { aFavorActual, ajustePorOrigen, ultimaVersionAjustada } from './repositories/ajustes.repository.js';
import { deudaVivaPorOrigen } from './repositories/deudas.repository.js';
import { plazoDePagoDeProveedor } from './repositories/proveedores.repository.js';

// Consumidores de eventos de otros módulos (ficha §4.5). Regla R5: un consumidor NUNCA ejecuta herramientas ni
// escribe en las tablas del módulo; solo lee sus propias tablas y PROPONE un borrador. El dinero lo confirma una
// persona en la bandeja. Aquí no se importa el ejecutor.

/** El tipo de origen con el que una deuda recuerda el pedido del que nació (par blando, sin llave foránea: R6). */
const ORIGEN_PEDIDO = 'pedido';
/** Ídem para la recepción de una compra (la deuda por pagar nace al recibir, por lo recibido: P3-4). */
const ORIGEN_COMPRA = 'compra';
/** Ídem para una orden de producción: la deuda nace con la orden, por su total, y el adelanto entra en el mismo gesto. */
const ORIGEN_PRODUCCION = 'produccion';

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
    // Un proveedor con plazo (ficha comercial del núcleo) vence a ese plazo contado desde el día de la recepción.
    const hoy = await hoyDeLaEmpresa(tx, new Date(e.creadoEn));
    const venceEn = vencimientoDeCompra(hoy.dia, await plazoDePagoDeProveedor(tx, ctx, carga.proveedorId));
    await proponerBorrador(tx, {
      herramienta: 'deuda_crear',
      args: {
        tipo: 'por_pagar',
        contactoId: carga.proveedorId,
        concepto: `Compra ${carga.numero}`,
        totalCentimos: carga.totalRecibidoCentimos,
        origenTipo: ORIGEN_COMPRA,
        origenId: carga.recepcionId,
        ...(venceEn && { fecha: hoy.dia, venceEn }),
      },
      resumen: `Pagar ${formatearSoles(carga.totalRecibidoCentimos)} por la compra ${carga.numero}${venceEn ? ` (vence el ${diaParaResumen(venceEn)})` : ''}`,
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

/**
 * Una orden de trabajo (taller) propone su cuenta por cobrar. Con adelanto, la deuda y el adelanto nacen en un
 * solo gesto (`deuda_crear_con_adelanto`); si el adelanto es el total, solo se registra el ingreso. Sin total no hace nada.
 */
export const registroProduccionOrdenCreada: Consumidor = {
  nombre: 'registro_produccion_orden_creada',
  modulo: 'registro',
  evento: 'produccion.orden_creada',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['produccion.orden_creada'].parse(e.carga);
    if (carga.totalCentimos <= 0) return;
    if (await deudaVivaPorOrigen(tx, ctx, ORIGEN_PRODUCCION, carga.id)) return;
    const concepto = `Orden ${carga.codigo}: ${carga.descripcion}`.slice(0, 200);
    const origenRef = `produccion:${carga.id}`;
    if (carga.adelantoCentimos >= carga.totalCentimos) {
      await proponerBorrador(tx, {
        herramienta: 'movimiento_registrar',
        args: { tipo: 'ingreso', montoCentimos: carga.totalCentimos, contactoId: carga.clienteId, descripcion: concepto, origen: 'modulo', origenRef },
        resumen: `Registrar el cobro de ${formatearSoles(carga.totalCentimos)} de la orden ${carga.codigo}`,
        origen: 'modulo',
        origenRef,
        propuestoPor: 'sistema',
      });
      return;
    }
    const base = { tipo: 'por_cobrar', contactoId: carga.clienteId, concepto, totalCentimos: carga.totalCentimos, venceEn: carga.entregaEl ?? undefined, origenTipo: ORIGEN_PRODUCCION, origenId: carga.id };
    await proponerBorrador(tx, {
      herramienta: carga.adelantoCentimos > 0 ? 'deuda_crear_con_adelanto' : 'deuda_crear',
      args: carga.adelantoCentimos > 0 ? { ...base, adelantoCentimos: carga.adelantoCentimos, origen: 'modulo' } : base,
      resumen:
        carga.adelantoCentimos > 0
          ? `Cobrar ${formatearSoles(carga.totalCentimos)} por la orden ${carga.codigo}, con adelanto de ${formatearSoles(carga.adelantoCentimos)} (falta ${formatearSoles(carga.totalCentimos - carga.adelantoCentimos)})`
          : `Cobrar ${formatearSoles(carga.totalCentimos)} por la orden ${carga.codigo}`,
      origen: 'modulo',
      origenRef,
      propuestoPor: 'sistema',
    });
  },
};

/** Propone cobrar el saldo de la deuda viva de una orden. Sin deuda viva, sin saldo o con un cobro ya propuesto no hace nada. */
async function proponerCobroDeOrden(tx: Parameters<Consumidor['manejar']>[2], ctx: Parameters<Consumidor['manejar']>[1], orden: { id: string; codigo: string }): Promise<void> {
  const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PRODUCCION, orden.id);
  if (!viva) return;
  const saldo = viva.totalCentimos - viva.abonadoCentimos;
  if (saldo <= 0) return;
  // Solo lectura: un cobro del saldo aún pendiente en la bandeja no se vuelve a proponer.
  const [pendiente] = await tx
    .select({ id: borradores.id })
    .from(borradores)
    .where(and(eq(borradores.tenantId, ctx.empresaId), eq(borradores.herramienta, 'deuda_abonar'), eq(borradores.origenRef, `produccion:${orden.id}`), eq(borradores.estado, 'pendiente')))
    .limit(1);
  if (pendiente) return;
  await proponerBorrador(tx, {
    herramienta: 'deuda_abonar',
    args: { id: viva.id, montoCentimos: saldo },
    resumen: `Cobrar lo que falta, ${formatearSoles(saldo)}, de la orden ${orden.codigo}`,
    origen: 'modulo',
    origenRef: `produccion:${orden.id}`,
    propuestoPor: 'sistema',
  });
}

/** Una orden entregada propone cobrar lo que falta. */
export const registroProduccionOrdenEntregada: Consumidor = {
  nombre: 'registro_produccion_orden_entregada',
  modulo: 'registro',
  evento: 'produccion.orden_entregada',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['produccion.orden_entregada'].parse(e.carga);
    await proponerCobroDeOrden(tx, ctx, carga);
  },
};

/** «Anotar que ya me pagó»: la orden pide cobrar lo que falta. */
export const registroProduccionCobroPedido: Consumidor = {
  nombre: 'registro_produccion_cobro_pedido',
  modulo: 'registro',
  evento: 'produccion.orden_cobro_pedido',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['produccion.orden_cobro_pedido'].parse(e.carga);
    await proponerCobroDeOrden(tx, ctx, carga);
  },
};

/**
 * Una orden anulada propone anular su deuda viva, con prioridad alta. Si el cliente había dejado un adelanto, el resumen dice
 * qué se hizo con él: si se devolvió, hay que anular antes ese cobro; si se retuvo, la deuda queda por revisar a mano.
 */
export const registroProduccionOrdenAnulada: Consumidor = {
  nombre: 'registro_produccion_orden_anulada',
  modulo: 'registro',
  evento: 'produccion.orden_anulada',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['produccion.orden_anulada'].parse(e.carga);
    const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PRODUCCION, carga.id);
    if (!viva) return;
    const nota =
      carga.destinoAdelanto === 'devuelto' ? ` (el adelanto de ${formatearSoles(carga.adelantoCentimos)} se devolvió: anula antes ese cobro)`
      : carga.destinoAdelanto === 'retenido' ? ` (se retuvo el adelanto de ${formatearSoles(carga.adelantoCentimos)}: revisa a mano el saldo)`
      : '';
    await proponerBorrador(tx, {
      herramienta: 'deuda_anular',
      args: { id: viva.id, motivo: `Orden ${carga.codigo} anulada` },
      resumen: `Anular la deuda de la orden ${carga.codigo}, que fue anulada${nota}`,
      origen: 'modulo',
      origenRef: `produccion:${carga.id}`,
      prioridad: 'alta',
      propuestoPor: 'sistema',
    });
  },
};

/** Sumar el aviso a las notas que la deuda ya tenga, sin pasar del máximo de `deuda_editar` (2000). */
function notasConAviso(previas: string | null, aviso: string): string {
  return (previas ? `${previas}\n${aviso}` : aviso).slice(-2000);
}

/**
 * Una orden corregida con otro total o vencimiento propone revisar su deuda viva. No existe un ajuste de total (el
 * total de una deuda no se cambia: se anula y se crea otra), así que el borrador usa `deuda_editar`, que sí existe y
 * es inocua: deja el aviso «el total cambió de S/ X a S/ Y, la deuda sigue por S/ X; revisa» en las notas de la deuda
 * (prioridad alta, para que se vea) y, si la entrega cambió y la deuda vencía ese día, mueve también el vencimiento.
 * Al aprobarlo la deuda no cambia de importe: la persona decide después si anula y vuelve a crear. Sin deuda viva, o sin
 * nada que avisar, no hace nada. Dos correcciones seguidas proponen dos borradores (cada una es un hecho distinto).
 */
export const registroProduccionOrdenCorregida: Consumidor = {
  nombre: 'registro_produccion_orden_corregida',
  modulo: 'registro',
  evento: 'produccion.orden_corregida',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['produccion.orden_corregida'].parse(e.carga);
    const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PRODUCCION, carga.id);
    if (!viva) return;
    const cambioElTotal = carga.totalNuevoCentimos !== carga.totalAnteriorCentimos;
    const mueveVencimiento = carga.entregaNueva !== carga.entregaAnterior && viva.venceEn !== null && viva.venceEn === carga.entregaAnterior;
    if (!cambioElTotal && !mueveVencimiento) return;
    const partes: string[] = [];
    const args: { id: string; notas?: string; venceEn?: string | null } = { id: viva.id };
    if (cambioElTotal) {
      const aviso = `El total de la orden ${carga.codigo} cambió de ${formatearSoles(carga.totalAnteriorCentimos)} a ${formatearSoles(carga.totalNuevoCentimos)}: la deuda quedó con ${formatearSoles(viva.totalCentimos)}; revisa.`;
      args.notas = notasConAviso(viva.notas, aviso);
      partes.push(aviso);
    }
    if (mueveVencimiento) {
      args.venceEn = carga.entregaNueva;
      partes.push(`La entrega pasó a ${carga.entregaNueva ?? 'sin fecha'}: el vencimiento se mueve con ella.`);
    }
    await proponerBorrador(tx, {
      herramienta: 'deuda_editar',
      args,
      resumen: partes.join(' ').slice(0, 500),
      origen: 'modulo',
      origenRef: `produccion:${carga.id}`,
      ...(cambioElTotal && { prioridad: 'alta' as const }),
      propuestoPor: 'sistema',
    });
  },
};

/** Un pedido con la entrega corregida propone mover el vencimiento de su deuda viva, solo si vencía justo en la entrega anterior. */
export const registroPedidoDatosEditados: Consumidor = {
  nombre: 'registro_pedido_datos_editados',
  modulo: 'registro',
  evento: 'pedido.datos_editados',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['pedido.datos_editados'].parse(e.carga);
    if (carga.entregaNueva === carga.entregaAnterior) return;
    const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PEDIDO, carga.id);
    if (viva?.venceEn == null || viva.venceEn !== carga.entregaAnterior) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_editar',
      args: { id: viva.id, venceEn: carga.entregaNueva },
      resumen: `Mover el vencimiento de la deuda del pedido ${carga.codigo} al ${carga.entregaNueva ?? 'sin fecha'}, porque cambió la entrega`,
      origen: 'modulo',
      origenRef: `pedido:${carga.id}`,
      propuestoPor: 'sistema',
    });
  },
};

/**
 * Respaldo de «Corregir venta»: un pedido corregido cuya deuda viva no cuadra con el total nuevo (porque quien corrigió no
 * lleva Finanzas, o corrigió solo el pedido) propone `deuda_ajustar` como borrador (R5: no ajusta por su cuenta). Si la deuda ya
 * cuadra, o ya hay un ajuste o un borrador con esa referencia (`pedido:<id>:v<n>`), no hace nada: dos entregas no duplican.
 * «Cuadra»: la deuda vale el total nuevo, o lo abonado si el cliente ya pagó más, y el excedente a su favor registrado es el que corresponde.
 */
export const registroPedidoCorregido: Consumidor = {
  nombre: 'registro_pedido_corregido',
  modulo: 'registro',
  evento: 'pedido.corregido',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['pedido.corregido'].parse(e.carga);
    const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PEDIDO, carga.id);
    if (!viva) {
      await ponerAlDiaLaPropuestaDeCobro(tx, carga);
      return;
    }
    // Llegó tarde: la deuda ya se ajustó con una versión más nueva del pedido. Proponer esta la haría retroceder.
    const ultima = await ultimaVersionAjustada(tx, ctx, viva.id, carga.id);
    if (ultima !== null && ultima > carga.versionNueva) return;
    await ponerAlDiaLosAjustesViejos(tx, carga);
    const origenRef = `pedido:${carga.id}:v${carga.versionNueva}`;
    if (await ajustePorOrigen(tx, ctx, origenRef)) return;
    const aFavorEsperado = Math.max(0, viva.abonadoCentimos - carga.totalNuevoCentimos);
    if (viva.totalCentimos === Math.max(carga.totalNuevoCentimos, viva.abonadoCentimos) && (await aFavorActual(tx, ctx, viva.id)) === aFavorEsperado) return;
    const [pendiente] = await tx
      .select({ id: borradores.id })
      .from(borradores)
      .where(and(eq(borradores.tenantId, ctx.empresaId), eq(borradores.herramienta, 'deuda_ajustar'), eq(borradores.origenRef, origenRef), eq(borradores.estado, 'pendiente')))
      .limit(1);
    if (pendiente) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_ajustar',
      args: { id: viva.id, nuevoTotalCentimos: carga.totalNuevoCentimos, motivoCodigo: 'otro', motivoTexto: `Corrección del pedido ${carga.codigo} (versión ${carga.versionAnterior} a ${carga.versionNueva})`, origenRef },
      resumen: `Ajustar la deuda del pedido ${carga.codigo}: el total pasó de ${formatearSoles(carga.totalAnteriorCentimos)} a ${formatearSoles(carga.totalNuevoCentimos)} (la deuda sigue en ${formatearSoles(viva.totalCentimos)})`,
      origen: 'modulo',
      origenRef,
      prioridad: 'alta',
      propuestoPor: 'sistema',
    });
  },
};

/**
 * El pedido se corrigió antes de que su deuda existiera: la propuesta `deuda_crear` que sigue pendiente en la bandeja se pone al
 * día (total, cliente y vencimiento) para que, al aprobarla, la deuda nazca con lo vigente y no con el total viejo. Sigue siendo
 * una propuesta (R5: aquí no se ejecuta ni se escribe nada del módulo; lo hace el núcleo de borradores). Si ya estaba al día, nada.
 */
async function ponerAlDiaLaPropuestaDeCobro(tx: Transaccion, carga: CargaDe<'pedido.corregido'>): Promise<void> {
  const ref = `pedido:${carga.id}`;
  await reproponerBorradores(tx, {
    herramienta: 'deuda_crear',
    origenRefEmpiezaCon: ref,
    aplica: (r) => r === ref,
    cambiar: (previos) => ({
      ...previos,
      totalCentimos: carga.totalNuevoCentimos,
      contactoId: carga.clienteId,
      ...(carga.entregaNueva !== carga.entregaAnterior && carga.entregaNueva !== null && { venceEn: carga.entregaNueva }),
    }),
    resumen: `Cobrar ${formatearSoles(carga.totalNuevoCentimos)} por el pedido ${carga.codigo} (versión ${carga.versionNueva})`,
  });
}

/**
 * Propuestas de ajuste de versiones anteriores del pedido que siguen pendientes: se ponen al día con el total vigente. Así,
 * aprobarlas tarde nunca hace retroceder la deuda (p. ej., alguien bajó el precio, el dueño lo devolvió y Finanzas aprueba después
 * la propuesta vieja); si la deuda ya cuadra, al aprobarlas no habrá nada que ajustar.
 */
async function ponerAlDiaLosAjustesViejos(tx: Transaccion, carga: CargaDe<'pedido.corregido'>): Promise<void> {
  await reproponerBorradores(tx, {
    herramienta: 'deuda_ajustar',
    origenRefEmpiezaCon: `pedido:${carga.id}:v`,
    aplica: (r) => (versionDePedidoEnReferencia(r)?.version ?? Number.POSITIVE_INFINITY) < carga.versionNueva,
    cambiar: (previos) => ({ ...previos, nuevoTotalCentimos: carga.totalNuevoCentimos }),
    resumen: `Ajustar la deuda del pedido ${carga.codigo} a ${formatearSoles(carga.totalNuevoCentimos)}: el total vigente (versión ${carga.versionNueva})`,
  });
}

export const CONSUMIDORES_DE_REGISTRO: readonly Consumidor[] = [registroPedidoCorregido, registroPedidoConfirmado, registroPedidoCancelado, registroPedidoEntregado, registroCompraRecibida, registroAdelantoRegistrado, registroProduccionOrdenCreada, registroProduccionOrdenEntregada, registroProduccionCobroPedido, registroProduccionOrdenAnulada, registroProduccionOrdenCorregida, registroPedidoDatosEditados];
