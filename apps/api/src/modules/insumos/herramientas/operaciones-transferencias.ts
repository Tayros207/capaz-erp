import { exito, rechazo, type Respuesta, type TransferenciaDeInsumosDto } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { movimientoManual } from '../domain/existencia.js';
import { verArticulo } from '../repositories/articulos.repository.js';
import { sucursalParaMover } from '../repositories/existencias.repository.js';
import { agregarLineasDeTransferencia, crearTransferencia, lineasDeTransferencias, listarTransferencias, verTransferencia } from '../repositories/operaciones.repository.js';
import { CAMPO_SUCURSAL, CURSOR_INVALIDO, MODULO, SUCURSAL_INVALIDA } from './comunes.js';
import { aTransferenciaDto } from './operaciones-mapeo.js';
import { registrarMovimiento } from './registrar-movimiento.js';
import { rechazoDeMovimiento } from './respuestas.js';

export const CLAVE_DE_TRANSFERENCIA = 'insumos_transferencia';
const ID_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000040';
const NO_EXISTE = 'No existe esa transferencia.';

async function responder(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<TransferenciaDeInsumosDto>> {
  const t = await verTransferencia(tx, ctx, id);
  if (!t) return rechazo('no_encontrado', NO_EXISTE);
  const lineas = await lineasDeTransferencias(tx, ctx, [id]);
  return exito(aTransferenciaDto(t, lineas.get(id) ?? []));
}

export const transferenciaCrear = definirHerramienta('transferencia_crear', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Transferir mercadería entre sucursales',
    paraQueSirve: 'Pasa artículos de una sucursal a otra: resta de la sucursal de origen y suma en la de destino, todo junto y con un número. Si algo no alcanza en el origen, no se mueve nada.',
    cuandoUsarla: 'Cuando se envía mercadería de un almacén o tienda a otro.',
    campos: [
      { nombre: 'origenSucursalId', queSeAnota: 'Sucursal de la que sale.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000030' },
      { nombre: 'destinoSucursalId', queSeAnota: 'Sucursal a la que llega.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000031' },
      { nombre: 'lineas', queSeAnota: 'Qué se envía: por línea, el artículo y la cantidad en milésimas.', ejemplo: '[{ "articuloId": "0192f0c4-7b1e-7000-8000-000000000020", "cantidadMilesimas": 5000 }]' },
      { nombre: 'nota', queSeAnota: 'Indicaciones o guía de transporte (opcional).', ejemplo: 'Camión de la tarde' },
    ],
    ejemploTecleado: 'transferir 5 paquetes de papel bond de Lima a Cusco',
    ejemploHablado: 'manda cinco paquetes de papel bond de Lima a Cusco',
    erroresComunes: ['No alcanza: la sucursal de origen tiene menos de lo que envías.', 'El origen y el destino deben ser distintos.', 'Un artículo no puede repetirse ni estar archivado.'],
    relacionadas: ['transferencia_ver', 'existencias_listar', 'existencia_mover'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'transferencia', entidadId: d?.id, ...(d && { resumen: { numero: d.numero, anio: d.anio, lineas: d.lineas.length } }) }),
  async ejecutar(args, ctx, tx) {
    if (args.origenSucursalId === args.destinoSucursalId) return rechazo('argumentos_invalidos', 'El origen y el destino deben ser distintos.');
    if (new Set(args.lineas.map((l) => l.articuloId)).size !== args.lineas.length) return rechazo('argumentos_invalidos', 'Un artículo no puede repetirse en la transferencia.');
    const [origen, destino] = [await sucursalParaMover(tx, ctx, args.origenSucursalId), await sucursalParaMover(tx, ctx, args.destinoSucursalId)];
    if (!origen || !destino) return rechazo('argumentos_invalidos', SUCURSAL_INVALIDA);
    // En orden de artículo: dos transferencias a la vez toman los bloqueos en el mismo orden y no se cruzan.
    const ordenadas = [...args.lineas].sort((a, b) => a.articuloId.localeCompare(b.articuloId));
    const articulos = [];
    for (const l of ordenadas) {
      const articulo = await verArticulo(tx, ctx, l.articuloId, { bloquear: true });
      if (!articulo) return rechazo('no_encontrado', 'No existe uno de los artículos.');
      if (articulo.archivadoEn) return rechazo('conflicto', `«${articulo.nombre}» está archivado: actívalo de nuevo para moverlo.`);
      articulos.push({ articulo, cantidadMilesimas: l.cantidadMilesimas });
    }
    const hoy = await hoyDeLaEmpresa(tx);
    const numero = await siguienteNumero(tx, CLAVE_DE_TRANSFERENCIA, { anio: hoy.anio });
    const id = await crearTransferencia(tx, ctx, { numero, anio: hoy.anio, origenSucursalId: origen.id, destinoSucursalId: destino.id, fecha: args.fecha, nota: args.nota || null });
    await agregarLineasDeTransferencia(tx, ctx, id, args.lineas);
    const motivo = `Transferencia ${numero}-${hoy.anio}`;
    for (const { articulo, cantidadMilesimas } of articulos) {
      const salida = await registrarMovimiento(tx, ctx, { articulo, sucursal: origen, movimiento: movimientoManual('salida', cantidadMilesimas), costoUnitarioMilesimas: null, motivo, origen: { tipo: 'transferencia_salida', id } });
      if (!salida.ok) return rechazoDeMovimiento(salida);
      const entrada = await registrarMovimiento(tx, ctx, { articulo, sucursal: destino, movimiento: movimientoManual('entrada', cantidadMilesimas), costoUnitarioMilesimas: articulo.ultimoCostoMilesimas, motivo, origen: { tipo: 'transferencia_entrada', id } });
      if (!entrada.ok) return rechazoDeMovimiento(entrada);
    }
    await emitir(tx, 'transferencia.creada', { id, origenSucursalId: origen.id, destinoSucursalId: destino.id, lineas: args.lineas.length });
    return responder(tx, ctx, id);
  },
});

export const transferenciaVer = definirHerramienta('transferencia_ver', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una transferencia',
    paraQueSirve: 'Muestra el número, las sucursales, la fecha y los artículos de una transferencia.',
    cuandoUsarla: 'Cuando necesitas saber qué se envió y a dónde.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la transferencia.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'ver la transferencia 3 de este año',
    ejemploHablado: 'qué mandamos a Cusco ayer',
    erroresComunes: ['La transferencia no existe o es de otra empresa.'],
    relacionadas: ['transferencias_listar'],
  },
  async ejecutar(args, ctx, tx) {
    return responder(tx, ctx, args.id);
  },
});

export const transferenciasListar = definirHerramienta('transferencias_listar', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las transferencias',
    paraQueSirve: 'Muestra las transferencias entre sucursales, las más recientes primero y por páginas.',
    cuandoUsarla: 'Cuando quieres revisar qué se movió entre sucursales.',
    campos: [CAMPO_SUCURSAL, { nombre: 'limite', queSeAnota: 'Cuántas por página, hasta 100.', ejemplo: '25' }],
    ejemploTecleado: 'ver las transferencias de Cusco',
    ejemploHablado: 'muéstrame las transferencias recientes',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['transferencia_ver', 'transferencia_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarTransferencias(tx, ctx, { limite: args.limite, cursor: args.cursor, sucursalId: args.sucursalId });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', CURSOR_INVALIDO);
    const lineas = await lineasDeTransferencias(tx, ctx, r.items.map((t) => t.id));
    return exito({ items: r.items.map((t) => aTransferenciaDto(t, lineas.get(t.id) ?? [])), siguiente: r.siguiente });
  },
});
