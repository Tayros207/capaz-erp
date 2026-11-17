import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { evaluarReferencias, normalizarNombre, resumenDeCambioDePrecios } from '../domain/lista.js';
import { asegurarConfiguracion } from '../repositories/configuracion.repository.js';
import { archivarLista, bloquearLista, restaurarLista, crearLista, editarLista, listaActivaConNombre, listaActivaDeProducto, productoVivo, verLista, type ListaDePrecio } from '../repositories/listas.repository.js';
import { ID_DE_EJEMPLO, MODULO, rechazoDe } from './comun.js';
import { nombreRepetido, NO_EXISTE_LA_LISTA, prepararEdicion, productoYaTieneLista } from './listas-edicion.js';
import { listaADto } from './listas-respuesta.js';

// Escrituras de la lista de precios: crear, editar (crítica) y archivar. Los precios van SIN IGV.

const ID = { nombre: 'id', queSeAnota: 'Identificador de la lista.', ejemplo: ID_DE_EJEMPLO };
const AUDITAR = (_a: unknown, d: { id: string; aConfirmado: boolean } | null) => ({
  entidadTipo: 'lista_precio',
  entidadId: d?.id,
  resumen: d ? { aConfirmado: d.aConfirmado } : undefined,
});
/** Lo que se confirma al editar: si cualquiera de estos datos cambia, la confirmación deja de valer. */
const huellaDe = (f: ListaDePrecio) =>
  hashCanonico({
    p100: f.p100Centimos,
    p1000: f.p1000Centimos,
    p5000: f.p5000Centimos,
    modoIntermedio: f.modoIntermedio,
    precioMinimo: f.precioMinimoCentimos,
    archivadoEn: f.archivadoEn?.toISOString() ?? null,
  });

export const listaPrecioCrear = definirHerramienta('lista_precio_crear', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear un producto en la lista de precios',
    paraQueSirve: 'Guarda el precio de un producto para 100, 1.000 y 5.000 unidades (sin IGV); las cantidades intermedias se calculan solas.',
    cuandoUsarla: 'Cuando quieres poder cotizar al instante un producto que vendes seguido.',
    campos: [
      { nombre: 'nombre', queSeAnota: 'Cómo llamas al producto.', ejemplo: 'Volantes A5 4/4 couché 150 g' },
      { nombre: 'p100Centimos', queSeAnota: 'Total de 100 unidades en céntimos, sin IGV.', ejemplo: '19000' },
      { nombre: 'p1000Centimos', queSeAnota: 'Total de 1.000 unidades en céntimos, sin IGV.', ejemplo: '58000' },
      { nombre: 'p5000Centimos', queSeAnota: 'Total de 5.000 unidades en céntimos, sin IGV.', ejemplo: '120000' },
      { nombre: 'modoIntermedio', queSeAnota: 'curva (por defecto) o escalon.', ejemplo: 'curva' },
      { nombre: 'confirmarUnitarioNoBaja', queSeAnota: 'true si aceptas que el unitario no baje al subir la cantidad.', ejemplo: 'false' },
    ],
    ejemploTecleado: 'crear volantes A5 con 100 a 190, 1000 a 580 y 5000 a 1200',
    ejemploHablado: 'agrega volantes a cinco: cien a ciento noventa, mil a quinientos ochenta y cinco mil a mil doscientos',
    erroresComunes: ['Ya existe una lista con ese nombre.', 'El total no crece con la cantidad: corrige los precios.', 'El unitario no baja: confirma para guardarlo igual.'],
    relacionadas: ['listas_precio_listar', 'lista_precio_editar', 'precio_consultar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const v = evaluarReferencias(args, args.confirmarUnitarioNoBaja);
    if (!v.ok) return rechazoDe(v);
    const producto = args.productoId ? await productoVivo(tx, ctx, args.productoId) : null;
    if (args.productoId && !producto) return rechazo('no_encontrado', 'No existe ese producto o está archivado.');
    if (producto) {
      const deProducto = await listaActivaDeProducto(tx, ctx, producto.id);
      if (deProducto) return productoYaTieneLista(deProducto);
    }
    const normalizado = normalizarNombre(args.nombre);
    const otra = await listaActivaConNombre(tx, ctx, normalizado);
    if (otra) return nombreRepetido(otra);
    const r = await crearLista(tx, ctx, {
      nombre: args.nombre,
      nombreNormalizado: normalizado,
      unidad: args.unidad ?? producto?.unidad.slice(0, 20) ?? 'unidad',
      productoId: args.productoId ?? null,
      p100Centimos: args.p100Centimos,
      p1000Centimos: args.p1000Centimos,
      p5000Centimos: args.p5000Centimos,
      modoIntermedio: args.modoIntermedio,
      precioMinimoCentimos: args.precioMinimoCentimos ?? null,
      aConfirmado: v.aConfirmado,
    });
    return r.creada ? exito(await listaADto(tx, ctx, r.lista, await hoyDeLaEmpresa(tx))) : nombreRepetido(r.existente);
  },
});

