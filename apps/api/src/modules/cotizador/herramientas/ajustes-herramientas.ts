import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { validarAjusteDeCliente } from '../domain/configuracion.js';
import { ajusteDe, existeCliente, fijarAjuste, listarAjustes, quitarAjuste } from '../repositories/ajustes.repository.js';
import { asegurarConfiguracion } from '../repositories/configuracion.repository.js';
import { ID_DE_EJEMPLO, MODULO, rechazoDe } from './comun.js';
import { aAjusteDto } from './mapeo.js';

// Ajuste por cliente: un porcentaje (con signo) que se aplica al precio de lista de ese cliente.

export const ajustesClienteListar = definirHerramienta('ajustes_cliente_listar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar los ajustes por cliente',
    paraQueSirve: 'Muestra los clientes con un descuento o recargo fijo sobre la lista de precios (máximo 500).',
    cuandoUsarla: 'Para revisar a quién le haces precio especial.',
    campos: [],
    ejemploTecleado: 'ver los clientes con descuento',
    ejemploHablado: 'a quién le doy precio especial',
    erroresComunes: ['Si la lista sale vacía, ningún cliente tiene ajuste.'],
    relacionadas: ['ajuste_cliente_fijar', 'precio_consultar'],
  },
  async ejecutar(_args, ctx, tx) {
    const filas = await listarAjustes(tx, ctx);
    return exito({ items: filas.map((f) => aAjusteDto(f, f.clienteNombre)), siguiente: null });
  },
});

export const ajusteClienteFijar = definirHerramienta('ajuste_cliente_fijar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Fijar el ajuste de un cliente',
    paraQueSirve: 'Da a un cliente un porcentaje fijo sobre la lista: negativo es descuento, positivo es recargo. Con null o 0 se quita.',
    cuandoUsarla: 'Cuando un cliente tiene un trato especial de precios.',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'El cliente.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'porcentaje', queSeAnota: 'Porcentaje con signo (de -100 a 500), o null para quitarlo.', ejemplo: '-5' },
      { nombre: 'nota', queSeAnota: 'Por qué (opcional).', ejemplo: 'Cliente mayorista' },
    ],
    ejemploTecleado: 'dar 5% de descuento a Botica Central',
    ejemploHablado: 'a Botica Central hazle cinco por ciento menos',
    erroresComunes: ['El cliente no existe.', 'El ajuste debe estar entre -100 y 500 por ciento.'],
    relacionadas: ['ajustes_cliente_listar', 'precio_consultar'],
  },
  auditar: (a) => ({ entidadTipo: 'ajuste_cliente', entidadId: a.clienteId }),
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const v = validarAjusteDeCliente(args.porcentaje);
    if (!v.ok) return rechazoDe(v);
    const cliente = await existeCliente(tx, ctx, args.clienteId);
    if (!cliente) return rechazo('no_encontrado', 'No existe ese cliente.');
    if (v.porcentaje === null) {
      await quitarAjuste(tx, ctx, args.clienteId);
      return exito({ clienteId: args.clienteId, ajuste: null });
    }
    const nota = args.nota?.trim() ? args.nota.trim() : null;
    // Con `nota` ausente se conserva la que tenía; con texto vacío o null se borra.
    const previa = args.nota === undefined ? (await ajusteDe(tx, ctx, args.clienteId))?.nota ?? null : nota;
    const f = await fijarAjuste(tx, ctx, args.clienteId, v.porcentaje, previa);
    return exito({ clienteId: args.clienteId, ajuste: aAjusteDto(f, cliente.nombre) });
  },
});
