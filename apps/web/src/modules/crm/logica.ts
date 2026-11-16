import { formatearSoles, type Centimos, type EntradaDe, type EtapaDto, type OportunidadDto } from '@capaz/shared';
import type { ColumnaDeTablero } from '../../shared/ui/tablero.tsx';

// Lógica pura de las pantallas de `crm` (con pruebas en logica.spec.ts).

export const ETIQUETA_DE_ESTADO: Record<OportunidadDto['estado'], string> = { abierta: 'Abierta', ganada: 'Ganada', perdida: 'Perdida' };
export const TONO_DE_ESTADO = { abierta: 'info', ganada: 'exito', perdida: 'peligro' } as const;
export const ETIQUETA_DE_ACTIVIDAD = { llamada: 'Llamada', reunion: 'Reunión', mensaje: 'Mensaje', tarea: 'Tarea', nota: 'Nota' } as const;
export type TipoDeActividad = keyof typeof ETIQUETA_DE_ACTIVIDAD;

export const textoDeMonto = (centimos: number | null): string => (centimos === null ? '—' : formatearSoles(centimos));

/** Las etapas abiertas vivas, en su orden. */
export const etapasAbiertas = (etapas: readonly EtapaDto[]): EtapaDto[] =>
  etapas.filter((e) => e.tipo === 'abierta' && e.archivadoEn === null).sort((a, b) => a.orden - b.orden);

/** Una columna por etapa abierta con sus oportunidades y el monto estimado que suman. */
export function columnasDelTablero(etapas: readonly EtapaDto[], oportunidades: readonly OportunidadDto[]): Array<ColumnaDeTablero<OportunidadDto>> {
  return etapasAbiertas(etapas).map((e) => {
    const filas = oportunidades.filter((o) => o.estado === 'abierta' && o.etapaId === e.id);
    const monto = filas.reduce((s, o) => s + (o.montoEstimadoCentimos ?? 0), 0);
    return { id: e.id, titulo: e.nombre, resumen: formatearSoles(monto), filas };
  });
}

/** Etapas a las que se puede mover una oportunidad abierta (todas las abiertas menos la suya). */
export const destinosDeMovimiento = (etapas: readonly EtapaDto[], o: OportunidadDto): EtapaDto[] =>
  o.estado === 'abierta' ? etapasAbiertas(etapas).filter((e) => e.id !== o.etapaId) : [];

/** Pasos de la barra de estado: las abiertas y, al final, el cierre. `actual` es el índice donde está. */
export function pasosDeOportunidad(etapas: readonly EtapaDto[], o: OportunidadDto): { pasos: string[]; actual: number } {
  const abiertas = etapasAbiertas(etapas);
  const cierre = o.estado === 'abierta' ? 'Cierre' : o.etapaNombre;
  const pasos = [...abiertas.map((e) => e.nombre), cierre];
  const actual = o.estado === 'abierta' ? Math.max(0, abiertas.findIndex((e) => e.id === o.etapaId)) : pasos.length - 1;
  return { pasos, actual };
}

/** Intercambia la etapa `i` con su vecina (`-1` sube, `+1` baja). Devuelve los ids en el orden nuevo o nulo si no se puede. */
export function moverEnOrden(ids: readonly string[], i: number, paso: -1 | 1): string[] | null {
  const j = i + paso;
  if (i < 0 || i >= ids.length || j < 0 || j >= ids.length) return null;
  const nuevo = [...ids];
  [nuevo[i], nuevo[j]] = [nuevo[j]!, nuevo[i]!];
  return nuevo;
}

export type FormularioDeOportunidad = { titulo: string; montoEstimadoCentimos: Centimos | null; fechaEsperada: string; notas: string };
export type ErroresDeOportunidad = Partial<Record<keyof FormularioDeOportunidad | 'cliente', string>>;

export const formularioVacio = (): FormularioDeOportunidad => ({ titulo: '', montoEstimadoCentimos: null, fechaEsperada: '', notas: '' });

export const formularioDesde = (o: OportunidadDto): FormularioDeOportunidad => ({
  titulo: o.titulo,
  // El servidor ya entrega céntimos enteros (regla 9).
  montoEstimadoCentimos: o.montoEstimadoCentimos as Centimos | null,
  fechaEsperada: o.fechaEsperada ?? '',
  notas: o.notas ?? '',
});

export function validarOportunidad(f: FormularioDeOportunidad, clienteId: string | null | undefined = undefined): ErroresDeOportunidad {
  const e: ErroresDeOportunidad = {};
  if (!f.titulo.trim()) e.titulo = 'Indica el título.';
  else if (f.titulo.trim().length > 160) e.titulo = 'Hasta 160 letras.';
  if (clienteId === null) e.cliente = 'Elige un cliente.';
  if (f.montoEstimadoCentimos !== null && f.montoEstimadoCentimos < 0) e.montoEstimadoCentimos = 'El monto no puede ser negativo.';
  if (f.notas.length > 4000) e.notas = 'Hasta 4000 letras.';
  return e;
}

const nulo = (t: string): string | null => (t.trim() ? t.trim() : null);

export function argumentosDeCreacion(f: FormularioDeOportunidad, clienteId: string): EntradaDe<'oportunidad_crear'> {
  return {
    titulo: f.titulo.trim(),
    clienteId,
    montoEstimadoCentimos: f.montoEstimadoCentimos,
    fechaEsperada: nulo(f.fechaEsperada),
    notas: nulo(f.notas),
  };
}

/** Solo lo que cambió; nulo si nada cambió. */
export function argumentosDeEdicion(o: OportunidadDto, f: FormularioDeOportunidad): EntradaDe<'oportunidad_editar'> | null {
  const a: EntradaDe<'oportunidad_editar'> = { id: o.id };
  if (f.titulo.trim() !== o.titulo) a.titulo = f.titulo.trim();
  if (f.montoEstimadoCentimos !== o.montoEstimadoCentimos) a.montoEstimadoCentimos = f.montoEstimadoCentimos;
  if (nulo(f.fechaEsperada) !== o.fechaEsperada) a.fechaEsperada = nulo(f.fechaEsperada);
  if (nulo(f.notas) !== o.notas) a.notas = nulo(f.notas);
  return Object.keys(a).length > 1 ? a : null;
}

/** Mensaje para la persona según el rechazo del servidor. */
export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'modulo_solo_lectura') return 'Tu acceso al CRM es de solo lectura.';
  if (codigo === 'sin_permiso') return 'No tienes permiso para hacer eso.';
  return mensaje;
}
