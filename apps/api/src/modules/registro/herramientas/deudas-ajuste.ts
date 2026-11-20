import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { calcularAjuste, versionDePedidoEnReferencia } from '../domain/ajuste.js';
import { puedeEditarseLaDeuda, validarVencimiento, type EstadoDeDeuda } from '../domain/deuda.js';
import { aFavorActual, ajustePorOrigen, ajustesDeDeuda, ajustesPorOrigenes, guardarTotal, insertarAjuste, ultimaVersionAjustada } from '../repositories/ajustes.repository.js';
import { bloquearDeuda, verDeuda } from '../repositories/deudas.repository.js';
import { existeContacto } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe, rechazoDe } from './comun.js';
import { aDeudaDto, codigoDeLaDeuda } from './mapeo.js';

// `deuda_ajustar`: corrige el TOTAL de una deuda viva (la venta se corrigió) sin anularla y sin tocar lo ya abonado. Deja un
// ajuste visible e inmutable (monto con signo, motivo, quién, cuándo). Si el cliente pagó de más, el exceso queda a su favor:
// no se devuelve dinero ni se crea una deuda por pagar (adaptación contable interna).

/**
 * La referencia de origen, con la deuda ya bloqueada: repetida → el ajuste ya existe (idempotente); de otra deuda → choque; de una
 * versión del pedido más vieja que la ya ajustada → se rechaza (aplicarla dejaría la deuda con un total que ya no vale).
 */
async function revisarReferencia(tx: Transaccion, ctx: ContextoDeHerramienta, deudaId: string, origenRef: string | undefined): Promise<{ yaAplicado: string } | { motivo: string } | null> {
  if (!origenRef) return null;
  const previo = await ajustePorOrigen(tx, ctx, origenRef);
  if (previo) return previo.deudaId === deudaId ? { yaAplicado: previo.id } : { motivo: 'Esa referencia ya se usó para ajustar otra deuda.' };
  const ref = versionDePedidoEnReferencia(origenRef);
  const ultima = ref ? await ultimaVersionAjustada(tx, ctx, deudaId, ref.pedidoId) : null;
  if (ref && ultima !== null && ultima > ref.version) {
    return { motivo: `Este ajuste es de la versión ${ref.version} del pedido, pero la deuda ya se ajustó con la versión ${ultima}: ya no corresponde aplicarlo (descártalo).` };
  }
  return null;
}

