import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Borrador } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { datosOError, listarBorradores, type FiltrosDeBandeja } from './api.ts';
import { CLAVE_BANDEJA } from './claves.ts';
import { InsigniasDeBorrador } from './insignias.tsx';
import { ETIQUETA_DE_ORIGEN, FILTROS_DE_ESTADO, titularDeHerramienta } from './logica.ts';

const COLUMNAS: Array<Columna<Borrador>> = [
  {
    id: 'resumen',
    titulo: 'Propuesta',
    principal: true,
    celda: (b) => (
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{b.resumen || titularDeHerramienta(b.herramienta)}</span>
        <span className="text-sm text-texto-suave">{titularDeHerramienta(b.herramienta)}</span>
      </span>
    ),
  },
  { id: 'estado', titulo: 'Estado y origen', celda: (b) => <InsigniasDeBorrador b={b} /> },
  { id: 'modulo', titulo: 'Módulo', celda: (b) => b.modulo },
  { id: 'fecha', titulo: 'Propuesto', celda: (b) => formatearFechaHora(b.propuestoEn) },
];

export function PantallaBandeja() {
  const navegar = useNavigate();
  const [filtros, setFiltros] = useState<FiltrosDeBandeja>({ estado: 'pendiente', modulo: '', origen: 'todos' });

  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_BANDEJA, 'lista', filtros],
    queryFn: async ({ pageParam }) => datosOError(await listarBorradores(filtros, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const pendientes = filtros.estado === 'pendiente';

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Bandeja de borradores" />
      <p className="text-texto-suave">Lo que un agente, una regla o un conector propuso. Nada se aplica hasta que una persona lo aprueba.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <CampoSelect etiqueta="Estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as FiltrosDeBandeja['estado'] })}>
          {FILTROS_DE_ESTADO.map((f) => (
            <option key={f.valor} value={f.valor}>{f.texto}</option>
          ))}
        </CampoSelect>
        <Campo etiqueta="Módulo" value={filtros.modulo} placeholder="Todos" onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value })} />
        <CampoSelect etiqueta="Origen" value={filtros.origen} onChange={(e) => setFiltros({ ...filtros, origen: e.target.value as FiltrosDeBandeja['origen'] })}>
          <option value="todos">Todos</option>
          {Object.entries(ETIQUETA_DE_ORIGEN).map(([valor, texto]) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </CampoSelect>
      </div>

      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando borradores" className="flex flex-col gap-2">
          <Esqueleto className="h-16" />
          <Esqueleto className="h-16" />
          <Esqueleto className="h-16" />
        </div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar la bandeja" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Borradores"
            columnas={COLUMNAS}
            filas={filas}
            clave={(b) => b.id}
            onAbrir={(b) => void navegar(`/bandeja/${b.id}`)}
            vacio={
              <EstadoVacio
                titulo={pendientes ? 'Nada por revisar' : 'No hay borradores con esos filtros'}
                descripcion={pendientes ? 'Cuando un agente o una regla proponga algo, aparecerá aquí.' : 'Prueba con otros filtros.'}
                icono="caja"
              />
            }
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </div>
  );
}
