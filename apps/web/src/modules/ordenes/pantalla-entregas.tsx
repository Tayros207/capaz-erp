import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { cargarAbiertos } from './acciones.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { agruparEntregas, diaEnZona, sumarDias } from './logica.ts';
import { Cargando, SeccionesDePedidos } from './marco.tsx';
import { COLUMNAS_DE_PEDIDOS } from './columnas.tsx';

/** Pedidos abiertos por fecha de entrega: atrasados, hoy y los próximos siete días. */
export function PantallaEntregas() {
  const navegar = useNavigate();
  const [hoy] = useState(() => diaEnZona(new Date(), ZONA_POR_DEFECTO));
  const entregas = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'entregas', hoy], queryFn: () => cargarAbiertos({ entregaHasta: sumarDias(hoy, 7) }) });
  const grupos = entregas.data ? agruparEntregas(entregas.data.items, hoy) : [];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Entregas" />
      <SeccionesDePedidos />
      {entregas.isPending ? (
        <Cargando etiqueta="Cargando entregas" />
      ) : entregas.isError ? (
        <EstadoVacio titulo="No pudimos cargar las entregas" descripcion={entregas.error.message} icono="caja" accion={<Boton onClick={() => void entregas.refetch()}>Reintentar</Boton>} />
      ) : grupos.every((g) => g.pedidos.length === 0) ? (
        <EstadoVacio titulo="Nada que entregar en los próximos siete días" descripcion="Aquí verás los pedidos abiertos con fecha de entrega cercana o vencida." icono="check" />
      ) : (
        grupos.map((g) => (
          <section key={g.id} aria-label={g.titulo} className="flex flex-col gap-2">
            <h2 className="font-titulo font-semibold text-texto">{g.titulo} <span className="font-normal text-texto-suave">({g.pedidos.length})</span></h2>
            <Lista
              etiqueta={`Entregas: ${g.titulo}`}
              columnas={COLUMNAS_DE_PEDIDOS}
              filas={g.pedidos}
              clave={(p) => p.id}
              onAbrir={(p) => void navegar(`/m/ordenes/${p.id}`)}
              vacio={<p className="text-sm text-texto-suave">Ninguno.</p>}
            />
          </section>
        ))
      )}
    </div>
  );
}
