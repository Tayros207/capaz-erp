import { comoEmpresa, type abrirPool } from '../../../pruebas/base-de-pruebas.js';
import type { RespuestaHttp, Sesion } from '../../../core/herramientas/http-de-pruebas.js';

// Ayudantes de las pruebas por HTTP de pedidos (solo los importan los `*.int.spec.ts` de esta carpeta).

/** El pool lo abre `pruebas/base-de-pruebas`: aquí no se importa `pg` (regla de arquitectura). */
type Pool = ReturnType<typeof abrirPool>;

export const codigo = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.codigo;
export const mensaje = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.mensaje;

/** Devuelve `datos` o falla mostrando el error: ahorra un `expect` por llamada. */
export function datos(r: RespuestaHttp): any {
  if (!r.cuerpo?.ok) throw new Error(`Se esperaba éxito y llegó ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
}

export const eventosDe = (pool: Pool, empresaId: string, tipo?: string) =>
  comoEmpresa(pool, empresaId, async (c) => {
    const r = await c.query('select tipo, carga from core.eventos_salida order by creado_en, id');
    return (r.rows as { tipo: string; carga: any }[]).filter((e) => !tipo || e.tipo === tipo);
  });

export const crearCliente = async (s: Sesion, nombre: string): Promise<string> => datos(await s.herramienta('clientes_crear', { nombre })).id;

export const crearProducto = async (s: Sesion, nombre: string, extra: Record<string, unknown> = {}): Promise<string> =>
  datos(await s.herramienta('productos_crear', { nombre, ...extra })).id;

export const linea = (descripcion: string, soles: number, cantidad = 1) => ({
  descripcion,
  cantidadMilesimas: Math.round(cantidad * 1000),
  precioUnitarioMilesimas: Math.round(soles * 1000),
});

/** Un borrador con una línea de S/ 118.00, salvo que se pidan otras. */
export const crearBorrador = async (s: Sesion, clienteId: string, extra: Record<string, unknown> = {}): Promise<any> =>
  datos(await s.herramienta('pedido_crear', { clienteId, lineas: [linea('Trabajo de prueba', 118)], ...extra }));

/** Ejecuta una crítica en sus dos pasos y devuelve la respuesta final. */
export async function confirmarCritica(s: Sesion, nombre: string, args: unknown): Promise<RespuestaHttp> {
  const pide = await s.herramienta(nombre, args);
  const token = pide.cuerpo?.requiereConfirmacion?.token;
  if (!token) return pide;
  return s.herramienta(nombre, args, { confirmacion: token });
}
