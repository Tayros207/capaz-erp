import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router';
import type { ModuloDeEmpresaDto } from '@capaz/shared';
import { formatearFecha } from '../shared/formato/fechas.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { notificar } from '../shared/ui/notificar.ts';
import { darDeBajaModulo, datosOError, listarPlanes, reactivarModulo, suspenderModulo, verEmpresa } from './api.ts';
import { HojaActivar } from './hoja-activar.tsx';
import { HojaContrato } from './hoja-contrato.tsx';
import { ESTADO_DE_EMPRESA, estadoDeEmpresa, mensajeDeRechazo, type AccionDeModulo } from './logica.ts';
import { AvatarDeEmpresa } from './avatar-de-empresa.tsx';
import { CodigoDeModulo } from './chip-modulo.tsx';
import { LineaDeTiempo } from './linea-de-tiempo.tsx';
import { TarjetaDeModulo } from './tarjeta-de-modulo.tsx';
import { CLAVE_EMPRESAS, CLAVE_PLANES } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

export function PantallaEmpresa() {
  const { id = '' } = useParams();
  const cliente = useQueryClient();
  const [contrato, setContrato] = useState<ModuloDeEmpresaDto | null>(null);
  const [activando, setActivando] = useState(false);
  const [ahora] = useState(() => new Date());
  const consulta = useQuery({ queryKey: [...CLAVE_EMPRESAS, 'ficha', id], queryFn: async () => datosOError(await verEmpresa(id)) });
  const planes = useQuery({ queryKey: CLAVE_PLANES, queryFn: async () => datosOError(await listarPlanes()).items });
  const recargar = () => void cliente.invalidateQueries({ queryKey: CLAVE_EMPRESAS });
  const migas = [{ texto: 'Plataforma' }, { texto: 'Empresas', a: '/plataforma' }, { texto: consulta.data?.nombre ?? 'Ficha' }];

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Empresa" migas={migas} />
        <ErrorDeConsulta error={consulta.error} />
      </div>
    );
  }
  const e = consulta.data;
  const conocidos = [...new Set([...e.modulos.map((m) => m.modulo), ...(planes.data?.flatMap((p) => p.modulos) ?? [])])].sort();

  async function accionar(m: ModuloDeEmpresaDto, a: AccionDeModulo) {
    const args = { empresa: e.id, modulo: m.modulo };
    const r = a === 'suspender' ? await suspenderModulo(args) : a === 'dar_de_baja' ? await darDeBajaModulo(args) : await reactivarModulo(args);
    if ('cancelada' in r) return;
    if (r.ok) {
      notificar('Listo.', 'exito');
      recargar();
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  const estadoGeneral = ESTADO_DE_EMPRESA[estadoDeEmpresa(e)];

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoDePagina
        titulo="Empresa"
        migas={migas}
        accionPrincipal={<Boton variante="primario" icono="mas" onClick={() => setActivando(true)}>Activar módulo</Boton>}
      />
      <section aria-label="Resumen de la empresa" className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta md:flex-row md:items-center md:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <AvatarDeEmpresa nombre={e.nombre} tamano="grande" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-titulo text-xl font-semibold text-texto">{e.nombre}</h2>
              <Insignia tono={estadoGeneral.tono}>{estadoGeneral.texto}</Insignia>
            </div>
            <CodigoDeModulo codigo={e.id} className="self-start" />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 md:gap-8">
          <div><dt className="text-[0.6875rem] font-medium tracking-wide text-texto-suave uppercase">Alta</dt><dd className="font-medium tabular-nums">{formatearFecha(e.altaEn)}</dd></div>
          <div><dt className="text-[0.6875rem] font-medium tracking-wide text-texto-suave uppercase">Usuarios</dt><dd className="font-medium tabular-nums">{e.miembros}</dd></div>
          <div><dt className="text-[0.6875rem] font-medium tracking-wide text-texto-suave uppercase">Actividad</dt><dd className="font-medium tabular-nums">{e.ultimaActividadEn ? formatearFecha(e.ultimaActividadEn) : 'Sin actividad'}</dd></div>
        </dl>
      </section>
      <p className="flex items-center gap-2 text-sm text-texto-suave">
        <ShieldCheck aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        Aquí solo se ven contratos y cifras de uso: nunca los datos de negocio de la empresa.
      </p>
      <section className="flex flex-col gap-3" aria-labelledby="titulo-modulos">
        <h2 id="titulo-modulos" className="font-titulo text-lg font-semibold">Módulos y contratos <span className="ml-1 text-sm font-normal text-texto-suave tabular-nums">{e.modulos.length}</span></h2>
        {e.modulos.length === 0 ? (
          <EstadoVacio titulo="Sin módulos" descripcion="Activa el primer módulo de esta empresa." icono="caja" accion={<Boton variante="primario" icono="mas" onClick={() => setActivando(true)}>Activar módulo</Boton>} />
        ) : (
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {e.modulos.map((m) => (
              <TarjetaDeModulo key={m.modulo} m={m} ahora={ahora} alContrato={() => setContrato(m)} alAccionar={(a) => void accionar(m, a)} />
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="titulo-historial">
        <h2 id="titulo-historial" className="font-titulo text-lg font-semibold">Historial de contratos</h2>
        {e.historial.length === 0 ? (
          <EstadoVacio titulo="Sin historial" descripcion="Los cambios de contrato aparecen aquí." icono="carpeta" />
        ) : (
          <div className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta md:p-5">
            <LineaDeTiempo eventos={e.historial} />
          </div>
        )}
      </section>
      <HojaContrato empresa={e.id} modulo={contrato} alCerrar={() => setContrato(null)} alCambiar={recargar} />
      <HojaActivar abierto={activando} empresa={e.id} conocidos={conocidos} alCerrar={() => setActivando(false)} alCambiar={recargar} />
    </div>
  );
}
