import * as Tabs from '@radix-ui/react-tabs';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import {
  aprobarLeccion, archivarLeccion, cambiarControl, CLAVE_ACCIONES_DEL_AGENTE, CLAVE_CONFIGURACION_DEL_AGENTE, CLAVE_ESTADO_DEL_AGENTE, CLAVE_LECCIONES_DEL_AGENTE,
  listarAccionesDelAgente, listarLeccionesDelAgente, verConfiguracionDelAgente,
} from './api.ts';
import { ControlDelAsistente } from './control-del-asistente.tsx';
import { ListaDeAcciones } from './lista-de-acciones.tsx';
import { ListaDeLecciones } from './lista-de-lecciones.tsx';
import { tituloDeHerramienta } from './logica-control.ts';
import { ModeloConectado } from './modelo-conectado.tsx';
import { CargandoLista, ErrorConReintento } from './piezas-de-vista.tsx';

const mensajeDe = (e: unknown): string => (e instanceof Error ? e.message : 'No se pudo cargar.');

function ControlConectado({ puedeConfigurar }: { puedeConfigurar: boolean }): ReactNode {
  const cliente = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const consulta = useQuery({ queryKey: CLAVE_CONFIGURACION_DEL_AGENTE, queryFn: async () => datosOError(await verConfiguracionDelAgente()) });
  if (consulta.isPending) return <CargandoLista etiqueta="Cargando el control del asistente" />;
  if (!consulta.data) return <ErrorConReintento mensaje={mensajeDe(consulta.error)} alReintentar={() => void consulta.refetch()} />;
  async function cambiar(cambios: Parameters<typeof cambiarControl>[0]): Promise<void> {
    setOcupado(true);
    const r = await cambiarControl(cambios);
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok) {
      notificar('Control actualizado', 'exito');
      void cliente.invalidateQueries({ queryKey: CLAVE_CONFIGURACION_DEL_AGENTE });
      void cliente.invalidateQueries({ queryKey: CLAVE_ESTADO_DEL_AGENTE });
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }
  return <ControlDelAsistente key={`${consulta.data.configuracion.topePorOperacionCentimos}`} configuracion={consulta.data.configuracion} puedeConfigurar={puedeConfigurar} ocupado={ocupado} alCambiar={(c) => void cambiar(c)} />;
}

function LeccionesConectado({ puedeConfigurar }: { puedeConfigurar: boolean }): ReactNode {
  const cliente = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const consulta = useQuery({ queryKey: CLAVE_LECCIONES_DEL_AGENTE, queryFn: async () => datosOError(await listarLeccionesDelAgente()) });
  async function resolver(accion: () => ReturnType<typeof archivarLeccion>): Promise<void> {
    setOcupado(true);
    const r = await accion();
    setOcupado(false);
    if (r.ok) void cliente.invalidateQueries({ queryKey: CLAVE_LECCIONES_DEL_AGENTE });
    else if ('error' in r) notificar(r.error.mensaje, 'error');
  }
  return (
    <ListaDeLecciones
      estado={consulta.isPending ? 'cargando' : consulta.isError ? 'error' : 'listo'}
      mensajeDeError={consulta.isError ? mensajeDe(consulta.error) : undefined}
      lecciones={consulta.data?.items ?? []}
      puedeCompartir={puedeConfigurar}
      ocupado={ocupado}
      alAprobar={(id, alcance) => void resolver(() => aprobarLeccion(id, alcance))}
      alArchivar={(id) => void resolver(() => archivarLeccion(id))}
      alReintentar={() => void consulta.refetch()}
    />
  );
}

function AccionesConectado(): ReactNode {
  const consulta = useInfiniteQuery({
    queryKey: CLAVE_ACCIONES_DEL_AGENTE,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => datosOError(await listarAccionesDelAgente(pageParam)),
    getNextPageParam: (pagina) => pagina.siguiente ?? undefined,
  });
  return (
    <ListaDeAcciones
      estado={consulta.isPending ? 'cargando' : consulta.isError ? 'error' : 'listo'}
      mensajeDeError={consulta.isError ? mensajeDe(consulta.error) : undefined}
      acciones={consulta.data?.pages.flatMap((p) => p.items) ?? []}
      titulo={tituloDeHerramienta}
      hayMas={consulta.hasNextPage}
      alVerMas={() => void consulta.fetchNextPage()}
      alReintentar={() => void consulta.refetch()}
    />
  );
}

const PESTANA = 'min-h-(--alto-control) cursor-pointer rounded-full text-[0.8125rem] font-semibold text-texto-suave transition-colors duration-150 hover:text-texto data-[state=active]:bg-linear-135 data-[state=active]:from-asistente-hondo-1 data-[state=active]:to-asistente-hondo-2 data-[state=active]:text-white data-[state=active]:shadow-sutil';

/** El contenido de una pestaña, con una línea que dice para qué sirve. */
function Contenido({ valor, ayuda, children }: { valor: string; ayuda: string; children: ReactNode }): ReactNode {
  return (
    <Tabs.Content value={valor} className="flex flex-col gap-3 outline-none motion-safe:data-[state=active]:animate-[aparecer_160ms_cubic-bezier(0.23,1,0.32,1)]">
      <p className="px-1 text-xs leading-relaxed text-texto-suave">{ayuda}</p>
      {children}
    </Tabs.Content>
  );
}

/**
 * Todo lo que la empresa necesita para confiar en el asistente y poder tomar el control: los frenos, lo que aprendió (y que una
 * persona debe revisar), lo que hizo (su huella) y el modelo. El humano siempre puede hacerlo a mano; esto es para vigilarlo.
 */
export function AjustesDelAsistente({ puedeConfigurar }: { puedeConfigurar: boolean }): ReactNode {
  return (
    <Tabs.Root defaultValue="control" className="flex flex-col gap-3">
      <Tabs.List aria-label="Secciones de los ajustes" className="grid grid-cols-4 gap-1 rounded-full border border-borde/80 bg-superficie/85 p-1">
        <Tabs.Trigger value="control" className={PESTANA}>Control</Tabs.Trigger>
        <Tabs.Trigger value="memoria" className={PESTANA}>Memoria</Tabs.Trigger>
        <Tabs.Trigger value="actividad" className={PESTANA}>Actividad</Tabs.Trigger>
        <Tabs.Trigger value="modelo" className={PESTANA}>Modelo</Tabs.Trigger>
      </Tabs.List>
      <Contenido valor="control" ayuda="Hasta dónde puede actuar sin pedir permiso."><ControlConectado puedeConfigurar={puedeConfigurar} /></Contenido>
      <Contenido valor="memoria" ayuda="Lo que aprendió. Lo que él propone no lo usa hasta que lo apruebes."><LeccionesConectado puedeConfigurar={puedeConfigurar} /></Contenido>
      <Contenido valor="actividad" ayuda="Lo que hizo, propuso o intentó, para que puedas revisarlo."><AccionesConectado /></Contenido>
      <Contenido valor="modelo" ayuda="Qué modelo responde y cuánto se lleva gastado."><ModeloConectado puedeConfigurar={puedeConfigurar} /></Contenido>
    </Tabs.Root>
  );
}
