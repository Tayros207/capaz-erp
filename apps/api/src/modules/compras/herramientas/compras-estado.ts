import { formatearSoles, rechazo } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { NOMBRE_DE_ESTADO, comprobarCancelacion, comprobarEnvio } from '../domain/estados.js';
import { CLAVE_DE_CORRELATIVO, codigoDeOrden, comprobarLineasParaEnviar } from '../domain/orden.js';
import { actualizarCompra, verCompra } from '../repositories/compras.repository.js';
import { serieDe } from '../repositories/nucleo.repository.js';
import { contarRecepciones } from '../repositories/recepciones.repository.js';
import { ID, MODULO, NO_EXISTE, alcanceDeCompras, auditarCompra, estadoDe, responderCompra } from './comunes.js';

// Enviar (le da número) y cancelar (crítica). Cada paso emite su evento en la misma transacción.

export const compraEnviar = definirHerramienta('compra_enviar', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Enviar una orden de compra',
    paraQueSirve: 'Pasa el borrador a enviada y le asigna su número correlativo. Desde ahí ya no se editan sus líneas y se puede registrar lo que llega.',
    cuandoUsarla: 'Cuando la orden está lista y se la mandas al proveedor.',
    campos: [ID],
    ejemploTecleado: 'enviar el borrador de compra a Papelera Andina',
    ejemploHablado: 'manda la orden de compra de Papelera Andina',
    erroresComunes: ['Agrega al menos una línea antes de enviar la orden.', 'La orden ya estaba enviada.'],
    relacionadas: ['compra_recibir', 'compra_cancelar'],
  },
  auditar: auditarCompra,
  async ejecutar(args, ctx, tx) {
    const actual = await verCompra(tx, ctx, args.id, { alcance: alcanceDeCompras(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const paso = comprobarEnvio(estadoDe(actual));
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    const lineas = comprobarLineasParaEnviar(actual.lineas);
    if (!lineas.ok) return rechazo('conflicto', lineas.motivo);
    const serie = await serieDe(tx, ctx, actual.sucursalId);
    if (!serie) return rechazo('conflicto', 'Tu empresa todavía no tiene una sucursal principal: vuelve a intentarlo en unos segundos.');
    const { anio } = await hoyDeLaEmpresa(tx);
    // El número se toma al final: si algo falla antes o después, la transacción lo devuelve (sin huecos).
    const numero = await siguienteNumero(tx, CLAVE_DE_CORRELATIVO, { serie, anio });
    await actualizarCompra(tx, ctx, actual.id, { estado: 'enviada', numero, serie, anio });
    await emitir(tx, 'compra.enviada', { ordenId: actual.id, numero: codigoDeOrden(serie, anio, numero), proveedorId: actual.proveedorId, totalCentimos: actual.totalCentimos });
    return responderCompra(tx, ctx, actual.id);
  },
});

export const compraCancelar = definirHerramienta('compra_cancelar', {
  modulo: MODULO,
  permiso: 'compras:cancelar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Cancelar una orden de compra',
    paraQueSirve: 'Cancela una orden en borrador o enviada que todavía no recibió nada y guarda el motivo. La orden no se borra y, si tenía número, lo conserva.',
    cuandoUsarla: 'Cuando ya no vas a comprar eso o el proveedor no puede atenderlo.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se cancela.', ejemplo: 'El proveedor no tiene stock' }],
    ejemploTecleado: 'cancelar la orden OC-PRI-2026-0001 porque el proveedor no tiene stock',
    ejemploHablado: 'cancela la orden de compra uno, el proveedor no tiene',
    erroresComunes: ['La orden ya tiene recepciones: no se puede cancelar.', 'La orden cambió mientras confirmabas: vuelve a pedir la cancelación.'],
    relacionadas: ['compra_ver', 'compra_enviar'],
  },
  auditar: auditarCompra,
  async resumir(args, ctx, tx) {
    const actual = await verCompra(tx, ctx, args.id, { alcance: alcanceDeCompras(ctx) });
    if (!actual) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE } };
    const de = estadoDe(actual);
    const recepciones = await contarRecepciones(tx, ctx, actual.id);
    const paso = comprobarCancelacion(de, recepciones);
    if (!paso.ok) return { ok: false, error: { codigo: 'conflicto', mensaje: paso.motivo } };
    const codigo = codigoDeOrden(actual.serie, actual.anio, actual.numero);
    const cual = actual.numero === null ? 'una orden de compra en borrador' : `la orden ${codigo} (${NOMBRE_DE_ESTADO[de]})`;
    return {
      ok: true,
      resumen: {
        resumen: `Se cancelará ${cual} por ${formatearSoles(actual.totalCentimos)}. No se puede deshacer.`,
        huella: hashCanonico({ estado: actual.estado, totalCentimos: actual.totalCentimos, recepciones }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const actual = await verCompra(tx, ctx, args.id, { alcance: alcanceDeCompras(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const paso = comprobarCancelacion(estadoDe(actual), await contarRecepciones(tx, ctx, actual.id));
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    await actualizarCompra(tx, ctx, actual.id, { estado: 'cancelada', canceladoAhora: true, canceladoPor: ctx.usuarioId, motivoCancelacion: args.motivo });
    // Solo una orden que ya tenía número (enviada) interesa a otros módulos; cancelar un borrador no emite.
    if (actual.numero !== null) await emitir(tx, 'compra.cancelada', { ordenId: actual.id, numero: codigoDeOrden(actual.serie, actual.anio, actual.numero) });
    return responderCompra(tx, ctx, actual.id);
  },
});
