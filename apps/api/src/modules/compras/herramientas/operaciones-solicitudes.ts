import { IGV_DE_COMPRA_POR_DEFECTO, exito, rechazo, type Respuesta, type SolicitudDeCompraDto } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { comprobarFechas } from '../domain/orden.js';
import { crearCompra, reemplazarLineas } from '../repositories/compras.repository.js';
import { productosPorId } from '../repositories/nucleo.repository.js';
import {
  actualizarSolicitud,
  crearSolicitud,
  lineasDeSolicitudes,
  listarSolicitudes,
  reemplazarLineasDeSolicitud,
  verSolicitud,
  type LineaDeSolicitudNueva,
} from '../repositories/operaciones.repository.js';
import { MODULO, comprobarReferencias, prepararLineasDe } from './comunes.js';
import { aSolicitudDto } from './operaciones-mapeo.js';

export const CLAVE_DE_SOLICITUD = 'compras.solicitud';
const ID = { nombre: 'id', queSeAnota: 'Identificador de la solicitud de compra.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000060' };
const NO_EXISTE = 'No existe esa solicitud de compra.';

async function responder(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<SolicitudDeCompraDto>> {
  const s = await verSolicitud(tx, ctx, id);
  if (!s) return rechazo('no_encontrado', NO_EXISTE);
  return exito(aSolicitudDto(s, (await lineasDeSolicitudes(tx, ctx, [id])).get(id) ?? []));
}

const auditarSolicitud = (_a: unknown, d: SolicitudDeCompraDto | null) => ({
  entidadTipo: 'solicitud_de_compra',
  entidadId: d?.id,
  ...(d && { resumen: { codigo: d.codigo, estado: d.estado, lineas: d.lineas.length } }),
});

export const solicitudCrear = definirHerramienta('solicitud_crear', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear una solicitud de compra',
    paraQueSirve: 'Anota lo que un área necesita comprar. Queda en borrador; al enviarla recibe su número y espera la aprobación de quien autoriza las compras.',
    cuandoUsarla: 'Cuando alguien pide material o servicio y todavía no se le pide a ningún proveedor.',
    campos: [
      { nombre: 'lineas', queSeAnota: 'Lo que se necesita: por línea, un producto o una descripción y la cantidad en milésimas.', ejemplo: '[{ "descripcion": "Papel bond A4", "unidad": "millar", "cantidadMilesimas": 10000 }]' },
      { nombre: 'area', queSeAnota: 'Quién lo pide (opcional).', ejemplo: 'Producción' },
      { nombre: 'necesariaEl', queSeAnota: 'Para cuándo se necesita (opcional).', ejemplo: '2026-03-20' },
      { nombre: 'motivo', queSeAnota: 'Para qué se necesita (opcional).', ejemplo: 'Reposición de fin de mes' },
    ],
    ejemploTecleado: 'solicitar 10 millares de papel bond A4 para producción, lo necesitamos el 20 de marzo',
    ejemploHablado: 'producción necesita diez millares de papel bond para el veinte de marzo',
    erroresComunes: ['Una línea sin producto necesita descripción.', 'El producto no existe o está archivado.', 'La fecha necesaria no puede ser anterior a la de la solicitud.'],
    relacionadas: ['solicitud_enviar', 'solicitud_resolver', 'solicitud_convertir'],
  },
  auditar: auditarSolicitud,
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    const fechas = comprobarFechas(fecha, args.necesariaEl ?? null);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    const productos = await productosPorId(tx, ctx, args.lineas.flatMap((l) => (l.productoId ? [l.productoId] : [])));
    const lineas: LineaDeSolicitudNueva[] = [];
    for (const [i, l] of args.lineas.entries()) {
      const p = l.productoId ? productos.get(l.productoId) : undefined;
      if (l.productoId && (!p || p.archivado)) return rechazo('argumentos_invalidos', `Línea ${i + 1}: el producto no existe o está archivado.`);
      const descripcion = (l.descripcion?.trim() || p?.nombre || '').trim();
      lineas.push({ posicion: i + 1, productoId: l.productoId ?? null, descripcion, unidad: l.unidad?.trim() || p?.unidad || 'unidad', cantidadMilesimas: l.cantidadMilesimas });
    }
    const id = await crearSolicitud(tx, ctx, { fecha, necesariaEl: args.necesariaEl ?? null, area: args.area || null, motivo: args.motivo || null });
    await reemplazarLineasDeSolicitud(tx, ctx, id, lineas);
    return responder(tx, ctx, id);
  },
});

