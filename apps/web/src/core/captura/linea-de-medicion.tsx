import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { CLAVE_CAPTURA, medirDictados } from './api.ts';
import { lineaDeMedicion, rangoDelMes } from './logica.ts';

function diaDeHoy(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
}

/** Línea con lo medido de los dictados del mes. Vive aparte para que Inicio no arrastre la pantalla de dictado. */
export function LineaDeMedicion({ alineacion = 'centro' }: { alineacion?: 'centro' | 'izquierda' } = {}) {
  const [rango] = useState(() => rangoDelMes(diaDeHoy()));
  const m = useQuery({ queryKey: [...CLAVE_CAPTURA, 'metricas', rango.desde, rango.hasta], queryFn: async () => datosOError(await medirDictados(rango.desde, rango.hasta)), staleTime: 30_000 });
  if (!m.data) return null;
  return <p className={alineacion === 'centro' ? 'text-center text-sm text-texto-suave' : 'text-sm text-texto-suave'}>{lineaDeMedicion(m.data)}</p>;
}
