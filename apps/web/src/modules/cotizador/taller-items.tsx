import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ItemDelCuadroDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { resolverAccion } from './acciones.ts';
import { archivarItem, listarItems, reordenarItems, restaurarItem } from './api-taller.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { MAXIMO_DE_ITEMS, etiquetaDeFactor, ordenAlMover } from './logica-taller.ts';
import { Cargando } from './marco.tsx';
import { HojaDeItem } from './taller-hoja-item.tsx';

/** Ítems propios del cuadro, en el orden en que aparecen. Se reordenan con subir y bajar. */
export function PanelDeItems({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const [hoja, setHoja] = useState<{ item: ItemDelCuadroDto | null } | null>(null);
  const [estado, setEstado] = useState<'activas' | 'archivadas'>('activas');
  const archivadas = estado === 'archivadas';
  const consulta = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'taller', 'items', estado], queryFn: async () => datosOError(await listarItems(estado)) });
  const filas = consulta.data?.items ?? [];
  const ids = filas.map((i) => i.id);

  async function mover(indice: number, delta: -1 | 1) {
    const orden = ordenAlMover(ids, indice, delta);
    if (orden) await resolverAccion(reordenarItems(orden), 'Orden actualizado.');
  }
  async function archivar(i: ItemDelCuadroDto) {
    if (await confirmar(`Archivar «${i.nombre}»`, 'Dejará de aparecer en los cuadros nuevos. Los ya armados se conservan.', { textoConfirmar: 'Archivar', peligroso: true })) await resolverAccion(archivarItem(i.id), 'Archivado.');
  }
  const columnas: Array<Columna<ItemDelCuadroDto>> = [
    { id: 'orden', titulo: 'N.º', celda: (i) => i.posicion + 1 },
    { id: 'nombre', titulo: 'Ítem', principal: true, celda: (i) => <span className="inline-flex flex-wrap items-center gap-2">{i.nombre}{i.fija ? <Insignia tono="info">Fijo</Insignia> : null}</span> },
    { id: 'factor', titulo: 'Suma a', celda: (i) => etiquetaDeFactor(i.factor) },
    { id: 'despues', titulo: 'Después de', celda: (i) => etiquetaDeFactor(i.despuesDe) },
    ...(puedeConfigurar && archivadas
      ? [{
          id: 'acciones', titulo: 'Acciones', alinear: 'derecha' as const,
          celda: (i: ItemDelCuadroDto) => <Boton variante="fantasma" onClick={() => void resolverAccion(restaurarItem(i.id), 'Restaurado.')}>Restaurar</Boton>,
        }]
      : []),
    ...(puedeConfigurar && !archivadas
      ? [{
          id: 'acciones', titulo: 'Acciones', alinear: 'derecha' as const,
          celda: (i: ItemDelCuadroDto) => (
            <span className="inline-flex flex-wrap justify-end gap-1">
              <Boton variante="fantasma" aria-label={`Subir ${i.nombre}`} onClick={() => void mover(ids.indexOf(i.id), -1)}>Subir</Boton>
              <Boton variante="fantasma" aria-label={`Bajar ${i.nombre}`} onClick={() => void mover(ids.indexOf(i.id), 1)}>Bajar</Boton>
              <Boton variante="fantasma" onClick={() => setHoja({ item: i })}>Editar</Boton>
              <Boton variante="fantasma" onClick={() => void archivar(i)}>Archivar</Boton>
            </span>
          ),
        }]
      : []),
  ];
  const nuevo = puedeConfigurar && !archivadas && filas.length < MAXIMO_DE_ITEMS ? <Boton variante="primario" icono="mas" onClick={() => setHoja({ item: null })}>Nuevo ítem</Boton> : undefined;

  if (consulta.isPending) return <Cargando etiqueta="Cargando ítems del cuadro" />;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar los ítems" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as 'activas' | 'archivadas')}>
          <option value="activas">Activas</option>
          <option value="archivadas">Archivadas</option>
        </CampoSelect>
      </div>
      {nuevo ? <div className="flex justify-end">{nuevo}</div> : null}
      <Lista etiqueta="Ítems del cuadro" columnas={columnas} filas={filas} clave={(i) => i.id} vacio={archivadas ? <EstadoVacio titulo="No hay ítems archivados" descripcion="Los ítems que archives aparecerán aquí para restaurarlos." icono="caja" /> : <EstadoVacio titulo="Todavía no hay ítems" descripcion="Los ítems son los acabados o servicios que cobras aparte y con los que nace cada cuadro (plastificado, encolado…)." icono="caja" accion={nuevo} />} />
      <p className="text-sm text-texto-suave">Hasta {MAXIMO_DE_ITEMS} ítems activos. El primero de la lista queda arriba en los cuadros nuevos.</p>
      <HojaDeItem abierto={hoja !== null} item={hoja?.item ?? null} alCerrar={() => setHoja(null)} />
    </div>
  );
}