export const solicitudEnviar = definirHerramienta('solicitud_enviar', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Enviar una solicitud a aprobación',
    paraQueSirve: 'Pasa la solicitud de borrador a pendiente y le da su número correlativo. Desde ahí ya no se edita: espera que alguien la apruebe o la rechace.',
    cuandoUsarla: 'Cuando la solicitud está completa y debe autorizarse.',
    campos: [ID],
    ejemploTecleado: 'enviar la solicitud de papel bond a aprobación',
    ejemploHablado: 'manda la solicitud de papel para que la aprueben',
    erroresComunes: ['Solo se envía una solicitud en borrador.'],
    relacionadas: ['solicitud_resolver', 'solicitud_anular'],
  },
  auditar: auditarSolicitud,
  async ejecutar(args, ctx, tx) {
    const s = await verSolicitud(tx, ctx, args.id, { bloquear: true });
    if (!s) return rechazo('no_encontrado', NO_EXISTE);
    if (s.estado !== 'borrador') return rechazo('conflicto', 'Solo se envía una solicitud en borrador.');
    const hoy = await hoyDeLaEmpresa(tx);
    const numero = await siguienteNumero(tx, CLAVE_DE_SOLICITUD, { anio: hoy.anio });
    await actualizarSolicitud(tx, ctx, s.id, { estado: 'pendiente', numero, anio: hoy.anio });
    return responder(tx, ctx, s.id);
  },
});

export const solicitudResolver = definirHerramienta('solicitud_resolver', {
  modulo: MODULO,
  permiso: 'compras:aprobar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Aprobar o rechazar una solicitud de compra',
    paraQueSirve: 'Autoriza o rechaza una solicitud pendiente. Si se rechaza, hay que decir el motivo. Una aprobada ya puede convertirse en orden de compra.',
    cuandoUsarla: 'Cuando quien autoriza las compras revisa lo que se pide.',
    campos: [ID, { nombre: 'decision', queSeAnota: 'aprobar o rechazar.', ejemplo: 'aprobar' }, { nombre: 'motivo', queSeAnota: 'Por qué se rechaza (obligatorio al rechazar).', ejemplo: 'Hay stock suficiente' }],
    ejemploTecleado: 'aprobar la solicitud SC-0001-2026',
    ejemploHablado: 'aprueba la solicitud uno de este año',
    erroresComunes: ['Solo se resuelve una solicitud pendiente.', 'Indica el motivo del rechazo.', 'No tienes permiso para aprobar compras.'],
    relacionadas: ['solicitud_convertir', 'solicitudes_listar'],
  },
  auditar: auditarSolicitud,
  async ejecutar(args, ctx, tx) {
    const s = await verSolicitud(tx, ctx, args.id, { bloquear: true });
    if (!s) return rechazo('no_encontrado', NO_EXISTE);
    if (s.estado !== 'pendiente') return rechazo('conflicto', 'Solo se resuelve una solicitud pendiente.');
    await actualizarSolicitud(tx, ctx, s.id, { estado: args.decision === 'aprobar' ? 'aprobada' : 'rechazada', resueltoPor: ctx.usuarioId, motivoResolucion: args.motivo || null, resuelta: true });
    await emitir(tx, 'solicitud.resuelta', { id: s.id, decision: args.decision });
    return responder(tx, ctx, s.id);
  },
});

