import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import { createElement, useMemo, useState } from 'react';
import { ArrowLeft, Clock, ShieldCheck } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { ModuloDeEmpresaDto } from '@capaz/shared';
import { formatearFecha } from '../shared/formato/fechas.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { notificar } from '../shared/ui/notificar.ts';
import { unir } from '../shared/ui/unir.ts';
import { darDeBajaModulo, datosOError, listarPlanes, reactivarModulo, suspenderModulo, verEmpresa } from './api.ts';
import { HojaActivar } from './hoja-activar.tsx';
import { HojaContrato } from './hoja-contrato.tsx';
import { diasHasta, ESTADO_DE_EMPRESA, estadoDeEmpresa, estadoDeModulo, mensajeDeRechazo, nombreDeModulo, proximoVencimiento, textoDeVencimiento, type AccionDeModulo } from './logica.ts';
import { AvatarDeEmpresa } from './avatar-de-empresa.tsx';
import { CodigoDeModulo } from './chip-modulo.tsx';
import { iconoDeModulo } from './iconos-de-modulo.ts';
import { LineaDeTiempo } from './linea-de-tiempo.tsx';
import { TarjetaDeModulo } from './tarjeta-de-modulo.tsx';
import { CLAVE_EMPRESAS, CLAVE_PLANES } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

const PESTANAS = ['resumen', 'modulos', 'historial'] as const;
type Pestana = (typeof PESTANAS)[number];

const DISPARADOR =
  'relative inline-flex min-h-10 cursor-pointer items-center gap-2 px-3 text-sm font-medium whitespace-nowrap text-texto-suave transition-colors hover:text-texto data-[state=active]:text-texto after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accion after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100';
const PANEL = 'outline-none motion-safe:data-[state=active]:animate-[aparecer_160ms_cubic-bezier(0.23,1,0.32,1)]';

function Contador({ n }: { n: number }) {
  return <span className="rounded-full bg-superficie-alta px-1.5 text-[0.6875rem] text-texto-suave tabular-nums">{n}</span>;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="text-right text-sm font-medium text-texto tabular-nums">{children}</dd>
    </div>
  );
}

function FilaDeModulo({ m, ahora }: { m: ModuloDeEmpresaDto; ahora: Date }) {
  const estado = estadoDeModulo(m.estado);
  const objetivo = m.estado === 'prueba' ? m.pruebaHasta : m.estado === 'baja' ? null : m.vigenteHasta;
  const dias = diasHasta(objetivo, ahora);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-superficie-alta text-texto-suave">
        {createElement(iconoDeModulo(m.modulo), { className: 'size-4.5', strokeWidth: 1.75 })}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-texto">{m.nombre || nombreDeModulo(m.modulo)}</span>
        <span className="text-xs text-texto-suave">{dias === null ? (m.estado === 'baja' ? 'Solo lectura' : 'Sin fecha de vencimiento') : textoDeVencimiento(dias)}</span>
      </span>
      <CodigoDeModulo codigo={m.modulo} />
      <Insignia tono={estado.tono}>{estado.texto}</Insignia>
    </li>
  );
}

