import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { OportunidadDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Tablero } from '../../shared/ui/tablero.tsx';
import { CLAVE_CRM, listarOportunidades } from './api.ts';
import { useEtapas } from './consultas.ts';
import { HojaNuevaOportunidad } from './hoja-nueva-oportunidad.tsx';
import { HojaPerdida } from './hoja-perdida.tsx';
import { columnasDelTablero } from './logica.ts';
import { MarcoCrm } from './marco.tsx';
import { usePermisosCrm } from './permisos.ts';
import { TarjetaOportunidad } from './tarjeta-oportunidad.tsx';

/** Tablero por etapas: una columna por etapa abierta con cantidad y monto. */
export function PantallaTablero() {
  const { editar } = usePermisosCrm();
  const navegar = useNavigate();
  const [nueva, setNueva] = useState(false);
  const [perdiendo, setPerdiendo] = useState<OportunidadDto | null>(null);
  const etapas = useEtapas();
  const abiertas = useInfiniteQuery({
    queryKey: [...CLAVE_CRM, 'tablero'],
    queryFn: async ({ pageParam }) => datosOError(await listarOportunidades({ estado: 'abiertas', limite: 100, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = abiertas.data?.pages.flatMap((p) => p.items) ?? [];
  const nuevaBoton = editar ? <Boton variante="primario" icono="mas" onClick={() => setNueva(true)}>Nueva oportunidad</Boton> : undefined;

  let cuerpo;
  if (etapas.isPending || abiertas.isPending) {
    cuerpo = <div aria-busy="true" aria-label="Cargando el tablero" className="grid gap-2 sm:grid-cols-3"><Esqueleto className="h-40" /><Esqueleto className="h-40" /><Esqueleto className="h-40" /></div>;
  } else if (etapas.isError || abiertas.isError) {
    cuerpo = <EstadoVacio titulo="No pudimos cargar el tablero" descripcion={(etapas.error ?? abiertas.error)?.message} icono="caja" accion={<Boton onClick={() => { void etapas.refetch(); void abiertas.refetch(); }}>Reintentar</Boton>} />;
  } else if (etapas.data.length === 0) {
    cuerpo = <EstadoVacio titulo="El CRM aún no está preparado" descripcion="Pide a quien administra tu empresa que entre una vez al CRM para crear las etapas." icono="caja" />;
  } else {
    cuerpo = (
      <>
        <Tablero
          etiqueta="Oportunidades por etapa"
          columnas={columnasDelTablero(etapas.data, filas)}
          clave={(o) => o.id}
          tarjeta={(o) => <TarjetaOportunidad o={o} etapas={etapas.data} editar={editar} alPerder={setPerdiendo} />}
          vacio="Sin oportunidades en esta etapa"
        />
        <CargarMas cursor={abiertas.hasNextPage ? (abiertas.data.pages.at(-1)?.siguiente ?? null) : null} cargando={abiertas.isFetchingNextPage} onCargar={() => void abiertas.fetchNextPage()} resumen={`${filas.length} abiertas`} />
      </>
    );
  }

  return (
    <MarcoCrm>
      <EncabezadoDePagina titulo="Tablero de oportunidades" accionPrincipal={nuevaBoton} />
      {cuerpo}
      <HojaNuevaOportunidad abierto={nueva} alCerrar={() => setNueva(false)} alCrear={(id) => void navegar(`/m/crm/oportunidades/${id}`)} />
      <HojaPerdida oportunidad={perdiendo} alCerrar={() => setPerdiendo(null)} />
    </MarcoCrm>
  );
}
