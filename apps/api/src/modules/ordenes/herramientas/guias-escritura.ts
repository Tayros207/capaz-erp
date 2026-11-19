import { SERIE_DE_GUIA, rechazo, type ArgsDe } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import {
  ANIO_DEL_CORRELATIVO_DE_GUIA,
  CLAVE_DE_CORRELATIVO_DE_GUIA,
  codigoDeGuia,
  comprobarAnulacion,
  comprobarPedidoParaGuia,
  normalizarTraslado,
  prepararLineasDeGuia,
  type LineaDeGuiaPreparada,
} from '../domain/guia.js';
import { codigoDePedido } from '../domain/pedido.js';
import {
  cantidadesEnviadas,
  clienteParaGuia,
  insertarGuia,
  insertarLineasDeGuia,
  lineasDePedidosParaGuia,
  marcarGuiaAnulada,
  pedidosDeGuias,
  verGuia,
  type ClienteParaGuia,
} from '../repositories/guias.repository.js';
import { registrarEvento, verPedido } from '../repositories/pedidos.repository.js';
import { MODULO, NO_EXISTE, alcanceDePedidos, estadoDe } from './comunes.js';
import { ID_DE_GUIA, NO_EXISTE_GUIA, auditarGuia, responderGuia } from './guias-comunes.js';

type Fallo = { ok: false; error: { codigo: 'argumentos_invalidos' | 'conflicto' | 'no_encontrado'; mensaje: string } };
const fallo = (codigo: Fallo['error']['codigo'], mensaje: string): Fallo => rechazo(codigo, mensaje) as Fallo;
const MAXIMO = 20;

/** Bloquea los pedidos citados (en orden ascendente de id: sin ciclos de bloqueo) y comprueba estado y cliente. */
async function cargarYBloquearPedidos(tx: Transaccion, ctx: ContextoDeHerramienta, pedidoIds: readonly string[], clienteId: string): Promise<Fallo | null> {
  for (const id of pedidoIds) {
    const p = await verPedido(tx, ctx, id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!p) return fallo('no_encontrado', NO_EXISTE);
    const paso = comprobarPedidoParaGuia({ estado: estadoDe(p), clienteId: p.clienteId, codigo: codigoDePedido(p.serie, p.anio, p.numero) }, clienteId);
    if (!paso.ok) return fallo('conflicto', paso.motivo);
  }
  return null;
}

type Preparadas = { ok: true; lineas: LineaDeGuiaPreparada[]; pedidoIds: string[] } | Fallo;

/** Con los pedidos bloqueados, relee lo pedido y lo enviado y arma las líneas de la guía. */
async function prepararYBloquear(tx: Transaccion, ctx: ContextoDeHerramienta, args: ArgsDe<'guia_emitir'>): Promise<Preparadas> {
  const lineaIds = args.lineas.flatMap((l) => (l.tipo === 'pedido' ? [l.pedidoLineaId] : []));
  const primeras = await lineasDePedidosParaGuia(tx, ctx, { lineaIds });
  const pedidoIds = [...new Set(primeras.map((l) => l.pedidoId))].sort();
  if (pedidoIds.length > MAXIMO) return fallo('argumentos_invalidos', 'Una guía lleva hasta 20 pedidos.');
  const bloqueo = await cargarYBloquearPedidos(tx, ctx, pedidoIds, args.clienteId);
  if (bloqueo) return bloqueo;
  const lineas = await lineasDePedidosParaGuia(tx, ctx, { lineaIds });
  const enviadas = await cantidadesEnviadas(tx, ctx, pedidoIds);
  const r = prepararLineasDeGuia(args.lineas, new Map(lineas.map((l) => [l.id, l])), enviadas);
  return r.ok ? { ok: true, lineas: r.lineas, pedidoIds } : fallo(r.codigo, r.motivo);
}

async function guardarGuia(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  args: ArgsDe<'guia_emitir'>,
  cliente: ClienteParaGuia,
  p: { lineas: LineaDeGuiaPreparada[]; pedidoIds: string[] },
): Promise<string> {
  const hoy = await hoyDeLaEmpresa(tx);
  // El número se toma al final: si algo falla antes o después, la transacción lo devuelve (sin huecos).
  const numero = await siguienteNumero(tx, CLAVE_DE_CORRELATIVO_DE_GUIA, { serie: SERIE_DE_GUIA, anio: ANIO_DEL_CORRELATIVO_DE_GUIA });
  const serie = SERIE_DE_GUIA;
  const traslado = normalizarTraslado(args);
  const id = await insertarGuia(tx, ctx, { ...traslado, serie, numero, clienteId: cliente.id, destinatarioNombre: cliente.nombre, fechaEmision: hoy.dia });
  await insertarLineasDeGuia(tx, ctx, id, p.lineas);
  for (const pedidoId of p.pedidoIds) await registrarEvento(tx, ctx, pedidoId, { tipo: 'guia_emitida', guiaId: id });
  await emitir(tx, 'guia.emitida', { id, codigo: codigoDeGuia(serie, numero), clienteId: cliente.id, pedidoIds: p.pedidoIds, lineas: p.lineas.length });
  return id;
}

