import type { Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { datosDe } from './pruebas-de-cotizador.js';

// Ayudantes de las pruebas por HTTP del cuadro por partes (no es código de producción: solo lo importan los `*.int.spec.ts`).

export type Taller = { maquina: string; madre: string; deMaquina: string; tarifas: Record<string, string> };

/** Siembra el taller de ejemplo (Perú) con `taller_sembrar` y devuelve los ids que usa el caso de referencia. */
export async function sembrarTaller(s: Sesion): Promise<Taller> {
  await datosDe(s, 'taller_sembrar');
  const maquina = (await datosDe(s, 'maquinas_listar')).items.find((m: any) => m.nombre === 'Offset 36 × 52').id;
  const formatos = (await datosDe(s, 'formatos_pliego_listar')).items;
  const formato = (nombre: string) => formatos.find((f: any) => f.nombre === nombre).id;
  const tarifas: Record<string, string> = {};
  for (const t of (await datosDe(s, 'tarifas_listar')).items) tarifas[t.nombre] = t.id;
  return { maquina, madre: formato('70 × 100 cm'), deMaquina: formato('35 × 50 cm'), tarifas };
}

export const PAPEL = 'Papel couché 150 g, pliego madre 70 × 100';

/**
 * El caso de referencia de Cotizín (2.500 volantes A5, 4/4, couché 150 g) armado SOLO con herramientas de Capaz: trabajo,
 * imposición con la máquina y los pliegos de la semilla, y una fila por cada costo. Las cantidades de las filas son las del caso
 * (172 pliegos madre los pone el motor; 0.8 h de tiraje; 1 servicio de diseño, barniz, corte y empaque).
 */
export async function armarCasoDeReferencia(s: Sesion, t: Taller, clienteId: string, titulo = 'Volantes A5', cantidad = '2500'): Promise<string> {
  const { cuadro } = await datosDe(s, 'cuadro_iniciar', { plantilla: 'en_blanco', titulo, clienteId });
  const id = cuadro.cotizacionId as string;
  await datosDe(s, 'cuadro_fijar_trabajo', { id, producto: 'Volantes A5', cantidad, pieza: { anchoCm: '14.8', altoCm: '21' }, tintas: 4, caras: 2 });
  await datosDe(s, 'cuadro_linea_agregar', { id, tarifaId: t.tarifas[PAPEL], cantidad: '0' });
  await datosDe(s, 'cuadro_fijar_imposicion', { id, maquinaId: t.maquina, pliegoMadreId: t.madre, pliegoMaquinaId: t.deMaquina, filaDePapel: { texto: 'papel' } });
  const fila = (nombre: string, cantidad: string) => datosDe(s, 'cuadro_linea_agregar', { id, tarifaId: t.tarifas[nombre], cantidad });
  await fila('Plancha CTP', '8');
  await fila('Tiraje offset', '0.8');
  await fila('Diseño gráfico de volante', '1');
  await fila('Barniz de máquina', '1');
  await fila('Corte y empaque', '1');
  await datosDe(s, 'cuadro_fijar_utilidad', { id, pct: '35', base: 'venta' });
  return id;
}