export const solicitudConvertir = definirHerramienta('solicitud_convertir', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Convertir una solicitud aprobada en orden de compra',
    paraQueSirve: 'Crea una orden de compra en borrador para un proveedor con las líneas de la solicitud. Los costos que no indiques quedan en cero para completarlos en el borrador.',
    cuandoUsarla: 'Cuando la solicitud ya está aprobada y elegiste a quién comprarle.',
    campos: [ID, { nombre: 'proveedorId', queSeAnota: 'Proveedor al que se le compra.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' }, { nombre: 'costos', queSeAnota: 'Costo unitario por posición, en milésimas con IGV (opcional).', ejemplo: '[{ "posicion": 1, "costoUnitarioMilesimas": 23600 }]' }],
    ejemploTecleado: 'convertir la solicitud SC-0001-2026 en orden para Papelera Andina',
    ejemploHablado: 'haz la orden de compra de la solicitud uno con Papelera Andina',
    erroresComunes: ['Solo se convierte una solicitud aprobada.', 'El proveedor no existe o está archivado.', 'Un costo cita una posición que no existe.'],
    relacionadas: ['solicitud_resolver', 'compra_ver', 'compra_editar'],
  },
  auditar: auditarSolicitud,
  async ejecutar(args, ctx, tx) {
    const s = await verSolicitud(tx, ctx, args.id, { bloquear: true });
    if (!s) return rechazo('no_encontrado', NO_EXISTE);
    if (s.estado !== 'aprobada') return rechazo('conflicto', 'Solo se convierte una solicitud aprobada.');
    const falta = await comprobarReferencias(tx, ctx, { proveedorId: args.proveedorId, sucursalId: args.sucursalId });
    if (falta) return rechazo('argumentos_invalidos', falta);
    const lineas = (await lineasDeSolicitudes(tx, ctx, [s.id])).get(s.id) ?? [];
    const costos = new Map((args.costos ?? []).map((c) => [c.posicion, c.costoUnitarioMilesimas]));
    if ([...costos.keys()].some((p) => !lineas.some((l) => l.posicion === p))) return rechazo('argumentos_invalidos', 'Un costo cita una posición que no existe en la solicitud.');
    const p = await prepararLineasDe(
      tx,
      ctx,
      lineas.map((l) => ({ productoId: l.productoId, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, costoUnitarioMilesimas: costos.get(l.posicion) ?? 0 })),
      IGV_DE_COMPRA_POR_DEFECTO,
    );
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const hoy = await hoyDeLaEmpresa(tx);
    const ordenId = await crearCompra(tx, ctx, { proveedorId: args.proveedorId, fecha: hoy.dia, entregaEl: args.entregaEl ?? s.necesariaEl, notas: s.motivo, sucursalId: args.sucursalId ?? null, igvPorcentaje: IGV_DE_COMPRA_POR_DEFECTO }, p);
    await reemplazarLineas(tx, ctx, ordenId, p.lineas);
    await actualizarSolicitud(tx, ctx, s.id, { estado: 'convertida', ordenId, resuelta: true, resueltoPor: s.resueltoPor ?? ctx.usuarioId });
    return responder(tx, ctx, s.id);
  },
});

export const solicitudAnular = definirHerramienta('solicitud_anular', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anular una solicitud de compra',
    paraQueSirve: 'Descarta una solicitud que todavía no se convirtió en orden. Se queda en la lista como anulada, con el motivo.',
    cuandoUsarla: 'Cuando ya no hace falta lo que se pidió o se cargó por error.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Se compró por otra vía' }],
    ejemploTecleado: 'anular la solicitud de papel, ya no la necesitamos',
    ejemploHablado: 'anula esa solicitud',
    erroresComunes: ['Una solicitud convertida en orden no se anula: cancela la orden.', 'Indica el motivo.'],
    relacionadas: ['solicitudes_listar'],
  },
  auditar: auditarSolicitud,
  async ejecutar(args, ctx, tx) {
    const s = await verSolicitud(tx, ctx, args.id, { bloquear: true });
    if (!s) return rechazo('no_encontrado', NO_EXISTE);
    if (!['borrador', 'pendiente', 'aprobada'].includes(s.estado)) return rechazo('conflicto', 'Solo se anula una solicitud en borrador, pendiente o aprobada.');
    await actualizarSolicitud(tx, ctx, s.id, { estado: 'anulada', motivoResolucion: args.motivo });
    return responder(tx, ctx, s.id);
  },
});

export const solicitudVer = definirHerramienta('solicitud_ver', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una solicitud de compra',
    paraQueSirve: 'Muestra el estado, las líneas, quién la pidió y quién la resolvió.',
    cuandoUsarla: 'Cuando necesitas revisar lo que se pidió o saber en qué va.',
    campos: [ID],
    ejemploTecleado: 'ver la solicitud SC-0001-2026',
    ejemploHablado: 'cómo va la solicitud de papel',
    erroresComunes: ['La solicitud no existe o es de otra empresa.'],
    relacionadas: ['solicitudes_listar'],
  },
  async ejecutar(args, ctx, tx) {
    return responder(tx, ctx, args.id);
  },
});

export const solicitudesListar = definirHerramienta('solicitudes_listar', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las solicitudes de compra',
    paraQueSirve: 'Muestra las solicitudes, las más recientes primero y por páginas. Por defecto, las que siguen abiertas.',
    cuandoUsarla: 'Para ver qué espera aprobación o qué falta convertir en orden.',
    campos: [{ nombre: 'estado', queSeAnota: 'abiertas, borrador, pendiente, aprobada, rechazada, convertida, anulada o todas.', ejemplo: 'pendiente' }, { nombre: 'limite', queSeAnota: 'Cuántas por página, hasta 100.', ejemplo: '25' }],
    ejemploTecleado: 'solicitudes pendientes de aprobar',
    ejemploHablado: 'qué solicitudes esperan aprobación',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['solicitud_ver', 'solicitud_resolver'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarSolicitudes(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const lineas = await lineasDeSolicitudes(tx, ctx, r.items.map((s) => s.id));
    return exito({ items: r.items.map((s) => aSolicitudDto(s, lineas.get(s.id) ?? [])), siguiente: r.siguiente });
  },
});