export const guiaEmitir = definirHerramienta('guia_emitir', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Emitir una guía de remisión',
    paraQueSirve: 'Emite una guía de entrega interna (sin valor tributario) para un cliente, con lo que se envía de uno o varios de sus pedidos y, si hace falta, líneas libres. Guarda destinatario, traslado y líneas para reimprimirla idéntica. No cambia el estado del pedido.',
    cuandoUsarla: 'Cuando el trabajo sale hacia el cliente y quieres dejar constancia de lo que se envía.',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'El cliente destinatario: todos los pedidos citados son suyos.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'fechaTraslado', queSeAnota: 'Día del traslado.', ejemplo: '2026-03-10' },
      { nombre: 'puntoPartida', queSeAnota: 'Dirección de salida.', ejemplo: 'Av. Lima 100' },
      { nombre: 'puntoLlegada', queSeAnota: 'Dirección de llegada.', ejemplo: 'Jr. Cusco 200' },
      { nombre: 'motivo', queSeAnota: 'venta, entrega_de_trabajo, traslado_entre_locales u otro (con detalle).', ejemplo: 'venta' },
      { nombre: 'modalidad', queSeAnota: 'privado (propio) o publico (con transportista).', ejemplo: 'privado' },
      { nombre: 'lineas', queSeAnota: 'Líneas de pedido (pedidoLineaId y cantidad) o libres (descripción y cantidad), en milésimas.', ejemplo: '[{"tipo":"pedido","pedidoLineaId":"…","cantidadMilesimas":2000}]' },
    ],
    ejemploTecleado: 'emitir una guía a Imprenta Sol con las 2 cajas del pedido PED-PRI-2026-0007',
    ejemploHablado: 'saca la guía de lo que sale hoy para Imprenta Sol',
    erroresComunes: ['Una línea pide más de lo que queda por enviar.', 'El pedido no está listo ni entregado, o es de otro cliente.', 'Con el motivo «otro» indica cuál; con transporte público indica el transportista.'],
    relacionadas: ['guia_preparar', 'guia_ver', 'guia_anular'],
  },
  auditar: auditarGuia,
  async ejecutar(args, ctx, tx) {
    const cliente = await clienteParaGuia(tx, ctx, args.clienteId);
    if (!cliente?.vigente) return rechazo('argumentos_invalidos', 'El cliente no existe o está archivado.');
    const p = await prepararYBloquear(tx, ctx, args);
    if (!p.ok) return p;
    return responderGuia(tx, ctx, await guardarGuia(tx, ctx, args, cliente, p));
  },
});

export const guiaAnular = definirHerramienta('guia_anular', {
  modulo: MODULO,
  permiso: 'ordenes:cancelar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Anular una guía de remisión',
    paraQueSirve: 'Anula una guía emitida y guarda el motivo. La guía no se borra ni su número se vuelve a usar; lo que enviaba vuelve a quedar pendiente en sus pedidos.',
    cuandoUsarla: 'Cuando la guía se emitió por error o el envío no se hizo.',
    campos: [ID_DE_GUIA, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Se emitió con la cantidad equivocada' }],
    ejemploTecleado: 'anular la guía G001-000007 porque se emitió con la cantidad equivocada',
    ejemploHablado: 'anula la guía siete, estaba mal',
    erroresComunes: ['La guía ya estaba anulada.', 'La guía cambió mientras confirmabas: vuelve a pedir la anulación.'],
    relacionadas: ['guia_ver', 'guia_emitir'],
  },
  auditar: auditarGuia,
  async resumir(args, ctx, tx) {
    const g = await verGuia(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx) });
    if (!g) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE_GUIA } };
    const paso = comprobarAnulacion(g.estado as 'emitida' | 'anulada');
    if (!paso.ok) return { ok: false, error: { codigo: 'conflicto', mensaje: paso.motivo } };
    return {
      ok: true,
      resumen: {
        resumen: `Se anulará la guía ${codigoDeGuia(g.serie, g.numero)} de ${g.destinatarioNombre} (${g.lineas} líneas). Su número no se vuelve a usar y lo enviado vuelve a quedar pendiente.`,
        huella: hashCanonico({ estado: g.estado }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const g = await verGuia(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!g) return rechazo('no_encontrado', NO_EXISTE_GUIA);
    const paso = comprobarAnulacion(g.estado as 'emitida' | 'anulada');
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    await marcarGuiaAnulada(tx, ctx, g.id, args.motivo);
    const pedidos = (await pedidosDeGuias(tx, ctx, [g.id])).get(g.id) ?? [];
    for (const p of pedidos) await registrarEvento(tx, ctx, p.id, { tipo: 'guia_anulada', guiaId: g.id, nota: args.motivo });
    await emitir(tx, 'guia.anulada', { id: g.id, codigo: codigoDeGuia(g.serie, g.numero), clienteId: g.clienteId, pedidoIds: pedidos.map((p) => p.id) });
    return responderGuia(tx, ctx, g.id);
  },
});
