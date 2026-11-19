import { rechazo, type DetalleDeEventoDePedido } from '@capaz/shared';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { comprobarEdicionDeDatos } from '../domain/estados.js';
import { codigoDePedido, comprobarFechas, cambiosDeDatos } from '../domain/pedido.js';
import { actualizarPedido, nombresDeMiembros, registrarEvento, verPedido } from '../repositories/pedidos.repository.js';
import { ID, MODULO, NO_EXISTE, alcanceDePedidos, auditarPedido, comprobarReferencias, estadoDe, responderPedido } from './comunes.js';

// Corrección de lo que no mueve dinero de un pedido ya confirmado. Deja HUELLA en el historial (quién, cuándo,
// antes y después, motivo) y emite `pedido.datos_editados`: Finanzas puede proponer mover el vencimiento de la deuda.

export const pedidoEditarDatos = definirHerramienta('pedido_editar_datos', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Corregir los datos de un pedido confirmado',
    paraQueSirve: 'Cambia la fecha de entrega, el responsable o las notas de un pedido confirmado, en proceso o listo. No toca líneas ni importes. Cada corrección queda en el historial con quién la hizo, cuándo, lo que decía antes y lo que dice ahora.',
    cuandoUsarla: 'Cuando el cliente pide otra fecha de entrega, cambia quien lo atiende o hay que corregir una indicación, y el pedido ya está confirmado.',
    campos: [
      ID,
      { nombre: 'entregaEl', queSeAnota: 'Nuevo día de entrega, o vacío para quitarlo (opcional).', ejemplo: '2026-03-22' },
      { nombre: 'responsableId', queSeAnota: 'Nuevo responsable, o vacío para dejarlo sin responsable (opcional).', ejemplo: 'usuario-123' },
      { nombre: 'notas', queSeAnota: 'Nuevas notas del pedido, o vacío para borrarlas (opcional).', ejemplo: 'Entregar en la puerta lateral' },
      { nombre: 'motivo', queSeAnota: 'Por qué se corrige (opcional, breve): queda en el historial.', ejemplo: 'El cliente pidió más tiempo' },
    ],
    ejemploTecleado: 'mover la entrega del pedido PED-PRI-2026-0007 al 22 de marzo porque el cliente pidió más tiempo',
    ejemploHablado: 'la entrega del pedido siete pasa al veintidós, el cliente pidió más tiempo',
    erroresComunes: ['Un pedido en borrador se edita con pedido_editar.', 'Un pedido entregado o cancelado ya no se corrige.', 'La entrega no puede ser anterior a la fecha del pedido.', 'No hay nada que cambiar: los datos ya eran esos.'],
    relacionadas: ['pedido_ver', 'pedido_anotar', 'pedido_editar'],
  },
  auditar: (a, d) => ({
    ...auditarPedido(a, d),
    entidadId: a.id,
    resumen: { ...(d && { codigo: d.codigo, estado: d.estado }), campos: (['entregaEl', 'responsableId', 'notas'] as const).filter((k) => a[k] !== undefined).join(',') },
  }),
  async ejecutar(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const paso = comprobarEdicionDeDatos(estadoDe(actual));
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    const cambios = cambiosDeDatos(actual, args);
    if (cambios.length === 0) return rechazo('argumentos_invalidos', 'No hay nada que cambiar: los datos ya eran esos.');
    const entrega = cambios.find((c) => c.campo === 'entregaEl');
    if (entrega) {
      const fechas = comprobarFechas(actual.fecha, entrega.despues);
      if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    }
    const responsable = cambios.find((c) => c.campo === 'responsableId');
    if (responsable?.despues) {
      const falta = await comprobarReferencias(tx, ctx, { responsableId: responsable.despues });
      if (falta) return rechazo('argumentos_invalidos', falta);
    }
    // El nombre del responsable se guarda junto al id: la huella se lee igual aunque la persona deje la empresa.
    const ids = [responsable?.antes, responsable?.despues].filter((x): x is string => !!x);
    const nombres = await nombresDeMiembros(tx, ids);
    const detalle: DetalleDeEventoDePedido = {
      cambios: cambios.map((c) => (c.campo === 'responsableId' ? { ...c, antesEtiqueta: c.antes ? (nombres.get(c.antes) ?? null) : null, despuesEtiqueta: c.despues ? (nombres.get(c.despues) ?? null) : null } : c)),
      motivo: args.motivo?.trim() || null,
    };
    await actualizarPedido(tx, ctx, actual.id, {
      ...(entrega && { entregaEl: entrega.despues }),
      ...(responsable && { responsableId: responsable.despues }),
      ...(cambios.some((c) => c.campo === 'notas') && { notas: cambios.find((c) => c.campo === 'notas')!.despues }),
    });
    await registrarEvento(tx, ctx, actual.id, { tipo: 'datos_editados', detalle });
    await emitir(tx, 'pedido.datos_editados', {
      id: actual.id,
      codigo: codigoDePedido(actual.serie, actual.anio, actual.numero),
      clienteId: actual.clienteId,
      entregaAnterior: actual.entregaEl,
      entregaNueva: entrega ? entrega.despues : actual.entregaEl,
    });
    return responderPedido(tx, ctx, actual.id);
  },
});
