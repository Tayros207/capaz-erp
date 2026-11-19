import {
  formatearSoles,
  ordenDeUrgencia,
  type Anotacion,
  type Borrador,
  type GrupoDeMiDia,
  type MiDiaDto,
  type TarjetaDeMiDia,
  type TarjetaDePendiente,
  type TipoDeEntidadDeMiDia,
} from '@capaz/shared';

// «Mi día», parte pura: junta lo que aportó cada módulo con los borradores por aprobar y lo entrega agrupado. No toca base
// ni herramientas; el composer (`mi-dia.ts`) le pasa lo ya leído.

export type FuenteLeida = { modulo: string; soloLectura: boolean; tarjetas: readonly TarjetaDePendiente[]; anotaciones: readonly Anotacion[] };

export type EntradaDeMiDia = {
  fecha: string;
  fuentes: readonly FuenteLeida[];
  /** Borradores pendientes que la persona puede ver. */
  borradores: readonly Borrador[];
  /** ¿Puede esta persona ejecutar esa herramienta desde la pantalla? (permiso del módulo y no solo lectura). */
  puedeEjecutar: (herramienta: string) => boolean;
};

const ENTIDAD_DE_ORIGEN: Readonly<Record<string, TipoDeEntidadDeMiDia>> = { pedido: 'pedido', produccion: 'orden_trabajo', cotizacion: 'cotizacion', deuda: 'deuda' };

/** La entidad de la que nació un borrador (`pedido:<id>`); si no se conoce, el borrador mismo. */
export function entidadDeBorrador(b: Pick<Borrador, 'id' | 'origenRef'>): { tipo: TipoDeEntidadDeMiDia; id: string } {
  const [tipo, ...resto] = (b.origenRef ?? '').split(':');
  const id = resto.join(':');
  const t = tipo ? ENTIDAD_DE_ORIGEN[tipo] : undefined;
  return t && id ? { tipo: t, id } : { tipo: 'borrador', id: b.id };
}

const centimosDe = (args: unknown): number | null => {
  const a = (args ?? {}) as Record<string, unknown>;
  const v = a.montoCentimos ?? a.totalCentimos;
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
};
const esDeDeuda = (b: Pick<Borrador, 'herramienta'>) => b.herramienta.startsWith('deuda_');

/** «S/ 300.00 por aprobar» cuando el borrador mueve un monto; si no, lo que él mismo resume. */
const textoDeBorrador = (b: Borrador): string => {
  const monto = centimosDe(b.args);
  return monto !== null && (b.herramienta === 'deuda_abonar' || b.herramienta === 'deuda_crear') ? `${formatearSoles(monto)} por aprobar` : b.resumen;
};

function tarjetaDeBorrador(b: Borrador, modulo: string): TarjetaDeMiDia {
  const monto = centimosDe(b.args);
  const entidad = entidadDeBorrador(b);
  return {
    clave: `borrador:${b.id}`,
    grupo: 'aprobacion',
    urgencia: 'info',
    titulo: textoDeBorrador(b),
    detalle: b.resumen,
    fecha: b.propuestoEn.slice(0, 10),
    montoCentimos: esDeDeuda(b) ? monto : null,
    cliente: null,
    entidad: { ...entidad, codigo: b.resumen.slice(0, 60) },
    acciones: [],
    mensaje: null,
    cobro: null,
    modulo,
    notas: b.prioridad === 'alta' ? [{ texto: 'Prioridad alta', tono: 'peligro' }] : [],
  };
}

const conModulo = (t: TarjetaDePendiente, f: FuenteLeida, puede: (h: string) => boolean): TarjetaDeMiDia => ({
  ...t,
  modulo: f.modulo,
  notas: [],
  acciones: f.soloLectura ? [] : t.acciones.filter((a) => puede(a.herramienta)),
});

const mismaEntidad = (t: TarjetaDePendiente, e: { tipo: string; id: string }) => t.entidad.tipo === e.tipo && t.entidad.id === e.id;

/** «Pagado: ¿ya se entregó?» en la tarjeta de un trabajo cuya deuda ya está saldada. */
function marcarPagado(t: TarjetaDeMiDia): TarjetaDeMiDia {
  if (!t.acciones.some((a) => a.args.estado === 'entregado') || t.detalle.includes('Pagado')) return t;
  const detalle = t.detalle.includes('¿ya se entregó?') ? t.detalle.replace('¿ya se entregó?', 'Pagado: ¿ya se entregó?') : `Pagado · ${t.detalle}`;
  return { ...t, detalle };
}

