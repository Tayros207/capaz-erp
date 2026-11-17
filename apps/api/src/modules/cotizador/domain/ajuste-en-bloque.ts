// Plan de «Cambiar en bloque»: qué precios nuevos tendría cada lista y si el cambio se puede aplicar. Puro: no toca la base.
import { formatearSoles } from '@capaz/shared';
import { normalizarNombre } from './lista.js';
import { ajustarPreciosDeLista, validarLista, type PreciosDeListaEnCentimos } from './precios.js';

const EJEMPLOS = 3;
const NOMBRES_CON_ERROR = 5;

export type ListaParaAjustar = PreciosDeListaEnCentimos & { id: string; nombre: string; aConfirmado: boolean };
export type CambioDeLista = { id: string; nombre: string; antes: PreciosDeListaEnCentimos; despues: PreciosDeListaEnCentimos; aConfirmado: boolean; avisoNuevo: boolean };
export type PlanDeBloque = { ok: true; cambios: CambioDeLista[] } | { ok: false; codigo: 'conflicto'; mensaje: string };

/** Las palabras de la búsqueda, sin tildes ni mayúsculas; sin búsqueda no hay ninguna (todas las listas). */
export const palabrasDeBusqueda = (busqueda: string): string[] => normalizarNombre(busqueda).split(' ').filter(Boolean);

const nombres = (v: string[]): string => v.slice(0, NOMBRES_CON_ERROR).map((n) => `«${n}»`).join(', ') + (v.length > NOMBRES_CON_ERROR ? ` y ${v.length - NOMBRES_CON_ERROR} más` : '');
const sinSentido = (p: PreciosDeListaEnCentimos): boolean => p.p100Centimos <= 0 || (p.precioMinimoCentimos !== null && p.precioMinimoCentimos <= 0);

/** Todo o nada: si una lista rompe la invariante B (o queda en cero) no se cambia ninguna; el aviso A pide confirmar. */
export function planearAjusteEnBloque(listas: ListaParaAjustar[], porcentaje: string, confirmar: boolean): PlanDeBloque {
  if (listas.length === 0) return { ok: false, codigo: 'conflicto', mensaje: 'Ninguna lista activa coincide con esa búsqueda: no hay nada que cambiar.' };
  const cambios: CambioDeLista[] = [];
  const rotas: string[] = [];
  const conAviso: string[] = [];
  for (const l of listas) {
    const despues = ajustarPreciosDeLista(l, porcentaje);
    const v = validarLista(despues);
    if (v.bloqueos.length > 0 || sinSentido(despues)) rotas.push(l.nombre);
    const aviso = v.avisos.length > 0;
    if (aviso && !l.aConfirmado) conAviso.push(l.nombre);
    cambios.push({ id: l.id, nombre: l.nombre, antes: l, despues, aConfirmado: aviso, avisoNuevo: aviso && !l.aConfirmado });
  }
  if (rotas.length > 0) {
    return { ok: false, codigo: 'conflicto', mensaje: `Con ${porcentaje} % quedarían precios inválidos (el total debe crecer con la cantidad) en ${rotas.length} lista(s): ${nombres(rotas)}. No se cambió nada.` };
  }
  if (conAviso.length > 0 && !confirmar) {
    return { ok: false, codigo: 'conflicto', mensaje: `En ${conAviso.length} lista(s) el precio unitario ya no baja con la cantidad: ${nombres(conAviso)}. Confirma para guardarlo igual.` };
  }
  return { ok: true, cambios };
}

/** «Cambiar +8 % los productos que contienen «couché» (3): «Volantes A5»: 1.000 → S/ 580.00 pasa a S/ 626.40; …». */
export function resumenDeBloque(cambios: CambioDeLista[], busqueda: string, porcentaje: string): string {
  const signo = Number(porcentaje) < 0 ? porcentaje : `+${porcentaje}`;
  const b = busqueda.trim();
  const alcance = b === '' ? 'todas las listas activas' : `las listas que contienen «${b}»`;
  const ejemplos = cambios.slice(0, EJEMPLOS).map((c) => `«${c.nombre}»: 1.000 → ${formatearSoles(c.antes.p1000Centimos)} pasa a ${formatearSoles(c.despues.p1000Centimos)}`);
  const mas = cambios.length > EJEMPLOS ? ` y ${cambios.length - EJEMPLOS} más` : '';
  return `Cambiarás ${signo} % los precios de ${alcance} (${cambios.length}): ${ejemplos.join('; ')}${mas}. Las cotizaciones ya emitidas no cambian.`;
}
