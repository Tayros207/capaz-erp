import { useQuery } from '@tanstack/react-query';
import { Check, Circle } from 'lucide-react';
import { createElement, useMemo, useState } from 'react';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia, type TonoDeInsignia } from '../shared/ui/insignia.tsx';
import { unir } from '../shared/ui/unir.ts';
import { datosOError, listarModulos, type SalidaDePlataforma } from './api.ts';
import { CodigoDeModulo } from './chip-modulo.tsx';
import { CLAVE_MODULOS } from './claves.ts';
import { iconoDeModulo } from './iconos-de-modulo.ts';
import { estadoDeDesarrollo, nombreDeModulo, type EstadoDeDesarrollo } from './logica.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

type Modulo = SalidaDePlataforma<'plataforma_modulos_listar'>['items'][number];

const ESTADOS: ReadonlyArray<{ id: EstadoDeDesarrollo; texto: string; tono: TonoDeInsignia }> = [
  { id: 'disponible', texto: 'Disponible', tono: 'exito' },
  { id: 'en_proceso', texto: 'En proceso', tono: 'info' },
  { id: 'en_construccion', texto: 'En construcción', tono: 'aviso' },
];
const POR_ID = Object.fromEntries(ESTADOS.map((e) => [e.id, e])) as Record<EstadoDeDesarrollo, (typeof ESTADOS)[number]>;

function TarjetaDeModulo({ m }: { m: Modulo }) {
  const estado = POR_ID[estadoDeDesarrollo(m)];
  const hechas = m.secciones.filter((s) => s.construida).length;
  return (
    <li className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-control bg-superficie-alta text-texto">
            {createElement(iconoDeModulo(m.codigo), { className: 'size-5', strokeWidth: 1.75 })}
          </span>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <h3 className="font-titulo text-lg leading-tight font-semibold text-texto">{m.nombre || nombreDeModulo(m.codigo)}</h3>
            <span className="flex items-center gap-2">
              <CodigoDeModulo codigo={m.codigo} />
              <span className="text-xs text-texto-suave">v{m.version}</span>
            </span>
          </div>
        </div>
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
      </div>
      <p className="text-sm text-texto-suave">{m.descripcion}</p>
      {m.secciones.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-texto-suave">Pantallas · {hechas} de {m.secciones.length} construidas</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {m.secciones.map((s) => (
              <li key={s.nombre} className={unir('flex items-center gap-2 text-sm', s.construida ? 'text-texto' : 'text-texto-suave')}>
                {s.construida ? <Check aria-hidden className="size-3.5 text-exito" strokeWidth={2} /> : <Circle aria-hidden className="size-3.5" strokeWidth={1.75} />}
                {s.nombre}
                {s.construida ? null : <span className="text-xs">(pendiente)</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="m-0 mt-auto grid grid-cols-2 gap-2 border-t border-borde pt-3 text-sm">
        <div>
          <dt className="text-xs text-texto-suave">Empresas que lo usan</dt>
          <dd className="m-0 font-semibold text-texto tabular-nums">{m.empresas}</dd>
        </div>
        <div>
          <dt className="text-xs text-texto-suave">Depende de</dt>
          <dd className="m-0 text-texto">{m.dependeDe.length === 0 ? 'Nada' : m.dependeDe.map(nombreDeModulo).join(', ')}</dd>
        </div>
      </dl>
    </li>
  );
}

/** Catálogo completo de módulos del sistema: los disponibles, los que tienen pantallas por terminar y los en construcción. */
export function PantallaModulos() {
  const consulta = useQuery({ queryKey: CLAVE_MODULOS, queryFn: async () => datosOError(await listarModulos()).items });
  const [filtro, setFiltro] = useState<EstadoDeDesarrollo | 'todos'>('todos');
  const orden = useMemo(() => ESTADOS.map((e) => e.id), []);
  const lista = useMemo(
    () => [...(consulta.data ?? [])].sort((a, b) => orden.indexOf(estadoDeDesarrollo(b)) - orden.indexOf(estadoDeDesarrollo(a)) || a.nombre.localeCompare(b.nombre, 'es')),
    [consulta.data, orden],
  );
  const cuenta = (id: EstadoDeDesarrollo) => lista.filter((m) => estadoDeDesarrollo(m) === id).length;
  const visibles = filtro === 'todos' ? lista : lista.filter((m) => estadoDeDesarrollo(m) === filtro);

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoDePagina titulo="Módulos del sistema" />
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <ErrorDeConsulta error={consulta.error} />
      ) : lista.length === 0 ? (
        <EstadoVacio titulo="Sin módulos" descripcion="El catálogo no tiene módulos contratables." icono="caja" />
      ) : (
        <>
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
            {([{ id: 'todos', texto: 'Todos', n: lista.length }, ...ESTADOS.map((e) => ({ id: e.id, texto: e.texto, n: cuenta(e.id) }))] as const).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={unir(
                  'min-h-9 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors',
                  filtro === f.id ? 'border-transparent bg-accion text-accion-texto' : 'border-borde bg-superficie text-texto-suave hover:text-texto',
                )}
              >
                {f.texto} <span className="tabular-nums">{f.n}</span>
              </button>
            ))}
          </div>
          {visibles.length === 0 ? (
            <EstadoVacio titulo="Ninguno en este estado" descripcion="Prueba con otro filtro." icono="caja" />
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3" aria-label="Módulos">
              {visibles.map((m) => <TarjetaDeModulo key={m.codigo} m={m} />)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