function aplicarAnotaciones(tarjetas: TarjetaDeMiDia[], anotaciones: readonly Anotacion[]): TarjetaDeMiDia[] {
  return tarjetas.flatMap((t) => {
    const mias = anotaciones.filter((a) => mismaEntidad(t, a.entidad));
    // Una alerta de «sin adelanto» sobra si ya entró un pago o el trabajo está saldado.
    if (t.grupo === 'adelanto' && mias.some((a) => a.conAdelanto || a.pagado)) return [];
    let r = { ...t, notas: [...t.notas] };
    for (const a of mias) {
      if (!r.detalle.includes(a.texto) && !r.notas.some((n) => n.texto === a.texto)) r.notas.push({ texto: a.texto, tono: a.tono });
      if (a.pagado) r = marcarPagado(r);
    }
    return [r];
  });
}

/** Los borradores que repiten una entidad que ya tiene tarjeta se vuelven una nota de esa tarjeta (salvo los de prioridad alta). */
function sumarBorradores(tarjetas: TarjetaDeMiDia[], borradores: readonly Borrador[]): { tarjetas: TarjetaDeMiDia[]; propias: TarjetaDeMiDia[] } {
  const propias: TarjetaDeMiDia[] = [];
  const copia = tarjetas.map((t) => ({ ...t, notas: [...t.notas] }));
  const ordenados = [...borradores].sort((a, b) => Number(esDeDeuda(b)) - Number(esDeDeuda(a)) || Number(b.prioridad === 'alta') - Number(a.prioridad === 'alta'));
  for (const b of ordenados) {
    const duenia = b.prioridad === 'alta' ? undefined : copia.find((t) => mismaEntidad(t, entidadDeBorrador(b)));
    if (duenia) duenia.notas.push({ texto: textoDeBorrador(b), tono: 'aviso' });
    else propias.push(tarjetaDeBorrador(b, b.modulo));
  }
  return { tarjetas: copia, propias };
}

export const grupoDe = (t: Pick<TarjetaDePendiente, 'grupo' | 'urgencia'>): GrupoDeMiDia => {
  if (t.grupo === 'aprobacion') return 'por_aprobar';
  if (t.grupo === 'cobro') return 'por_cobrar';
  return t.urgencia === 'atrasado' ? 'atrasado' : t.urgencia === 'hoy' ? 'hoy' : t.urgencia === 'manana' ? 'manana' : 'mas_adelante';
};

const ORDEN_DE_GRUPOS: readonly GrupoDeMiDia[] = ['atrasado', 'hoy', 'manana', 'por_cobrar', 'por_aprobar', 'mas_adelante'];

const porUrgenciaYFecha = (a: TarjetaDeMiDia, b: TarjetaDeMiDia) =>
  ordenDeUrgencia(a.urgencia) - ordenDeUrgencia(b.urgencia) || (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.clave.localeCompare(b.clave);

/** Compone el panel: acciones filtradas, anotaciones aplicadas, borradores sin duplicar y todo agrupado y ordenado. */
export function componerMiDia(e: EntradaDeMiDia): Pick<MiDiaDto, 'fecha' | 'resumen' | 'grupos' | 'total'> {
  const base = e.fuentes.flatMap((f) => f.tarjetas.map((t) => conModulo(t, f, e.puedeEjecutar)));
  const anotaciones = e.fuentes.flatMap((f) => f.anotaciones);
  const anotadas = aplicarAnotaciones(base, anotaciones);
  const { tarjetas, propias } = sumarBorradores(anotadas, e.borradores);

  const porGrupo = new Map<GrupoDeMiDia, TarjetaDeMiDia[]>();
  for (const t of [...tarjetas, ...propias]) porGrupo.set(grupoDe(t), [...(porGrupo.get(grupoDe(t)) ?? []), t]);
  const grupos = ORDEN_DE_GRUPOS.flatMap((clave) => {
    const lista = porGrupo.get(clave);
    if (!lista?.length) return [];
    return [{ clave, tarjetas: clave === 'por_aprobar' ? lista : [...lista].sort(porUrgenciaYFecha) }];
  });
  const todas = grupos.flatMap((g) => g.tarjetas);
  return {
    fecha: e.fecha,
    total: todas.length,
    grupos,
    resumen: {
      entregasDeHoy: todas.filter((t) => t.grupo === 'entrega' && t.urgencia === 'hoy').length,
      entregasAtrasadas: todas.filter((t) => t.grupo === 'entrega' && t.urgencia === 'atrasado').length,
      porCobrarVencidoCentimos: todas.filter((t) => t.grupo === 'cobro').reduce((s, t) => s + (t.montoCentimos ?? 0), 0),
      porAprobar: e.borradores.length,
    },
  };
}
