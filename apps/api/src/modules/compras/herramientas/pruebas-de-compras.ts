import { comoEmpresa, type abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { activarModulo, type RespuestaHttp, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';

// Ayudantes de las pruebas por HTTP de compras (solo los importan los `*.int.spec.ts` de esta carpeta).

/** El pool lo abre `pruebas/base-de-pruebas`: aquí no se importa `pg` (regla de arquitectura). */
type Pool = ReturnType<typeof abrirPool>;

export const codigo = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.codigo;
export const mensaje = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.mensaje;

/** Devuelve `datos` o falla mostrando el error: ahorra un `expect` por llamada. */
export function datos(r: RespuestaHttp): any {
  if (!r.cuerpo?.ok) throw new Error(`Se esperaba éxito y llegó ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
}

/** Compras exige Inventario contratado (P3-6): se activa primero. */
export async function activarCompras(empresaId: string): Promise<void> {
  await activarModulo(empresaId, 'insumos');
  await activarModulo(empresaId, 'compras');
}

export const eventosDe = (pool: Pool, empresaId: string, tipo?: string) =>
  comoEmpresa(pool, empresaId, async (c) => {
    const r = await c.query('select tipo, carga from core.eventos_salida order by creado_en, id');
    return (r.rows as { tipo: string; carga: any }[]).filter((e) => !tipo || e.tipo === tipo);
  });

export const contadorDe = (pool: Pool, empresaId: string, serie: string) =>
  comoEmpresa(pool, empresaId, async (c) => {
    const r = await c.query(`select ultimo from core.contadores where clave = 'compras.orden' and serie = $1`, [serie]);
    return r.rows[0] ? Number(r.rows[0].ultimo) : 0;
  });

export const crearProveedor = async (s: Sesion, nombre: string): Promise<string> => datos(await s.herramienta('clientes_crear', { nombre, tipo: 'proveedor' })).id;

export const crearProducto = async (s: Sesion, nombre: string, extra: Record<string, unknown> = {}): Promise<string> =>
  datos(await s.herramienta('productos_crear', { nombre, ...extra })).id;

/** Una línea sin producto: `cantidad` unidades a `soles` cada una (IGV incluido). */
export const linea = (descripcion: string, soles: number, cantidad = 1) => ({
  descripcion,
  cantidadMilesimas: Math.round(cantidad * 1000),
  costoUnitarioMilesimas: Math.round(soles * 1000),
});

/** Un borrador con 10 unidades a S/ 11.80 (S/ 118.00), salvo que se pidan otras líneas. */
export const crearBorrador = async (s: Sesion, proveedorId: string, extra: Record<string, unknown> = {}): Promise<any> =>
  datos(await s.herramienta('compra_crear', { proveedorId, lineas: [linea('Papel bond A4', 11.8, 10)], ...extra }));

/** Un borrador enviado (con número). */
export const crearEnviada = async (s: Sesion, proveedorId: string, extra: Record<string, unknown> = {}): Promise<any> =>
  datos(await s.herramienta('compra_enviar', { id: (await crearBorrador(s, proveedorId, extra)).id }));

/** Recibe de cada línea (por posición) la cantidad indicada; `null` la salta. */
export const recibir = (s: Sesion, orden: any, cantidades: Array<number | null>, extra: Record<string, unknown> = {}, opciones: { clave?: string } = {}) =>
  s.herramienta(
    'compra_recibir',
    {
      id: orden.id,
      lineas: cantidades.flatMap((c, i) => (c === null ? [] : [{ ordenLineaId: orden.detalle[i].id, cantidadMilesimas: c }])),
      ...extra,
    },
    opciones,
  );

/** Ejecuta una crítica en sus dos pasos y devuelve la respuesta final. */
export async function confirmarCritica(s: Sesion, nombre: string, args: unknown): Promise<RespuestaHttp> {
  const pide = await s.herramienta(nombre, args);
  const token = pide.cuerpo?.requiereConfirmacion?.token;
  if (!token) return pide;
  return s.herramienta(nombre, args, { confirmacion: token });
}