export function PantallaEmpresa() {
  const { id = '' } = useParams();
  const cliente = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [contrato, setContrato] = useState<ModuloDeEmpresaDto | null>(null);
  const [activando, setActivando] = useState(false);
  const [filtroHistorial, setFiltroHistorial] = useState('todos');
  const [ahora] = useState(() => new Date());
  const consulta = useQuery({ queryKey: [...CLAVE_EMPRESAS, 'ficha', id], queryFn: async () => datosOError(await verEmpresa(id)) });
  const planes = useQuery({ queryKey: CLAVE_PLANES, queryFn: async () => datosOError(await listarPlanes()).items });
  const recargar = () => void cliente.invalidateQueries({ queryKey: CLAVE_EMPRESAS });
  const pedida = params.get('pestana');
  const pestana: Pestana = PESTANAS.find((p) => p === pedida) ?? 'resumen';
  const modulosDelHistorial = useMemo(() => [...new Set((consulta.data?.historial ?? []).map((v) => v.modulo))], [consulta.data]);

  const atras = (
    <Link to="/plataforma" className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm text-texto-suave transition-colors hover:text-texto">
      <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
      Empresas
    </Link>
  );

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) {
    return (
      <div className="flex flex-col gap-4">
        {atras}
        <ErrorDeConsulta error={consulta.error} />
      </div>
    );
  }
  const e = consulta.data;
  const conocidos = [...new Set([...e.modulos.map((m) => m.modulo), ...(planes.data?.flatMap((p) => p.modulos) ?? [])])].sort();
  const estadoGeneral = ESTADO_DE_EMPRESA[estadoDeEmpresa(e)];
  const vence = proximoVencimiento(e, ahora);
  const historial = filtroHistorial === 'todos' ? e.historial : e.historial.filter((v) => v.modulo === filtroHistorial);

  async function accionar(m: ModuloDeEmpresaDto, a: AccionDeModulo) {
    const args = { empresa: e.id, modulo: m.modulo };
    const r = a === 'suspender' ? await suspenderModulo(args) : a === 'dar_de_baja' ? await darDeBajaModulo(args) : await reactivarModulo(args);
    if ('cancelada' in r) return;
    if (r.ok) {
      notificar('Listo.', 'exito');
      recargar();
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  const activos = e.modulos.filter((m) => m.estado === 'activo').length;
  const enPrueba = e.modulos.filter((m) => m.estado === 'prueba').length;

  return (
    <div className="flex flex-col gap-5">
      {atras}
      <section aria-label="Resumen de la empresa" className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta sm:flex-row sm:items-center md:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <AvatarDeEmpresa nombre={e.nombre} tamano="grande" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-titulo text-xl font-semibold tracking-tight text-texto md:text-2xl">{e.nombre}</h1>
              <Insignia tono={estadoGeneral.tono}>{estadoGeneral.texto}</Insignia>
            </div>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texto-suave">
              <CodigoDeModulo codigo={e.id} />
              <span>Alta {formatearFecha(e.altaEn)}</span>
              <span>{e.miembros} {e.miembros === 1 ? 'usuario' : 'usuarios'}</span>
            </span>
          </div>
        </div>
        <Boton variante="primario" icono="mas" onClick={() => setActivando(true)}>Activar módulo</Boton>
      </section>

      <Tabs.Root value={pestana} onValueChange={(v) => setParams(v === 'resumen' ? {} : { pestana: v }, { replace: true })} className="flex flex-col gap-4">
        <Tabs.List aria-label="Secciones de la empresa" className="flex gap-1 overflow-x-auto border-b border-borde">
          <Tabs.Trigger value="resumen" className={DISPARADOR}>Resumen</Tabs.Trigger>
          <Tabs.Trigger value="modulos" className={DISPARADOR}>Módulos <Contador n={e.modulos.length} /></Tabs.Trigger>
          <Tabs.Trigger value="historial" className={DISPARADOR}>Historial <Contador n={e.historial.length} /></Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="resumen" className={PANEL}>
          <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
            <div className="flex flex-col gap-5">
              <section aria-labelledby="titulo-resumen-modulos" className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta md:p-5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h2 id="titulo-resumen-modulos" className="font-titulo text-base font-semibold">Módulos contratados</h2>
                  <button type="button" onClick={() => setParams({ pestana: 'modulos' }, { replace: true })} className="cursor-pointer text-sm font-medium text-accion underline-offset-2 hover:underline">Ver contratos</button>
                </div>
                {e.modulos.length === 0 ? (
                  <EstadoVacio titulo="Sin módulos" descripcion="Activa el primer módulo de esta empresa." icono="caja" accion={<Boton variante="primario" icono="mas" onClick={() => setActivando(true)}>Activar módulo</Boton>} />
                ) : (
                  <ul className="m-0 flex list-none flex-col divide-y divide-borde p-0">
                    {e.modulos.map((m) => <FilaDeModulo key={m.modulo} m={m} ahora={ahora} />)}
                  </ul>
                )}
              </section>
              {e.historial.length > 0 ? (
                <section aria-labelledby="titulo-reciente" className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta md:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 id="titulo-reciente" className="font-titulo text-base font-semibold">Últimos cambios</h2>
                    <button type="button" onClick={() => setParams({ pestana: 'historial' }, { replace: true })} className="cursor-pointer text-sm font-medium text-accion underline-offset-2 hover:underline">Ver historial</button>
                  </div>
                  <LineaDeTiempo eventos={e.historial.slice(0, 3)} />
                </section>
              ) : null}
            </div>
            <aside aria-label="Datos clave" className="flex flex-col gap-4 lg:sticky lg:top-4">
              <section className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
                <h2 className="mb-1 font-titulo text-base font-semibold">Datos clave</h2>
                <dl className="m-0 divide-y divide-borde">
                  <Dato etiqueta="Estado">{estadoGeneral.texto}</Dato>
                  <Dato etiqueta="Módulos">{[activos > 0 ? `${activos} ${activos === 1 ? 'activo' : 'activos'}` : '', enPrueba > 0 ? `${enPrueba} en prueba` : ''].filter(Boolean).join(' · ') || '—'}</Dato>
                  <Dato etiqueta="Usuarios">{e.miembros}</Dato>
                  <Dato etiqueta="Alta">{formatearFecha(e.altaEn)}</Dato>
                  <Dato etiqueta="Actividad">{e.ultimaActividadEn ? formatearFecha(e.ultimaActividadEn) : 'Sin actividad'}</Dato>
                </dl>
              </section>
              <section className={unir('flex items-start gap-3 rounded-tarjeta border p-4', vence && vence.dias <= 7 ? 'border-aviso/40 bg-aviso/10' : 'border-borde bg-superficie shadow-tarjeta')}>
                <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-texto-suave" strokeWidth={1.75} />
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-semibold text-texto">Próximo vencimiento</h2>
                  {vence ? (
                    <p className="text-sm text-texto-suave">
                      <span className={unir('font-medium', vence.dias < 0 ? 'text-peligro' : vence.dias <= 7 ? 'text-aviso' : 'text-texto')}>{textoDeVencimiento(vence.dias)}</span>
                      {' · '}{vence.tipo === 'prueba' ? 'prueba' : 'vigencia'} de {nombreDeModulo(vence.modulo)}
                    </p>
                  ) : (
                    <p className="text-sm text-texto-suave">Nada vence pronto: no hay pruebas ni vigencias con fecha.</p>
                  )}
                </div>
              </section>
              <p className="flex items-start gap-2 px-1 text-xs text-texto-suave">
                <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                Aquí solo se ven contratos y cifras de uso: nunca los datos de negocio de la empresa.
              </p>
            </aside>
          </div>
        </Tabs.Content>

        <Tabs.Content value="modulos" className={PANEL}>
          {e.modulos.length === 0 ? (
            <EstadoVacio titulo="Sin módulos" descripcion="Activa el primer módulo de esta empresa." icono="caja" accion={<Boton variante="primario" icono="mas" onClick={() => setActivando(true)}>Activar módulo</Boton>} />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {e.modulos.map((m) => (
                <TarjetaDeModulo key={m.modulo} m={m} ahora={ahora} alContrato={() => setContrato(m)} alAccionar={(a) => void accionar(m, a)} />
              ))}
            </ul>
          )}
        </Tabs.Content>

        <Tabs.Content value="historial" className={PANEL}>
          {e.historial.length === 0 ? (
            <EstadoVacio titulo="Sin historial" descripcion="Los cambios de contrato aparecen aquí." icono="carpeta" />
          ) : (
            <div className="flex flex-col gap-4">
              {modulosDelHistorial.length > 1 ? (
                <div role="group" aria-label="Filtrar por módulo" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {['todos', ...modulosDelHistorial].map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={filtroHistorial === c}
                      onClick={() => setFiltroHistorial(c)}
                      className={unir('inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors', filtroHistorial === c ? 'border-texto bg-texto text-texto-inverso' : 'border-borde bg-superficie text-texto-suave hover:border-borde-fuerte hover:text-texto')}
                    >
                      {c === 'todos' ? 'Todos' : nombreDeModulo(c)}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta md:p-5">
                <LineaDeTiempo eventos={historial} />
              </div>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>

      <HojaContrato empresa={e.id} modulo={contrato} alCerrar={() => setContrato(null)} alCambiar={recargar} />
      <HojaActivar abierto={activando} empresa={e.id} conocidos={conocidos} alCerrar={() => setActivando(false)} alCambiar={recargar} />
    </div>
  );
}
