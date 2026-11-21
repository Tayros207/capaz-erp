import { hoyEnZona } from '../../../core/empresas/hoy.js';
import type { RespuestaHttp, Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { comoEmpresa } from '../../../pruebas/base-de-pruebas.js';

// Ayudantes de las pruebas por HTTP del módulo (no es código de producción: solo lo importan los `*.int.spec.ts`).

/** El pool de pruebas, sin importar `pg` aquí (solo `infra/database` y las pruebas lo importan). */
type Pool = Parameters<typeof comoEmpresa>[0];

export const codigoDe = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.codigo;
export const HOY = hoyEnZona('America/Lima');

export { diaMas } from '../../../pruebas/fechas.js';

export type EventoGuardado = { tipo: string; carga: any };

/** Los eventos de la bandeja de salida de una empresa, en orden; opcionalmente de un solo tipo. */
export const eventosDe = (pool: Pool, empresaId: string, tipo?: string): Promise<EventoGuardado[]> =>
  comoEmpresa(pool, empresaId, async (c) => {
    const r = await c.query('select tipo, carga from core.eventos_salida order by creado_en, id');
    return (r.rows as EventoGuardado[]).filter((e) => !tipo || e.tipo === tipo);
  });

/** Llama a una herramienta y exige que responda bien; devuelve `datos`. */
export async function datosDe(sesion: Sesion, nombre: string, args: unknown = {}, opciones: { clave?: string } = {}): Promise<any> {
  const r = await sesion.herramienta(nombre, args, opciones);
  if (!r.cuerpo?.ok) throw new Error(`«${nombre}» respondió ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
}

/** Ejecuta una herramienta crítica en dos pasos: pide la confirmación y la envía. Devuelve la respuesta final y el resumen. */
export async function confirmando(sesion: Sesion, nombre: string, args: unknown): Promise<{ respuesta: RespuestaHttp; resumen: string }> {
  const pide = await sesion.herramienta(nombre, args);
  const token = pide.cuerpo?.requiereConfirmacion?.token as string | undefined;
  if (!token) return { respuesta: pide, resumen: '' };
  return { respuesta: await sesion.herramienta(nombre, args, { confirmacion: token }), resumen: pide.cuerpo.requiereConfirmacion.resumen as string };
}
