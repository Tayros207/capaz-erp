import type { EntradaDe } from '@capaz/shared';
import type { MedioDePago, Res, ResultadoDelAdelanto } from './adelanto.ts';

// El encadenamiento de «Confirmar pedido» en la hoja única: crear el pedido y confirmarlo (con o sin adelanto).
// Lógica pura: las llamadas entran inyectadas, así se prueba cada fallo parcial. No hay contrato nuevo: son las
// mismas herramientas de siempre, una tras otra desde el cliente.

export type DependenciasDeAlta = {
  crear: (args: EntradaDe<'pedido_crear'>) => Promise<Res<{ id: string }>>;
  confirmar: (id: string) => Promise<Res<{ id: string; codigo: string }>>;
  /** Confirma, crea la deuda y abona (`ejecutarAdelanto`). */
  confirmarYCobrar: (id: string, montoCentimos: number, medio: MedioDePago) => Promise<ResultadoDelAdelanto>;
};

export type ResultadoDeAlta =
  /** No se guardó nada: la hoja sigue editable con el error dentro. */
  | { estado: 'sin_crear'; mensaje: string }
  /** El pedido existe como borrador pero no se pudo confirmar: nunca se vuelve a crear. */
  | { estado: 'borrador'; id: string; mensaje: string }
  /** Confirmado; `adelanto` trae el desenlace del cobro (completo o parcial) o es nulo si no hubo adelanto. */
  | { estado: 'confirmado'; id: string; codigo: string; adelanto: ResultadoDelAdelanto | null };

const SIN_CONFIRMAR = 'Se guardó como borrador, pero no se pudo confirmar: ';
const mensajeDeBorrador = (causa: string) => `${SIN_CONFIRMAR}${causa.replace(/^No se confirmó el pedido:\s*/, '').trim()}`;
const inesperado = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Error inesperado.');

/** Crea el pedido y lo confirma. Nunca lanza: todo desenlace vuelve como resultado. */
export async function crearYConfirmar(
  dep: DependenciasDeAlta,
  args: EntradaDe<'pedido_crear'>,
  adelanto: { montoCentimos: number; medio: MedioDePago } | null,
): Promise<ResultadoDeAlta> {
  let id: string;
  try {
    const creado = await dep.crear(args);
    if (!creado.ok) return { estado: 'sin_crear', mensaje: creado.mensaje };
    id = creado.datos.id;
  } catch (e) {
    return { estado: 'sin_crear', mensaje: inesperado(e) };
  }
  try {
    if (adelanto) {
      const r = await dep.confirmarYCobrar(id, adelanto.montoCentimos, adelanto.medio);
      if (r.estado === 'sin_confirmar') return { estado: 'borrador', id, mensaje: mensajeDeBorrador(r.mensaje) };
      return { estado: 'confirmado', id, codigo: r.pedidoCodigo, adelanto: r };
    }
    const c = await dep.confirmar(id);
    if (!c.ok) return { estado: 'borrador', id, mensaje: mensajeDeBorrador(c.mensaje) };
    return { estado: 'confirmado', id, codigo: c.datos.codigo, adelanto: null };
  } catch (e) {
    return { estado: 'borrador', id, mensaje: mensajeDeBorrador(inesperado(e)) };
  }
}
