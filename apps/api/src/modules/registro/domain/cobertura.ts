// Cobertura del mes: puro. Compara lo que entró en el mes con los pagos fijos anotados como deudas por pagar con
// vencimiento en ese mes. Dinero en céntimos enteros.

export type RangoDelMes = { mes: string; desde: string; hasta: string };

/** Primer y último día de un mes `AAAA-MM`. */
export function rangoDelMes(mes: string): RangoDelMes {
  const [anio, m] = mes.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return { mes, desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

export type DatosDeCobertura = { ingresosCentimos: number; compromisosCentimos: number; compromisosPagadosCentimos: number; compromisos: number };

export type Cobertura = DatosDeCobertura & { faltaCentimos: number; porcentaje: number | null };

/** `porcentaje` es `null` sin compromisos; lo que falta nunca es negativo (si los ingresos superan lo comprometido, 0). */
export function calcularCobertura(d: DatosDeCobertura): Cobertura {
  const porcentaje = d.compromisosCentimos > 0 ? Math.round((d.ingresosCentimos * 100) / d.compromisosCentimos) : null;
  return { ...d, faltaCentimos: Math.max(0, d.compromisosCentimos - d.ingresosCentimos), porcentaje };
}
