import type { TonoDeInsignia } from './insignia.tsx';

export type TipoDeEntidad = 'cliente' | 'pedido' | 'deuda' | 'movimiento';

// Rutas verificadas en `core/clientes/rutas.tsx`, `modules/ordenes/rutas.tsx` y `modules/registro/rutas.tsx`.
// Un solo lugar: si una ficha cambia de dirección, cambia aquí y todos los enlaces del sistema la siguen.
const RUTAS: Record<TipoDeEntidad, (id: string) => string> = {
  cliente: (id) => `/clientes/${id}`,
  pedido: (id) => `/m/ordenes/${id}`,
  deuda: (id) => `/m/registro/deudas/${id}`,
  movimiento: (id) => `/m/registro/movimientos/${id}`,
};

export const rutaDeEntidad = (tipo: TipoDeEntidad, id: string): string => RUTAS[tipo](id);

/** Iniciales de un nombre (hasta dos letras) para el avatar de un chip. */
export function inicialesDe(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

const TONOS_POR_ESTADO: Array<[RegExp, TonoDeInsignia]> = [
  [/(pagad|cobrad|entregad|ganad|complet|activ|aprobad|recibid|al d[ií]a)/i, 'exito'],
  [/(vencid|atrasad|anulad|cancelad|perdid|rechazad|descartad|fall)/i, 'peligro'],
  [/(pendiente|parcial|borrador|prueba|solo lectura|suspendid|por aprobar)/i, 'aviso'],
  [/(proceso|producci[oó]n|enviad|confirmad|abiert)/i, 'info'],
];

/** Tono de una insignia según el texto del estado: el mismo estado se ve igual en todos los módulos. */
export function tonoDeEstado(estado: string): TonoDeInsignia {
  return TONOS_POR_ESTADO.find(([re]) => re.test(estado))?.[1] ?? 'neutro';
}
