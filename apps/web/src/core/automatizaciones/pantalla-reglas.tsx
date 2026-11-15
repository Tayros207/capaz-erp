import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Regla } from '@capaz/shared';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Pestanas } from '../../shared/ui/datos/pestanas.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { activarRegla, datosOError, desactivarRegla, listarReglas } from './api.ts';
import { CLAVE_REGLAS } from './claves.ts';
import { Historial } from './historial.tsx';
import { ETIQUETA_DE_MODO, resumenDeDisparador } from './logica.ts';

const NUEVA = '/ajustes/automatizaciones/nueva';

function ListaDeReglas({ puedeGestionar }: { puedeGestionar: boolean }) {
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const [alternando, setAlternando] = useState<string | null>(null);
  const lista = useInfiniteQuery({
    queryKey: CLAVE_REGLAS,
    queryFn: async ({ pageParam }) => datosOError(await listarReglas(pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];

  async function alternar(r: Regla) {
    setAlternando(r.id);
    const resp = r.activa ? await desactivarRegla(r.id) : await activarRegla(r.id);
    setAlternando(null);
    if ('cancelada' in resp) return;
    if (resp.ok && 'datos' in resp) await consultas.invalidateQueries({ queryKey: ['automatizaciones'] });
    else if ('error' in resp) notificar(resp.error.mensaje, 'error');
  }

  const columnas: Array<Columna<Regla>> = [
    { id: 'nombre', titulo: 'Regla', principal: true, valorDeOrden: (r) => r.nombre.toLocaleLowerCase('es'), celda: (r) => r.nombre },
    { id: 'disparador', titulo: 'Cuándo', celda: (r) => resumenDeDisparador(r.disparador) },
    { id: 'modo', titulo: 'Modo', celda: (r) => ETIQUETA_DE_MODO[r.modo] },
    { id: 'estado', titulo: 'Estado', celda: (r) => (r.activa ? <Insignia tono="exito">Activa</Insignia> : <Insignia tono="neutro">Apagada</Insignia>) },
    {
      id: 'acciones',
      titulo: 'Acciones',
      celda: (r) => (puedeGestionar ? <Boton cargando={alternando === r.id} onClick={() => void alternar(r)}>{r.activa ? 'Desactivar' : 'Activar'}</Boton> : '—'),
    },
  ];

  if (lista.isPending) return <div aria-busy="true" aria-label="Cargando reglas" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>;
  if (lista.isError) return <EstadoVacio titulo="No pudimos cargar las reglas" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />;
  return (
    <div className="flex flex-col gap-3">
      <Lista
        etiqueta="Reglas"
        columnas={columnas}
        filas={filas}
        clave={(r) => r.id}
        onAbrir={(r) => void navegar(`/ajustes/automatizaciones/${r.id}`)}
        vacio={<EstadoVacio titulo="Todavía no hay reglas" descripcion="Una regla dice «cuando pase esto, haz aquello». Crea la primera." icono="caja" accion={puedeGestionar ? <Boton variante="primario" onClick={() => void navegar(NUEVA)}>Nueva regla</Boton> : undefined} />}
      />
      <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
    </div>
  );
}

/** `/ajustes/automatizaciones`: reglas con su estado e historial de ejecuciones. */
export function PantallaReglas() {
  const yo = useYo();
  const navegar = useNavigate();
  const gestiona = !!yo && puede(yo, 'automatizaciones:gestionar');
  const [activa, setActiva] = useState('reglas');
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Automatizaciones" migas={[{ texto: 'Ajustes' }, { texto: 'Automatizaciones' }]} accionPrincipal={gestiona ? <Boton variante="primario" icono="mas" onClick={() => void navegar(NUEVA)}>Nueva regla</Boton> : undefined} />
      <Pestanas
        etiqueta="Secciones de automatizaciones"
        activa={activa}
        onCambio={setActiva}
        pestanas={[
          { id: 'reglas', etiqueta: 'Reglas', contenido: <ListaDeReglas puedeGestionar={gestiona} /> },
          { id: 'historial', etiqueta: 'Historial', contenido: <Historial /> },
        ]}
      />
    </div>
  );
}
