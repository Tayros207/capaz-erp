import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { OportunidadDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { BarraDeBusqueda } from '../../shared/ui/datos/barra-de-busqueda.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { CLAVE_CRM, listarOportunidades, POR_PAGINA } from './api.ts';
import { HojaNuevaOportunidad } from './hoja-nueva-oportunidad.tsx';
import { ETIQUETA_DE_ESTADO, textoDeMonto, TONO_DE_ESTADO } from './logica.ts';
import { MarcoCrm } from './marco.tsx';
import { usePermisosCrm } from './permisos.ts';

type Filtro = 'abiertas' | 'ganadas' | 'perdidas' | 'todas';

const COLUMNAS: Array<Columna<OportunidadDto>> = [
  { id: 'titulo', titulo: 'Oportunidad', principal: true, celda: (o) => o.titulo, valorDeOrden: (o) => o.titulo.toLocaleLowerCase('es') },
  { id: 'codigo', titulo: 'Código', celda: (o) => o.codigo },
  { id: 'cliente', titulo: 'Cliente', celda: (o) => o.clienteNombre, valorDeOrden: (o) => o.clienteNombre.toLocaleLowerCase('es') },
  { id: 'etapa', titulo: 'Etapa', celda: (o) => <Insignia tono={TONO_DE_ESTADO[o.estado]}>{o.estado === 'abierta' ? o.etapaNombre : ETIQUETA_DE_ESTADO[o.estado]}</Insignia> },
  { id: 'monto', titulo: 'Monto estimado', alinear: 'derecha', celda: (o) => textoDeMonto(o.montoEstimadoCentimos), valorDeOrden: (o) => o.montoEstimadoCentimos ?? -1 },
];

/** Oportunidades con búsqueda por título y filtro de estado. */
export function PantallaLista() {
  const { editar } = usePermisosCrm();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<Filtro>('abiertas');
  const [nueva, setNueva] = useState(false);
  const buscar = useRetardo(texto.trim(), 300);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_CRM, 'lista', estado, buscar],
    queryFn: async ({ pageParam }) =>
      datosOError(await listarOportunidades({ estado, limite: POR_PAGINA, ...(buscar && { buscar }), ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const abrir = (id: string) => void navegar(`/m/crm/oportunidades/${id}`);

  return (
    <MarcoCrm>
      <EncabezadoDePagina titulo="Oportunidades" accionPrincipal={editar ? <Boton variante="primario" icono="mas" onClick={() => setNueva(true)}>Nueva oportunidad</Boton> : undefined} />
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <BarraDeBusqueda valor={texto} onCambio={setTexto} etiqueta="Buscar oportunidades" placeholder="Buscar por título…" />
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as Filtro)}>
          <option value="abiertas">Abiertas</option>
          <option value="ganadas">Ganadas</option>
          <option value="perdidas">Perdidas</option>
          <option value="todas">Todas</option>
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando oportunidades" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las oportunidades" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Oportunidades"
            columnas={COLUMNAS}
            filas={filas}
            clave={(o) => o.id}
            onAbrir={(o) => abrir(o.id)}
            vacio={<EstadoVacio titulo={buscar ? 'Ninguna oportunidad con ese título' : 'No hay oportunidades aquí'} descripcion="Las oportunidades que anotes aparecerán en esta lista." icono="carpeta" />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaNuevaOportunidad abierto={nueva} alCerrar={() => setNueva(false)} alCrear={abrir} />
    </MarcoCrm>
  );
}
