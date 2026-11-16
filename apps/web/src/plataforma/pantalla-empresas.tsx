import { useQueryClient } from '@tanstack/react-query';
import { Rows2, Rows3 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Boton } from '../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { useEmpresas } from './consultas.ts';
import { FiltrosDeEmpresas } from './filtros-de-empresas.tsx';
import { HojaEmpresaNueva } from './hoja-empresa-nueva.tsx';
import { HojaRestablecer } from './hoja-restablecer.tsx';
import { ListaDeEmpresas } from './lista-de-empresas.tsx';
import { busquedaDesdeFiltro, filtrarEmpresas, filtroDesdeBusqueda, FILTRO_VACIO, ordenarEmpresas, type FiltroDeEmpresas, type OrdenDeEmpresas } from './logica.ts';
import { CLAVE_EMPRESAS } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';
import { useDensidad } from './densidad.ts';
import { unir } from '../shared/ui/unir.ts';

export function PantallaEmpresas() {
  const cliente = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filtro = useMemo(() => filtroDesdeBusqueda(params), [params]);
  const [orden, setOrden] = useState<OrdenDeEmpresas>({ clave: 'estado', direccion: 'asc' });
  const [creando, setCreando] = useState(false);
  const [restableciendo, setRestableciendo] = useState(false);
  const [ahora] = useState(() => new Date());
  const consulta = useEmpresas();
  const [densidad, setDensidad] = useDensidad();
  const enfocarBusqueda = useCallback(() => document.getElementById('buscar-empresa')?.focus(), []);

  const cambiarFiltro = (f: FiltroDeEmpresas) => setParams(busquedaDesdeFiltro(f), { replace: true });
  const visibles = useMemo(
    () => (consulta.data ? ordenarEmpresas(filtrarEmpresas(consulta.data, filtro, ahora), orden, ahora) : []),
    [consulta.data, filtro, orden, ahora],
  );
  const hayFiltro = JSON.stringify(filtro) !== JSON.stringify(FILTRO_VACIO);

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Empresas"
        accionPrincipal={<Boton variante="primario" icono="mas" onClick={() => setCreando(true)}>Crear empresa</Boton>}
        accionesSecundarias={<Boton onClick={() => setRestableciendo(true)}>Restablecer contraseña</Boton>}
      />
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <ErrorDeConsulta error={consulta.error} />
      ) : (
        <>
          <FiltrosDeEmpresas empresas={consulta.data} filtro={filtro} alCambiar={cambiarFiltro} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-sm text-texto-suave">
              {visibles.length === consulta.data.length ? `${visibles.length} ${visibles.length === 1 ? 'empresa' : 'empresas'}` : `${visibles.length} de ${consulta.data.length} empresas`}
            </p>
            <div role="group" aria-label="Densidad de la lista" className="hidden items-center gap-0.5 rounded-control border border-borde bg-superficie p-0.5 md:flex">
              {([['comoda', 'Cómoda', Rows2], ['compacta', 'Compacta', Rows3]] as const).map(([id, texto, Icono]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={densidad === id}
                  onClick={() => setDensidad(id)}
                  className={unir('inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-chip px-2.5 text-xs font-medium transition-colors', densidad === id ? 'bg-superficie-alta text-texto shadow-sutil' : 'text-texto-suave hover:text-texto')}
                >
                  <Icono aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {texto}
                </button>
              ))}
            </div>
          </div>
          {visibles.length === 0 ? (
            <EstadoVacio
              titulo={hayFiltro ? 'Ninguna empresa coincide' : 'Sin empresas'}
              descripcion={hayFiltro ? 'Prueba con otro texto, estado o módulo.' : 'Crea la primera empresa de la plataforma.'}
              icono={hayFiltro ? 'buscar' : 'carpeta'}
              accion={hayFiltro ? <Boton onClick={() => cambiarFiltro(FILTRO_VACIO)}>Quitar filtros</Boton> : <Boton variante="primario" icono="mas" onClick={() => setCreando(true)}>Crear empresa</Boton>}
            />
          ) : (
            <ListaDeEmpresas empresas={visibles} orden={orden} alOrdenar={setOrden} ahora={ahora} densidad={densidad} enfocarBusqueda={enfocarBusqueda} />
          )}
        </>
      )}
      <HojaEmpresaNueva abierto={creando} alCerrar={() => setCreando(false)} alCambiar={() => void cliente.invalidateQueries({ queryKey: CLAVE_EMPRESAS })} />
      <HojaRestablecer abierto={restableciendo} alCerrar={() => setRestableciendo(false)} />
    </div>
  );
}
