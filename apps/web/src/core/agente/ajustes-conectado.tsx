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

const mensajeDe = (e: unknown): string => (e instanceof Error ? e.message : 'No se pudo cargar.');

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }): ReactNode {
  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h3 className="font-titulo text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function ControlConectado({ puedeConfigurar }: { puedeConfigurar: boolean }): ReactNode {
  const cliente = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const consulta = useQuery({ queryKey: CLAVE_CONFIGURACION_DEL_AGENTE, queryFn: async () => datosOError(await verConfiguracionDelAgente()) });
  if (!consulta.data) return null;
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

/**
 * Todo lo que la empresa necesita para confiar en el asistente y poder tomar el control: los frenos, lo que aprendió (y que una
 * persona debe revisar), lo que hizo (su huella) y el modelo. El humano siempre puede hacerlo a mano; esto es para vigilarlo.
 */
export function AjustesDelAsistente({ puedeConfigurar }: { puedeConfigurar: boolean }): ReactNode {
  return (
    <div className="flex flex-col gap-5">
      <ControlConectado puedeConfigurar={puedeConfigurar} />
      <Seccion titulo="Lo que aprendió"><LeccionesConectado puedeConfigurar={puedeConfigurar} /></Seccion>
      <Seccion titulo="Lo que hizo"><AccionesConectado /></Seccion>
      <Seccion titulo="Modelo"><ModeloConectado puedeConfigurar={puedeConfigurar} /></Seccion>
    </div>
  );
}
