import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import type { Respuesta } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { resolverAccion } from './acciones.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { Cargando } from './marco.tsx';

type Pagina<T> = { items: T[]; siguiente: string | null };
type Fila = { id: string; nombre: string; archivadoEn: string | null };
type EstadoDeLista = 'activas' | 'archivadas';

type Props<T extends Fila> = {
  clave: string;
  etiqueta: string;
  /** Llama a la herramienta de listado; el panel pone el estado, la búsqueda y el cursor. */
  cargar: (estado: EstadoDeLista, buscar: string, cursor?: string) => Promise<Respuesta<Pagina<T>>>;
  columnas: Array<Columna<T>>;
  puedeConfigurar: boolean;
  textoNuevo: string;
  vacioTitulo: string;
  vacioDescripcion: string;
  onNuevo: () => void;
  onEditar: (fila: T) => void;
  archivar: (id: string) => Promise<Respuesta<unknown>>;
  restaurar: (id: string) => Promise<Respuesta<unknown>>;
  /** Solo de pantalla: abre la hoja de alta con los datos de la fila (sin herramienta nueva). */
  onDuplicar?: (fila: T) => void;
  /** Un filtro propio de la pestaña (por ejemplo el factor) y lo que cambia su consulta. */
  filtroExtra?: ReactNode;
  claveExtra?: unknown;
};

/** Lista con búsqueda, activas/archivadas, paginación, y las acciones editar y archivar (con confirmación). */
export function PanelDelTaller<T extends Fila>(p: Props<T>) {
  const [estado, setEstado] = useState<EstadoDeLista>('activas');
  const [texto, setTexto] = useState('');
  const buscar = useRetardo(texto.trim());
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_COTIZADOR, 'taller', p.clave, estado, buscar, p.claveExtra ?? null],
    queryFn: async ({ pageParam }) => datosOError(await p.cargar(estado, buscar, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (pagina) => pagina.siguiente ?? undefined,
  });
  const filas = consulta.data?.pages.flatMap((x) => x.items) ?? [];

  async function pedirArchivar(f: T) {
    const si = await confirmar(`Archivar «${f.nombre}»`, 'Dejará de ofrecerse en los cuadros nuevos. Lo ya armado se conserva.', { textoConfirmar: 'Archivar', peligroso: true });
    if (si) await resolverAccion(p.archivar(f.id), 'Archivado.');
  }
  const acciones: Columna<T> = {
    id: 'acciones', titulo: 'Acciones', alinear: 'derecha',
    celda: (f) => f.archivadoEn ? (
      <span className="inline-flex flex-wrap items-center justify-end gap-2">
        <Insignia tono="neutro">Archivado</Insignia>
        <Boton variante="fantasma" onClick={() => void resolverAccion(p.restaurar(f.id), 'Restaurado.')}>Restaurar</Boton>
      </span>
    ) : (
      <span className="inline-flex flex-wrap justify-end gap-1">
        <Boton variante="fantasma" onClick={() => p.onEditar(f)}>Editar</Boton>
        {p.onDuplicar ? <Boton variante="fantasma" onClick={() => p.onDuplicar?.(f)}>Duplicar</Boton> : null}
        <Boton variante="fantasma" onClick={() => void pedirArchivar(f)}>Archivar</Boton>
      </span>
    ),
  };
  const nuevo = p.puedeConfigurar ? <Boton variante="primario" icono="mas" onClick={p.onNuevo}>{p.textoNuevo}</Boton> : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[12rem_12rem_1fr]">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as EstadoDeLista)}>
          <option value="activas">Activas</option>
          <option value="archivadas">Archivadas</option>
        </CampoSelect>
        {p.filtroExtra ?? <span className="hidden sm:block" />}
        <Campo etiqueta="Buscar" type="search" value={texto} maxLength={100} placeholder="Nombre" onChange={(e) => setTexto(e.target.value)} />
      </div>
      {nuevo ? <div className="flex justify-end">{nuevo}</div> : null}
      {consulta.isPending ? <Cargando etiqueta={`Cargando ${p.etiqueta}`} /> : consulta.isError ? (
        <EstadoVacio titulo={`No pudimos cargar ${p.etiqueta}`} descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta={p.etiqueta}
            columnas={p.puedeConfigurar ? [...p.columnas, acciones] : p.columnas}
            filas={filas}
            clave={(f) => f.id}
            vacio={<EstadoVacio titulo={p.vacioTitulo} descripcion={p.vacioDescripcion} icono="caja" accion={estado === 'activas' ? nuevo : undefined} />}
          />
          <CargarMas cursor={consulta.hasNextPage ? (consulta.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={consulta.isFetchingNextPage} onCargar={() => void consulta.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </div>
  );
}
