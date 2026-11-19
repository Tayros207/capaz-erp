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
  /** Día local de un instante (para la fecha de un borrador); por defecto, el día UTC. */
  diaDe?: (instante: string) => string;
};

type AnotacionLeida = Anotacion & { modulo: string };

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
/** Borradores de dinero: deudas (crear, con adelanto, abonar) y movimientos de caja. */
const esDeDinero = (b: Pick<Borrador, 'herramienta'>) => esDeDeuda(b) || b.herramienta === 'movimiento_registrar';
const montoPorAprobar = (b: Borrador): string | null => {
  const monto = centimosDe(b.args);
  return monto !== null && esDeDinero(b) ? `${formatearSoles(monto)} por aprobar` : null;
};

/** Título de la tarjeta propia: «S/ 300.00 por aprobar» cuando el borrador mueve un monto; si no, lo que él mismo resume. */
const textoDeBorrador = (b: Borrador): string => montoPorAprobar(b) ?? b.resumen;
/** Nota sobre la tarjeta de su pedido u orden: siempre corta (una insignia no se parte en dos líneas). */
const notaDeBorrador = (b: Borrador): string => montoPorAprobar(b) ?? 'Por aprobar en la Bandeja';

/** La tarjeta propia de un borrador lleva a la bandeja, que es donde se aprueba (su resumen ya nombra el pedido u orden). */
function tarjetaDeBorrador(b: Borrador, modulo: string, diaDe: (instante: string) => string): TarjetaDeMiDia {
  const monto = centimosDe(b.args);
  return {
    clave: `borrador:${b.id}`,
    grupo: 'aprobacion',
    urgencia: 'info',
    titulo: textoDeBorrador(b),
    detalle: b.resumen,
    fecha: diaDe(b.propuestoEn),
    montoCentimos: esDeDinero(b) ? monto : null,
    cliente: null,
    entidad: { tipo: 'borrador', id: b.id, codigo: b.resumen.slice(0, 60) },
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

const PREGUNTA_DE_ENTREGA = /(?:Listo: )?¿ya se entregó\?/;

/** «Pagado: ¿ya se entregó?» en la tarjeta de un trabajo cuya deuda ya está saldada. */
function marcarPagado(t: TarjetaDeMiDia): TarjetaDeMiDia {
  if (!t.acciones.some((a) => a.args.estado === 'entregado') || t.detalle.includes('Pagado')) return t;
  const detalle = PREGUNTA_DE_ENTREGA.test(t.detalle) ? t.detalle.replace(PREGUNTA_DE_ENTREGA, 'Pagado: ¿ya se entregó?') : `Pagado · ${t.detalle}`;
  return { ...t, detalle };
}

/**
 * Las anotaciones de la entidad de la tarjeta. Si otro módulo (Finanzas) dice cómo va el pago, manda sobre lo que el
 * módulo de la tarjeta anotó por su cuenta: así nunca salen «Pagado» y «Debe S/ X» juntos sobre el mismo trabajo.
 */
function anotacionesDe(t: TarjetaDeMiDia, anotaciones: readonly AnotacionLeida[]): AnotacionLeida[] {
  const todas = anotaciones.filter((a) => mismaEntidad(t, a.entidad));
  const ajenaConPago = todas.some((a) => a.modulo !== t.modulo && a.pagado !== undefined);
  return ajenaConPago ? todas.filter((a) => a.modulo !== t.modulo || a.pagado === undefined) : todas;
}

function aplicarAnotaciones(tarjetas: TarjetaDeMiDia[], anotaciones: readonly AnotacionLeida[]): TarjetaDeMiDia[] {
  return tarjetas.flatMap((t) => {
    const mias = anotacionesDe(t, anotaciones);
    // «Sin adelanto» solo se afirma si Finanzas lo confirma: hay una deuda de ese trabajo y todavía no recibió ningún
    // pago. Sin ese dato (sin acceso a Finanzas, deuda aún por aprobar o fuera de la lectura) la alerta no se muestra.
    if (t.grupo === 'adelanto' && (!mias.some((a) => a.conAdelanto === false && a.pagado === false) || mias.some((a) => a.conAdelanto || a.pagado))) return [];
    let r = { ...t, notas: [...t.notas] };
    for (const a of mias) {
      if (!r.detalle.includes(a.texto) && !r.notas.some((n) => n.texto === a.texto)) r.notas.push({ texto: a.texto, tono: a.tono });
      if (a.pagado) r = marcarPagado(r);
    }
    return [r];
  });
}

/** Los borradores que repiten una entidad que ya tiene tarjeta se vuelven una nota de esa tarjeta (salvo los de prioridad alta). */
function sumarBorradores(tarjetas: TarjetaDeMiDia[], borradores: readonly Borrador[], diaDe: (instante: string) => string): { tarjetas: TarjetaDeMiDia[]; propias: TarjetaDeMiDia[] } {
  const propias: TarjetaDeMiDia[] = [];
  const copia = tarjetas.map((t) => ({ ...t, notas: [...t.notas] }));
  const ordenados = [...borradores].sort((a, b) => Number(esDeDeuda(b)) - Number(esDeDeuda(a)) || Number(b.prioridad === 'alta') - Number(a.prioridad === 'alta'));
  for (const b of ordenados) {
    const duenia = b.prioridad === 'alta' ? undefined : copia.find((t) => mismaEntidad(t, entidadDeBorrador(b)));
    const texto = notaDeBorrador(b);
    if (duenia) {
      if (!duenia.notas.some((n) => n.texto === texto)) duenia.notas.push({ texto, tono: 'aviso' });
    } else propias.push(tarjetaDeBorrador(b, b.modulo, diaDe));
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
  const anotaciones = e.fuentes.flatMap((f) => f.anotaciones.map((a) => ({ ...a, modulo: f.modulo })));
  const anotadas = aplicarAnotaciones(base, anotaciones);
  const { tarjetas, propias } = sumarBorradores(anotadas, e.borradores, e.diaDe ?? ((i) => i.slice(0, 10)));

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