export const deudaAjustar = definirHerramienta('deuda_ajustar', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  mueveDinero: true,
  ayuda: {
    titulo: 'Ajustar el total de una deuda',
    paraQueSirve: 'Cambia lo que se debe cuando la venta se corrigió (otro precio, IGV, otra cantidad). Lo ya abonado no se toca. Queda un ajuste con el monto, el motivo, quién y cuándo. Si el cliente ya pagó más que el total nuevo, la deuda queda pagada y el exceso queda a favor del cliente (no se devuelve).',
    cuandoUsarla: 'Cuando un pedido confirmado cambió de importe y su deuda debe cambiar igual. Normalmente la dispara «Corregir venta»; también se propone sola como borrador si hace falta.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador de la deuda.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'nuevoTotalCentimos', queSeAnota: 'El total que debe tener la venta, en céntimos, mayor que cero.', ejemplo: '50000' },
      { nombre: 'motivoCodigo', queSeAnota: 'Por qué: igv, precio_acordado, cantidad, lineas, error_digitacion u otro.', ejemplo: 'precio_acordado' },
      { nombre: 'motivoTexto', queSeAnota: 'Explicación breve (opcional).', ejemplo: 'El cliente negoció por volumen' },
      { nombre: 'origenRef', queSeAnota: 'Referencia que evita ajustar dos veces lo mismo (p. ej. pedido:<id>:v2) (opcional).', ejemplo: 'pedido:0192f0c4:v2' },
      { nombre: 'venceEn', queSeAnota: 'Nuevo vencimiento (AAAA-MM-DD) o null para quitarlo (opcional).', ejemplo: '2026-04-10' },
    ],
    ejemploTecleado: 'ajustar la deuda CXC-2026-0007 a 500 soles por precio acordado',
    ejemploHablado: 'la cuenta por cobrar siete queda en quinientos, el precio fue acordado',
    erroresComunes: [
      'El total no puede quedar en cero: para dejar la deuda sin valor se anula.',
      'Una deuda anulada no se ajusta.',
      'No hay nada que ajustar: la deuda ya tenía ese total.',
      'El cliente de la deuda solo se cambia si no tiene abonos.',
      'El ajuste es de una versión del pedido más vieja que la ya aplicada: se descarta.',
    ],
    relacionadas: ['deuda_ver', 'deuda_editar', 'deuda_anular', 'deuda_ajustes_listar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'deuda', entidadId: a.id, resumen: { motivo: a.motivoCodigo, ...(d && { codigo: d.deuda.codigo, totalCentimos: d.deuda.totalCentimos, aFavorCentimos: d.aFavorCentimos }) } }),
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearDeuda(tx, ctx, args.id, propietarioDe(ctx));
    if (!actual) return rechazo('no_encontrado', 'No existe esa deuda.');
    const hoy = (await hoyDeLaEmpresa(tx)).dia;
    const responder = async (yaAplicado: boolean, ajusteId: string | null) => {
      const f = await verDeuda(tx, ctx, actual.id, null);
      if (!f) throw new Error('La deuda ajustada no se pudo leer.');
      const ajustes = await ajustesDeDeuda(tx, ctx, actual.id);
      return exito({ deuda: aDeudaDto(f, hoy), ajuste: ajustes.find((x) => x.id === ajusteId) ?? null, aFavorCentimos: ajustes[0]?.aFavorCentimos ?? 0, yaAplicado });
    };
    const referencia = await revisarReferencia(tx, ctx, actual.id, args.origenRef);
    if (referencia) return 'yaAplicado' in referencia ? responder(true, referencia.yaAplicado) : rechazo('conflicto', referencia.motivo);
    const editable = puedeEditarseLaDeuda(actual.estado as EstadoDeDeuda);
    if (!editable.ok) return rechazoDe(editable);
    if (args.venceEn !== undefined) {
      const vence = validarVencimiento(actual.fecha, args.venceEn);
      if (!vence.ok) return rechazoDe(vence);
    }
    const cambiaContacto = args.contactoId !== undefined && args.contactoId !== actual.contactoId;
    if (cambiaContacto) {
      if (actual.abonadoCentimos > 0) return rechazo('conflicto', 'No se puede cambiar el cliente de una deuda que ya tiene abonos.');
      if (!(await existeContacto(tx, ctx, args.contactoId!))) return rechazo('no_encontrado', 'No existe ese cliente.');
    }
    const calc = calcularAjuste(actual, args.nuevoTotalCentimos, await aFavorActual(tx, ctx, actual.id));
    if (!calc.ok) return rechazoDe(calc);
    if (calc.sinCambio && args.venceEn === undefined && !cambiaContacto) return rechazo('argumentos_invalidos', 'No hay nada que ajustar: la deuda ya tenía ese total.');
    let ajusteId: string | null = null;
    if (!calc.sinCambio) {
      ajusteId = await insertarAjuste(tx, ctx, {
        deudaId: actual.id,
        montoCentimos: calc.montoCentimos,
        totalAnteriorCentimos: actual.totalCentimos,
        totalNuevoCentimos: calc.totalNuevoCentimos,
        aFavorCentimos: calc.aFavorCentimos,
        motivoCodigo: args.motivoCodigo,
        motivoTexto: args.motivoTexto?.trim() || null,
        origenRef: args.origenRef ?? null,
      });
    }
    await guardarTotal(tx, ctx, actual.id, {
      totalCentimos: calc.totalNuevoCentimos,
      estado: calc.estado,
      ...(args.venceEn !== undefined && { venceEn: args.venceEn }),
      ...(cambiaContacto && { contactoId: args.contactoId }),
    });
    const codigo = codigoDeLaDeuda(actual);
    if (!calc.sinCambio) {
      await emitir(tx, 'deuda.ajustada', { id: actual.id, codigo, montoCentimos: calc.montoCentimos, totalAnteriorCentimos: actual.totalCentimos, totalNuevoCentimos: calc.totalNuevoCentimos, aFavorCentimos: calc.aFavorCentimos });
    }
    if (calc.estado === 'pagada' && actual.estado !== 'pagada') {
      await emitir(tx, 'deuda.pagada', { id: actual.id, codigo, tipo: actual.tipo as 'por_cobrar' | 'por_pagar', contactoId: actual.contactoId, totalCentimos: calc.totalNuevoCentimos });
    }
    return responder(false, ajusteId);
  },
});

export const deudaAjustesListar = definirHerramienta('deuda_ajustes_listar', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ajustes de deudas por referencia',
    paraQueSirve: 'Devuelve los ajustes de total cuyas referencias de origen (p. ej. pedido:<id>:v2) se piden.',
    cuandoUsarla: 'Para ligar cada corrección de un pedido con el ajuste que hizo a su deuda.',
    campos: [{ nombre: 'origenRefs', queSeAnota: 'Hasta 100 referencias de origen.', ejemplo: '["pedido:0192f0c4:v2"]' }],
    ejemploTecleado: 'qué ajustes de deuda salieron de la corrección del pedido siete',
    ejemploHablado: 'qué le pasó a la deuda cuando se corrigió el pedido',
    erroresComunes: ['Con acceso solo a tus propios registros ves únicamente los ajustes de deudas tuyas.'],
    relacionadas: ['deuda_ver', 'deuda_ajustar', 'correcciones_listar'],
  },
  async ejecutar(args, ctx, tx) {
    return exito({ items: await ajustesPorOrigenes(tx, ctx, args.origenRefs, propietarioDe(ctx)) });
  },
});
