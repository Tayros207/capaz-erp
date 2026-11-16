import { comoEmpresa, type abrirPool } from '../../../pruebas/base-de-pruebas.js';
import type { RespuestaHttp, Sesion } from '../../../core/herramientas/http-de-pruebas.js';

// Ayudantes de las pruebas por HTTP de inventario (solo los importan los `*.int.spec.ts` de esta carpeta).

/** El pool lo abre `pruebas/base-de-pruebas`: aquí no se importa `pg` (regla de arquitectura). */
type Pool = ReturnType<typeof abrirPool>;

export const codigo = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.codigo;
export const mensaje = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.mensaje;

/** Devuelve `datos` o falla mostrando el error: ahorra un `expect` por llamada. */
export function datos(r: RespuestaHttp): any {
  if (!r.cuerpo?.ok) throw new Error(`Se esperaba éxito y llegó ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
}

export const eventosDe = (pool: Pool, empresaId: string, tipo: string) =>
  comoEmpresa(pool, empresaId, async (c) => (await c.query('select carga from core.eventos_salida where tipo = $1 order by creado_en, id', [tipo])).rows.map((r) => r.carga as any));

export const crearProducto = async (s: Sesion, nombre: string, extra: Record<string, unknown> = {}): Promise<string> =>
  datos(await s.herramienta('productos_crear', { nombre, ...extra })).id;

/** Producto nuevo bajo control de inventario; devuelve el artículo. */
export async function crearArticulo(s: Sesion, nombre: string, extra: Record<string, unknown> = {}): Promise<any> {
  const productoId = await crearProducto(s, nombre, { unidad: 'paquete' });
  return datos(await s.herramienta('articulo_activar', { productoId, ...extra }));
}

/** Entrada o salida en la principal; devuelve la respuesta cruda. */
export const mover = (s: Sesion, articuloId: string, tipo: 'entrada' | 'salida', cantidadMilesimas: number, extra: Record<string, unknown> = {}) =>
  s.herramienta('existencia_mover', { articuloId, tipo, cantidadMilesimas, ...extra });

/** Ejecuta una crítica en sus dos pasos y devuelve la respuesta final. */
export async function confirmarCritica(s: Sesion, nombre: string, args: unknown): Promise<RespuestaHttp> {
  const pide = await s.herramienta(nombre, args);
  const token = pide.cuerpo?.requiereConfirmacion?.token;
  if (!token) return pide;
  return s.herramienta(nombre, args, { confirmacion: token });
}
