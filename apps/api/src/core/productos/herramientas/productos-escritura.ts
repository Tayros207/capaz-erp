import { exito, rechazo, type ArgsDe } from '@capaz/shared';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { emitir } from '../../eventos/emisor.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { prepararProducto, type EntradaDeProducto } from '../domain/producto.js';
import {
  archivarProducto,
  crearProducto,
  editarProducto,
  restaurarProducto,
  verProducto,
  type Choque,
  type Producto,
} from '../repositories/productos.repository.js';
import { aCandidata, aProductoDto } from './producto-mapeo.js';

const eventoDe = (f: Producto) => ({
  id: f.id,
  codigo: f.codigo,
  nombre: f.nombre,
  tipo: f.tipo as 'producto' | 'servicio',
  unidad: f.unidad,
  precioUnitarioMilesimas: f.precioUnitarioMilesimas,
});
const emitirActualizado = (tx: Transaccion, f: Producto) => emitir(tx, 'producto.actualizado', { ...eventoDe(f), archivado: f.archivadoEn !== null });

const conflictoDe = (c: Choque) =>
  rechazo(
    'conflicto',
    c.conflicto === 'nombre' ? `Ya existe un producto llamado «${c.existente.nombre}».` : `Ya existe un producto con el código ${c.existente.codigo}: «${c.existente.nombre}».`,
    [aCandidata(c.existente)],
  );

const AUDITAR = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'producto', entidadId: d?.id });

export const productosCrear = definirHerramienta('productos_crear', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear un producto o servicio',
    paraQueSirve: 'Agrega un producto o servicio al catálogo. Si ya existe uno con el mismo nombre o código, te lo muestra en lugar de duplicarlo.',
    cuandoUsarla: 'Cuando vendes algo que todavía no está en tu catálogo.',
    campos: [
      { nombre: 'nombre', queSeAnota: 'Nombre del producto o servicio.', ejemplo: 'Tarjetas de presentación x100' },
      { nombre: 'precioUnitarioMilesimas', queSeAnota: 'Precio en milésimas de sol (S/ 25.00 son 25000).', ejemplo: '25000' },
      { nombre: 'unidad', queSeAnota: 'Unidad de venta (opcional).', ejemplo: 'millar' },
      { nombre: 'codigo', queSeAnota: 'Código propio (opcional).', ejemplo: 'TAR-100' },
    ],
    ejemploTecleado: 'crear producto Tarjetas de presentación x100 a 25 soles',
    ejemploHablado: 'agrega al catálogo tarjetas de presentación por cien a veinticinco soles',
    erroresComunes: ['Ya existe un producto con ese nombre o código: elige el existente.', 'El precio no puede ser negativo.'],
    relacionadas: ['productos_buscar', 'productos_editar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const p = prepararProducto(args as EntradaDeProducto);
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const r = await crearProducto(tx, ctx, p.datos);
    if (!r.creado) return conflictoDe(r);
    await emitir(tx, 'producto.creado', eventoDe(r.producto));
    return exito(aProductoDto(r.producto));
  },
});

function fusionar(actual: Producto, a: ArgsDe<'productos_editar'>): EntradaDeProducto {
  return {
    codigo: a.codigo !== undefined ? a.codigo : actual.codigo,
    nombre: a.nombre ?? actual.nombre,
    tipo: a.tipo ?? (actual.tipo as EntradaDeProducto['tipo']),
    unidad: a.unidad ?? actual.unidad,
    precioUnitarioMilesimas: a.precioUnitarioMilesimas ?? actual.precioUnitarioMilesimas,
    afectoIgv: a.afectoIgv ?? actual.afectoIgv,
    descripcion: a.descripcion !== undefined ? a.descripcion : actual.descripcion,
  };
}

export const productosEditar = definirHerramienta('productos_editar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar un producto o servicio',
    paraQueSirve: 'Cambia los datos de un producto. Envías solo lo que cambia.',
    cuandoUsarla: 'Cuando cambia su precio, su unidad o hay que corregir su nombre.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador del producto.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000002' },
      { nombre: 'precioUnitarioMilesimas', queSeAnota: 'Precio nuevo en milésimas de sol.', ejemplo: '28000' },
    ],
    ejemploTecleado: 'subir el precio de tarjetas de presentación a 28 soles',
    ejemploHablado: 'las tarjetas de presentación ahora cuestan veintiocho soles',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Otro producto ya usa ese nombre o código.'],
    relacionadas: ['productos_ver', 'productos_archivar'],
  },
  auditar: (a) => ({ entidadTipo: 'producto', entidadId: a.id, resumen: { campos: Object.keys(a).filter((k) => k !== 'id' && a[k as keyof typeof a] !== undefined).sort().join(',') } }),
  async ejecutar(args, ctx, tx) {
    const actual = await verProducto(tx, ctx, args.id);
    if (!actual) return rechazo('no_encontrado', 'No existe ese producto.');
    const p = prepararProducto(fusionar(actual, args));
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const r = await editarProducto(tx, ctx, args.id, p.datos);
    if (!r) return rechazo('no_encontrado', 'No existe ese producto.');
    if ('conflicto' in r) return conflictoDe(r);
    await emitirActualizado(tx, r.producto);
    return exito(aProductoDto(r.producto));
  },
});

export const productosArchivar = definirHerramienta('productos_archivar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar un producto o servicio',
    paraQueSirve: 'Lo oculta del catálogo sin borrar su historia. Se puede restaurar.',
    cuandoUsarla: 'Cuando dejas de vender algo.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del producto.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000002' }],
    ejemploTecleado: 'archivar el producto tarjetas de presentación',
    ejemploHablado: 'archiva las tarjetas de presentación',
    erroresComunes: ['El producto no existe o es de otra empresa.'],
    relacionadas: ['productos_restaurar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const f = await archivarProducto(tx, ctx, args.id);
    if (!f) return rechazo('no_encontrado', 'No existe ese producto.');
    await emitirActualizado(tx, f);
    return exito(aProductoDto(f));
  },
});

export const productosRestaurar = definirHerramienta('productos_restaurar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Restaurar un producto o servicio',
    paraQueSirve: 'Lo devuelve al catálogo. Si otro producto ya tomó su nombre, te avisa.',
    cuandoUsarla: 'Cuando vuelves a vender algo que habías archivado.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del producto.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000002' }],
    ejemploTecleado: 'restaurar el producto tarjetas de presentación',
    ejemploHablado: 'vuelve a activar las tarjetas de presentación',
    erroresComunes: ['Otro producto activo ya usa ese nombre: cámbiale el nombre a uno de los dos.'],
    relacionadas: ['productos_archivar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const r = await restaurarProducto(tx, ctx, args.id);
    if (!r) return rechazo('no_encontrado', 'No existe ese producto.');
    if ('conflicto' in r) return conflictoDe(r);
    await emitirActualizado(tx, r.producto);
    return exito(aProductoDto(r.producto));
  },
});