export const listaPrecioEditar = definirHerramienta('lista_precio_editar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Cambiar un producto de la lista de precios',
    paraQueSirve: 'Cambia el nombre, la unidad, los precios de 100, 1.000 o 5.000 unidades, el modo entre cantidades o el precio mínimo.',
    cuandoUsarla: 'Cuando sube o baja el costo de un producto. Las cotizaciones ya emitidas no cambian.',
    campos: [
      ID,
      { nombre: 'p100Centimos', queSeAnota: 'Nuevo total de 100 unidades en céntimos, sin IGV.', ejemplo: '19000' },
      { nombre: 'precioMinimoCentimos', queSeAnota: 'Piso del precio en céntimos, o null para quitarlo.', ejemplo: '25000' },
    ],
    ejemploTecleado: 'cambiar el precio de 100 volantes a 190',
    ejemploHablado: 'sube a ciento noventa el precio de cien volantes',
    erroresComunes: [
      'Hay que indicar al menos un dato.',
      'Una lista archivada no se edita.',
      'La confirmación venció o la lista cambió: vuelve a pedirla.',
      'El unitario no baja: confirma para guardarlo igual.',
    ],
    relacionadas: ['lista_precio_ver', 'lista_precio_archivar'],
  },
  auditar: AUDITAR,
  async resumir(args, ctx, tx) {
    const actual = await verLista(tx, ctx, args.id);
    if (!actual) return rechazo('no_encontrado', NO_EXISTE_LA_LISTA);
    const p = await prepararEdicion(tx, ctx, actual, args);
    if (!p.ok) return p;
    return { ok: true, resumen: { resumen: resumenDeCambioDePrecios(actual.nombre, p.valor.antes, p.valor.despues), huella: huellaDe(actual) } };
  },
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const actual = await bloquearLista(tx, ctx, args.id);
    if (!actual) return rechazo('no_encontrado', NO_EXISTE_LA_LISTA);
    const p = await prepararEdicion(tx, ctx, actual, args);
    if (!p.ok) return p;
    return exito(await listaADto(tx, ctx, await editarLista(tx, ctx, actual.id, p.valor.cambios), await hoyDeLaEmpresa(tx)));
  },
});

export const listaPrecioArchivar = definirHerramienta('lista_precio_archivar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar un producto de la lista de precios',
    paraQueSirve: 'Oculta un producto que ya no vendes. Sus cotizaciones se conservan; ya no se puede cotizar con él.',
    cuandoUsarla: 'Cuando dejas de ofrecer un producto o lo reemplazas por otro.',
    campos: [ID],
    ejemploTecleado: 'archivar la lista Volantes A5',
    ejemploHablado: 'ya no vendo volantes a cinco',
    erroresComunes: ['La lista no existe o es de otra empresa.'],
    relacionadas: ['listas_precio_listar', 'lista_precio_crear'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const f = await archivarLista(tx, ctx, args.id);
    return f ? exito(await listaADto(tx, ctx, f, await hoyDeLaEmpresa(tx))) : rechazo('no_encontrado', NO_EXISTE_LA_LISTA);
  },
});

export const listaPrecioRestaurar = definirHerramienta('lista_precio_restaurar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Restaurar un producto archivado de la lista de precios',
    paraQueSirve: 'Vuelve a activar un producto archivado: se puede editar y cotizar otra vez. Si ya está activo, no cambia nada.',
    cuandoUsarla: 'Cuando archivaste un producto por error o vuelves a venderlo.',
    campos: [ID],
    ejemploTecleado: 'restaurar la lista Volantes A5',
    ejemploHablado: 'vuelvo a vender volantes a cinco',
    erroresComunes: ['La lista no existe o es de otra empresa.', 'Otra lista activa ya usa ese nombre o ese producto: archívala o cámbiale el nombre primero.'],
    relacionadas: ['listas_precio_listar', 'lista_precio_archivar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const actual = await bloquearLista(tx, ctx, args.id);
    if (!actual) return rechazo('no_encontrado', NO_EXISTE_LA_LISTA);
    if (actual.archivadoEn) {
      const conNombre = await listaActivaConNombre(tx, ctx, actual.nombreNormalizado, actual.id);
      if (conNombre) return nombreRepetido(conNombre);
      const deProducto = actual.productoId ? await listaActivaDeProducto(tx, ctx, actual.productoId, actual.id) : null;
      if (deProducto) return productoYaTieneLista(deProducto);
    }
    const f = await restaurarLista(tx, ctx, actual.id);
    return exito(await listaADto(tx, ctx, f ?? actual, await hoyDeLaEmpresa(tx)));
  },
});
