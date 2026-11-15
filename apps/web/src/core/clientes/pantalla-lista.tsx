import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { ClienteDto } from '@capaz/shared';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { BarraDeBusqueda } from '../../shared/ui/datos/barra-de-busqueda.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import type { Orden } from '../../shared/ui/datos/logica-lista.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { buscarClientes, datosOError, listarClientes, type EstadoDeListado } from './api.ts';
import { CLAVE_CLIENTES } from './claves.ts';
import { HojaNuevoCliente } from './hoja-nuevo-cliente.tsx';
import { ETIQUETA_DE_TIPO, textoDeDocumento } from './logica.ts';
import { useRetardo } from './use-retardo.ts';

const COLUMNAS: Array<Columna<ClienteDto>> = [
  {
    id: 'nombre',
    titulo: 'Nombre',
    principal: true,
    valorDeOrden: (c) => c.nombre.toLocaleLowerCase('es'),
    celda: (c) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        {c.nombre}
        {c.archivadoEn ? <Insignia tono="neutro">Archivado</Insignia> : null}
      </span>
    ),
  },
  { id: 'tipo', titulo: 'Tipo', celda: (c) => ETIQUETA_DE_TIPO[c.tipo] },
  { id: 'documento', titulo: 'Documento', celda: (c) => textoDeDocumento(c) },
  { id: 'telefono', titulo: 'Teléfono', celda: (c) => c.telefono ?? '—' },
];

export function PantallaClientes() {
  const yo = useYo();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<EstadoDeListado>('activos');
  const [orden, setOrden] = useState<Orden>(null);
  const [nuevo, setNuevo] = useState(false);
  const consulta = useRetardo(texto.trim(), 300);
  const buscando = consulta.length > 0;

  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_CLIENTES, 'lista', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarClientes(estado, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
    enabled: !buscando,
  });
  const busqueda = useQuery({
    queryKey: [...CLAVE_CLIENTES, 'buscar', consulta],
    queryFn: async () => datosOError(await buscarClientes(consulta)),
    enabled: buscando,
  });

  const activa = buscando ? busqueda : lista;
  const filas: readonly ClienteDto[] = buscando ? (busqueda.data?.items ?? []) : (lista.data?.pages.flatMap((p) => p.items) ?? []);
  const puedeEditar = !!yo && puede(yo, 'clientes:editar');
  const abrir = (id: string) => void navegar(`/clientes/${id}`);
  const irA = (id: string) => {
    setNuevo(false);
    abrir(id);
  };

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Clientes"
        accionPrincipal={puedeEditar ? <Boton variante="primario" icono="mas" onClick={() => setNuevo(true)}>Nuevo cliente</Boton> : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <BarraDeBusqueda valor={texto} onCambio={setTexto} etiqueta="Buscar clientes" placeholder="Buscar por nombre…" />
        {buscando ? null : (
          <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as EstadoDeListado)}>
            <option value="activos">Activos</option>
            <option value="archivados">Archivados</option>
            <option value="todos">Todos</option>
          </CampoSelect>
        )}
      </div>

      {activa.isPending && activa.fetchStatus !== 'idle' ? (
        <div aria-busy="true" aria-label="Cargando clientes" className="flex flex-col gap-2">
          <Esqueleto className="h-12" />
          <Esqueleto className="h-12" />
          <Esqueleto className="h-12" />
        </div>
      ) : activa.isError ? (
        <EstadoVacio titulo="No pudimos cargar los clientes" descripcion={activa.error.message} icono="caja" accion={<Boton onClick={() => void activa.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Clientes"
            columnas={COLUMNAS}
            filas={filas}
            clave={(c) => c.id}
            orden={orden}
            onOrden={setOrden}
            onAbrir={(c) => abrir(c.id)}
            vacio={
              <EstadoVacio
                titulo={buscando ? 'Ningún cliente se parece a eso' : 'Todavía no hay clientes'}
                descripcion={buscando ? 'Prueba con otro nombre o crea uno nuevo.' : 'Los clientes que registres aparecerán aquí.'}
                icono="usuario"
                accion={puedeEditar ? <Boton variante="primario" onClick={() => setNuevo(true)}>Nuevo cliente</Boton> : undefined}
              />
            }
          />
          {buscando ? null : <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />}
        </>
      )}

      <HojaNuevoCliente abierto={nuevo} alCerrar={() => setNuevo(false)} alAbrirExistente={irA} alCrear={irA} />
    </div>
  );
}
