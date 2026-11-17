import type { RespuestaHttp, Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { comoEmpresa } from '../../../pruebas/base-de-pruebas.js';

// Ayudantes de las pruebas por HTTP del módulo (no es código de producción: solo lo importan los `*.int.spec.ts`).

type Pool = Parameters<typeof comoEmpresa>[0];
export type EventoGuardado = { tipo: string; carga: unknown };

export const codigoDe = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.codigo;

/** Llama a una herramienta y exige que responda bien; devuelve `datos`. */
export async function datosDe(sesion: Sesion, nombre: string, args: unknown = {}, opciones: { clave?: string } = {}): Promise<any> {
  const r = await sesion.herramienta(nombre, args, opciones);
  if (!r.cuerpo?.ok) throw new Error(`«${nombre}» respondió ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
}

/** Ejecuta una herramienta crítica en dos pasos: pide la confirmación y la envía. */
export async function confirmando(sesion: Sesion, nombre: string, args: unknown): Promise<{ respuesta: RespuestaHttp; resumen: string }> {
  const pide = await sesion.herramienta(nombre, args);
  const token = pide.cuerpo?.requiereConfirmacion?.token as string | undefined;
  if (!token) return { respuesta: pide, resumen: '' };
  return { respuesta: await sesion.herramienta(nombre, args, { confirmacion: token }), resumen: pide.cuerpo.requiereConfirmacion.resumen as string };
}

/** Los eventos de la bandeja de salida de una empresa. */
export const eventosDe = (pool: Pool, empresaId: string): Promise<EventoGuardado[]> =>
  comoEmpresa(pool, empresaId, async (c) => (await c.query('select tipo, carga from core.eventos_salida order by creado_en, id')).rows as EventoGuardado[]);

/** La lista de C7 de Cotizín: 100 → S/ 190.00, 1.000 → S/ 580.00, 5.000 → S/ 1,200.00 (sin IGV), en curva. */
export const LISTA_C7 = { nombre: 'Volantes A5 4/4 couché 150 g', p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000 } as const;
