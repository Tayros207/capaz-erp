import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatearSoles, type Yo } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia, type TonoDeInsignia } from '../../shared/ui/insignia.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { usePendientes } from '../bandeja/use-pendientes.ts';
import {
  fechaEnZona, rangoDelMes, tarjetasVisibles, textoDeActividadesVencidas, textoDeBorradores, textoDeDeudasVencidas, type CodigoDeTarjeta,
} from './logica.ts';

type Dato = { cuenta: number; texto: string; detalle?: string };
type Estado = { cargando: boolean; error: boolean; dato: Dato | null };

const TITULOS: Record<CodigoDeTarjeta, string> = {
  borradores: 'Por aprobar',
  deudas: 'Por cobrar vencido',
  entregas: 'Entregas',
  actividades: 'Actividades',
};
const DESTINOS: Record<CodigoDeTarjeta, string> = {
  borradores: '/bandeja',
  deudas: '/m/registro/por-cobrar',
  entregas: '/m/ordenes/entregas',
  actividades: '/m/crm/actividades',
};

function useDeudas(activa: boolean, mes: { desde: string; hasta: string }): Estado {
  const q = useQuery({
    queryKey: ['inicio', 'deudas', mes.desde], enabled: activa,
    queryFn: async () => datosOError(await llamar('registro_resumen', mes)),
  });
  const d = q.data;
  const dato = d ? { cuenta: d.vencidasPorCobrar, texto: textoDeDeudasVencidas(d.vencidasPorCobrar), detalle: d.vencidasPorCobrar > 0 ? formatearSoles(d.vencidasPorCobrarCentimos) : undefined } : null;
  return { cargando: activa && q.isPending, error: q.isError, dato };
}

function useEntregas(activa: boolean, mes: { desde: string; hasta: string }): Estado {
  const q = useQuery({
    queryKey: ['inicio', 'entregas', mes.desde], enabled: activa,
    queryFn: async () => datosOError(await llamar('ordenes_resumen', mes)),
  });
  const d = q.data;
  const dato = d
    ? {
        cuenta: d.entregasDeHoy + d.atrasados,
        texto: `${d.entregasDeHoy} ${d.entregasDeHoy === 1 ? 'entrega hoy' : 'entregas hoy'}`,
        detalle: `${d.atrasados} ${d.atrasados === 1 ? 'pedido atrasado' : 'pedidos atrasados'}`,
      }
    : null;
  return { cargando: activa && q.isPending, error: q.isError, dato };
}

function useActividades(activa: boolean, mes: { desde: string; hasta: string }): Estado {
  const q = useQuery({
    queryKey: ['inicio', 'actividades', mes.desde], enabled: activa,
    queryFn: async () => datosOError(await llamar('crm_resumen', mes)),
  });
  const d = q.data;
  const dato = d ? { cuenta: d.actividadesVencidas, texto: textoDeActividadesVencidas(d.actividadesVencidas) } : null;
  return { cargando: activa && q.isPending, error: q.isError, dato };
}

function Tarjeta({ codigo, estado }: { codigo: CodigoDeTarjeta; estado: Estado }) {
  const { dato } = estado;
  const tono: TonoDeInsignia = dato && dato.cuenta > 0 ? 'aviso' : 'exito';
  return (
    <Link to={DESTINOS[codigo]} className={unir('flex min-h-11 flex-col gap-1 rounded-tarjeta border border-borde bg-superficie p-3', 'hover:border-borde-fuerte hover:bg-superficie-alta')}>
      <span className="flex items-center justify-between gap-2 text-sm text-texto-suave">
        {TITULOS[codigo]}
        {dato ? <Insignia tono={tono}>{dato.cuenta > 0 ? 'Pendiente' : 'Al día'}</Insignia> : null}
      </span>
      {estado.cargando ? <Esqueleto className="h-7 w-2/3" /> : null}
      {estado.error ? <span className="text-sm text-texto-suave">No se pudo cargar. Toca para abrir la pantalla.</span> : null}
      {dato ? <span className="font-titulo text-xl font-semibold text-texto">{dato.texto}</span> : null}
      {dato?.detalle ? <span className="text-sm text-texto-suave">{dato.detalle}</span> : null}
    </Link>
  );
}

/** «Pendientes»: lo que espera a la persona, solo de los módulos a los que entra con alcance `todos`. */
export function Pendientes({ yo }: { yo: Yo }) {
  const visibles = tarjetasVisibles(yo);
  const [mes] = useState(() => rangoDelMes(fechaEnZona(new Date(), ZONA_POR_DEFECTO)));
  const borradores = usePendientes(visibles.includes('borradores'));
  const estados: Record<CodigoDeTarjeta, Estado> = {
    borradores: { cargando: false, error: false, dato: { cuenta: borradores.pendientes, texto: textoDeBorradores(borradores.pendientes), detalle: borradores.deAltaPrioridad > 0 ? `${borradores.deAltaPrioridad} de prioridad alta` : undefined } },
    deudas: useDeudas(visibles.includes('deudas'), mes),
    entregas: useEntregas(visibles.includes('entregas'), mes),
    actividades: useActividades(visibles.includes('actividades'), mes),
  };
  if (visibles.length === 0) return null;
  return (
    <section aria-labelledby="pendientes" className="flex flex-col gap-2">
      <h2 id="pendientes" className="font-titulo text-lg font-semibold text-texto">Pendientes</h2>
      <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {visibles.map((c) => <li key={c} className="flex *:flex-1"><Tarjeta codigo={c} estado={estados[c]} /></li>)}
      </ul>
    </section>
  );
}
