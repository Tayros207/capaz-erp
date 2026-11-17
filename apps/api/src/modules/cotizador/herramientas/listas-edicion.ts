import { rechazo, type ArgsDe, type ErrorDeRespuesta } from '@capaz/shared';
import type { Transaccion, ContextoDeEmpresa } from '../../../infra/database/con-empresa.js';
import { evaluarReferencias, normalizarNombre, type EstadoDePrecios, cambiaronLosPrecios } from '../domain/lista.js';
import { listaActivaConNombre, listaActivaDeProducto, productoVivo, type CambiosDeLista, type ListaDePrecio } from '../repositories/listas.repository.js';

// Prepara el cambio de una lista: lo comparten `resumir` (antes de confirmar) y `ejecutar`, para que lo que se
// confirma sea lo que se guarda. Solo lee.

export const NO_EXISTE_LA_LISTA = 'No existe esa lista de precios.';

export const candidataDeLista = (f: ListaDePrecio) => ({ id: f.id, nombre: f.nombre, detalle: f.unidad });
export const nombreRepetido = (f: ListaDePrecio) => rechazo('conflicto', `Ya existe una lista llamada «${f.nombre}».`, [candidataDeLista(f)]);

export const productoYaTieneLista = (f: ListaDePrecio) => rechazo('conflicto', `Ese producto ya tiene la lista activa «${f.nombre}».`, [candidataDeLista(f)]);

export const estadoDePrecios = (f: EstadoDePrecios): EstadoDePrecios => ({
  p100Centimos: f.p100Centimos,
  p1000Centimos: f.p1000Centimos,
  p5000Centimos: f.p5000Centimos,
  modoIntermedio: f.modoIntermedio,
  precioMinimoCentimos: f.precioMinimoCentimos,
});

export type EdicionPreparada = { cambios: CambiosDeLista; antes: EstadoDePrecios; despues: EstadoDePrecios; nombre: string };

export async function prepararEdicion(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  actual: ListaDePrecio,
  args: ArgsDe<'lista_precio_editar'>,
): Promise<{ ok: true; valor: EdicionPreparada } | { ok: false; error: ErrorDeRespuesta }> {
  if (actual.archivadoEn) return rechazo('conflicto', 'Una lista archivada no se edita.');
  const antes = estadoDePrecios({ ...actual, modoIntermedio: actual.modoIntermedio as EstadoDePrecios['modoIntermedio'] });
  const despues: EstadoDePrecios = {
    p100Centimos: args.p100Centimos ?? actual.p100Centimos,
    p1000Centimos: args.p1000Centimos ?? actual.p1000Centimos,
    p5000Centimos: args.p5000Centimos ?? actual.p5000Centimos,
    modoIntermedio: args.modoIntermedio ?? antes.modoIntermedio,
    precioMinimoCentimos: args.precioMinimoCentimos === undefined ? actual.precioMinimoCentimos : args.precioMinimoCentimos,
  };
  const cambios: CambiosDeLista = {};
  if (args.nombre !== undefined) {
    const normalizado = normalizarNombre(args.nombre);
    const otra = await listaActivaConNombre(tx, ctx, normalizado, actual.id);
    if (otra) return nombreRepetido(otra);
    Object.assign(cambios, { nombre: args.nombre, nombreNormalizado: normalizado });
  }
  if (args.unidad !== undefined) cambios.unidad = args.unidad;
  if (args.productoId !== undefined) {
    if (args.productoId !== null) {
      if (!(await productoVivo(tx, ctx, args.productoId))) return rechazo('no_encontrado', 'No existe ese producto o está archivado.');
      const otra = await listaActivaDeProducto(tx, ctx, args.productoId, actual.id);
      if (otra) return productoYaTieneLista(otra);
    }
    cambios.productoId = args.productoId;
  }
  const referenciasCambian = despues.p100Centimos !== antes.p100Centimos || despues.p1000Centimos !== antes.p1000Centimos || despues.p5000Centimos !== antes.p5000Centimos;
  if (referenciasCambian) {
    const v = evaluarReferencias(despues, args.confirmarUnitarioNoBaja);
    if (!v.ok) return rechazo(v.codigo, v.mensaje);
    cambios.aConfirmado = v.aConfirmado;
  }
  Object.assign(cambios, despues);
  if (cambiaronLosPrecios(antes, despues)) cambios.preciosFijadosEn = new Date();
  return { ok: true, valor: { cambios, antes, despues, nombre: args.nombre ?? actual.nombre } };
}
