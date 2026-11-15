import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { EjecucionDeRegla } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { datosOError, listarEjecuciones } from './api.ts';
import { CLAVE_EJECUCIONES } from './claves.ts';
import { detalleLegible, ETIQUETA_DE_RESULTADO, fechaHora, TONO_DE_RESULTADO } from './logica.ts';

const COLUMNAS: Array<Columna<EjecucionDeRegla>> = [
  { id: 'cuando', titulo: 'Cuándo', principal: true, celda: (e) => fechaHora(e.creadoEn) },
  { id: 'resultado', titulo: 'Resultado', celda: (e) => <Insignia tono={TONO_DE_RESULTADO[e.resultado]}>{ETIQUETA_DE_RESULTADO[e.resultado]}</Insignia> },
  { id: 'tipo', titulo: 'Tipo', celda: (e) => (e.simulada ? <Insignia tono="info">Prueba</Insignia> : 'Real') },
  { id: 'detalle', titulo: 'Detalle', celda: (e) => <span className="break-words">{detalleLegible(e.detalle)}</span> },
];

/** Historial de ejecuciones de una regla, o de todas si no se da `reglaId`. */
export function Historial({ reglaId }: { reglaId?: string }) {
  const [tipo, setTipo] = useState<'' | 'reales' | 'pruebas'>('');
  const simulada = tipo === '' ? undefined : tipo === 'pruebas';
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_EJECUCIONES, reglaId ?? 'todas', tipo],
    queryFn: async ({ pageParam }) => datosOError(await listarEjecuciones({ reglaId, simulada }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="sm:max-w-56">
        <CampoSelect etiqueta="Mostrar" value={tipo} onChange={(e) => setTipo(e.target.value as '' | 'reales' | 'pruebas')}>
          <option value="">Todas</option>
          <option value="reales">Solo reales</option>
          <option value="pruebas">Solo pruebas</option>
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando historial" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar el historial" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista etiqueta="Ejecuciones" columnas={COLUMNAS} filas={filas} clave={(e) => e.id} vacio={<EstadoVacio titulo="Todavía no hay ejecuciones" descripcion="Cada vez que una regla corra o la pruebes, quedará aquí." icono="caja" />} />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </div>
  );
}
