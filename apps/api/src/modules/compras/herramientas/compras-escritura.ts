import { IGV_DE_COMPRA_POR_DEFECTO, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { esEditable } from '../domain/estados.js';
import { comprobarFechas } from '../domain/orden.js';
import { actualizarCompra, crearCompra, reemplazarLineas, verCompra } from '../repositories/compras.repository.js';
import { ID, MODULO, NO_EXISTE, alcanceDeCompras, auditarCompra, comprobarReferencias, estadoDe, prepararLineasDe, responderCompra } from './comunes.js';

// Alta y edición del borrador de una orden de compra. Ninguna de las dos emite eventos: los de compras
// empiezan al enviar.

const CAMPOS_DE_LINEA = {
  nombre: 'lineas',
  queSeAnota: 'Lo que se compra: por línea, un producto o una descripción (gasto), la cantidad en milésimas y el costo unitario en milésimas con IGV incluido.',
  ejemplo: '[{ "descripcion": "Papel bond A4", "unidad": "millar", "cantidadMilesimas": 10000, "costoUnitarioMilesimas": 23600 }]',
};

export const compraCrear = definirHerramienta('compra_crear', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear una orden de compra',
    paraQueSirve: 'Abre una orden de compra en borrador para un proveedor, con sus líneas. Todavía no tiene número: lo recibe al enviarla.',
    cuandoUsarla: 'Cuando necesitas pedirle algo a un proveedor y quieres dejarlo anotado antes de enviarlo.',
    campos: [
      { nombre: 'proveedorId', queSeAnota: 'Identificador del proveedor (un contacto del núcleo).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'entregaEl', queSeAnota: 'Día en que el proveedor debe entregar (opcional).', ejemplo: '2026-03-15' },
      CAMPOS_DE_LINEA,
      { nombre: 'notas', queSeAnota: 'Indicaciones para el proveedor (opcional).', ejemplo: 'Entregar en el almacén de la tienda principal' },
    ],
    ejemploTecleado: 'nueva orden de compra a Papelera Andina: 10 millares de papel bond A4 a 23.60, entrega el 15 de marzo',
    ejemploHablado: 'pídele a Papelera Andina diez millares de papel bond a veintitrés sesenta para el quince',
    erroresComunes: ['El proveedor no existe o está archivado.', 'Una línea sin producto necesita descripción.', 'La entrega no puede ser anterior a la fecha de la orden.'],
    relacionadas: ['compra_editar', 'compra_enviar', 'clientes_buscar', 'productos_buscar'],
  },
  auditar: auditarCompra,
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    const entregaEl = args.entregaEl ?? null;
    const fechas = comprobarFechas(fecha, entregaEl);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    const falta = await comprobarReferencias(tx, ctx, args);
    if (falta) return rechazo('argumentos_invalidos', falta);
    const p = await prepararLineasDe(tx, ctx, args.lineas, IGV_DE_COMPRA_POR_DEFECTO);
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const datos = { proveedorId: args.proveedorId, fecha, entregaEl, notas: args.notas || null, sucursalId: args.sucursalId ?? null, igvPorcentaje: IGV_DE_COMPRA_POR_DEFECTO };
    const id = await crearCompra(tx, ctx, datos, p);
    await reemplazarLineas(tx, ctx, id, p.lineas);
    return responderCompra(tx, ctx, id);
  },
});

export const compraEditar = definirHerramienta('compra_editar', {
  modulo: MODULO,
  permiso: 'compras:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar una orden de compra en borrador',
    paraQueSirve: 'Cambia el proveedor, la entrega, la sucursal, las notas o las líneas de un borrador. Si envías líneas, reemplazan a todas las anteriores.',
    cuandoUsarla: 'Mientras la orden no se envió al proveedor y hay que corregirla o completarla.',
    campos: [ID, { nombre: 'entregaEl', queSeAnota: 'Nuevo día de entrega, o vacío para quitarlo.', ejemplo: '2026-03-20' }, CAMPOS_DE_LINEA],
    ejemploTecleado: 'cambiar la entrega del borrador de Papelera Andina al 20 de marzo',
    ejemploHablado: 'la orden de Papelera Andina que llegue el veinte',
    erroresComunes: ['Solo se edita una orden de compra en borrador.', 'Hay que indicar al menos un dato.', 'La entrega no puede ser anterior a la fecha de la orden.'],
    relacionadas: ['compra_ver', 'compra_enviar'],
  },
  auditar: (a, d) => ({
    ...auditarCompra(a, d),
    entidadId: a.id,
    resumen: { campos: Object.keys(a).filter((k) => k !== 'id' && a[k as keyof typeof a] !== undefined).sort().join(','), ...(d && { lineas: d.lineas, totalCentimos: d.totalCentimos }) },
  }),
  async ejecutar(args, ctx, tx) {
    const actual = await verCompra(tx, ctx, args.id, { alcance: alcanceDeCompras(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    if (!esEditable(estadoDe(actual))) return rechazo('conflicto', 'Solo se edita una orden de compra en borrador.');
    const { id, lineas, ...campos } = args;
    const fechas = comprobarFechas(actual.fecha, campos.entregaEl !== undefined ? campos.entregaEl : actual.entregaEl);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    const falta = await comprobarReferencias(tx, ctx, campos);
    if (falta) return rechazo('argumentos_invalidos', falta);
    let totales = {};
    if (lineas) {
      const p = await prepararLineasDe(tx, ctx, lineas, actual.igvPorcentaje);
      if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
      await reemplazarLineas(tx, ctx, id, p.lineas);
      totales = { subtotalCentimos: p.subtotalCentimos, igvCentimos: p.igvCentimos, totalCentimos: p.totalCentimos };
    }
    await actualizarCompra(tx, ctx, id, { ...campos, ...(campos.notas !== undefined && { notas: campos.notas || null }), ...totales });
    return responderCompra(tx, ctx, id);
  },
});
