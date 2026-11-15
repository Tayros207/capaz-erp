import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { ModuloDeEmpresaDto } from '@capaz/shared';
import { formatearFecha, formatearFechaHora } from '../shared/formato/fechas.ts';
import { formatearSoles } from '../shared/formato/soles.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../shared/ui/datos/lista.tsx';
import type { Columna } from '../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { notificar } from '../shared/ui/notificar.ts';
import { darDeBajaModulo, datosOError, listarPlanes, reactivarModulo, suspenderModulo, verEmpresa, type SalidaDePlataforma } from './api.ts';
import { HojaActivar } from './hoja-activar.tsx';
import { HojaContrato } from './hoja-contrato.tsx';
import { accionesPosibles, ETIQUETA_DE_ACCION, estadoDeModulo, mensajeDeRechazo, type AccionDeModulo } from './logica.ts';
import { CLAVE_EMPRESAS, CLAVE_PLANES } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

type Evento = SalidaDePlataforma<'plataforma_empresas_ver'>['historial'][number];

export function PantallaEmpresa() {
  const { id = '' } = useParams();
  const cliente = useQueryClient();
  const [contrato, setContrato] = useState<ModuloDeEmpresaDto | null>(null);
  const [activando, setActivando] = useState(false);
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

  const columnas: Array<Columna<ModuloDeEmpresaDto>> = [
    { id: 'modulo', titulo: 'Módulo', principal: true, celda: (m) => m.nombre },
    { id: 'estado', titulo: 'Estado', celda: (m) => { const s = estadoDeModulo(m.estado); return <Insignia tono={s.tono}>{s.texto}</Insignia>; } },
    { id: 'prueba', titulo: 'Prueba hasta', celda: (m) => (m.pruebaHasta ? formatearFecha(m.pruebaHasta) : '—') },
    { id: 'baja', titulo: 'Baja', celda: (m) => (m.bajaEn ? formatearFecha(m.bajaEn) : '—') },
    { id: 'plan', titulo: 'Plan', celda: (m) => m.plan ?? '—' },
    { id: 'precio', titulo: 'Precio acordado', alinear: 'derecha', celda: (m) => (m.precioAcordadoCentimos === null ? '—' : formatearSoles(m.precioAcordadoCentimos)) },
    { id: 'vigencia', titulo: 'Vigente hasta', celda: (m) => (m.vigenteHasta ? formatearFecha(m.vigenteHasta) : '—') },
    { id: 'usuarios', titulo: 'Máx. usuarios', alinear: 'derecha', celda: (m) => m.maxUsuarios ?? '—' },
    { id: 'acciones', titulo: 'Acciones', celda: (m) => (
      <span className="inline-flex flex-wrap gap-2">
        <Boton onClick={() => setContrato(m)}>Contrato</Boton>
        {accionesPosibles(m.estado).map((a) => (
          <Boton key={a} variante={a === 'reactivar' ? 'secundario' : 'peligro'} onClick={() => void accionar(m, a)}>{ETIQUETA_DE_ACCION[a]}</Boton>
        ))}
      </span>
    ) },
  ];
  const historial: Array<Columna<Evento>> = [
    { id: 'cuando', titulo: 'Cuándo', principal: true, celda: (v) => formatearFechaHora(v.creadoEn) },
    { id: 'modulo', titulo: 'Módulo', celda: (v) => v.modulo },
    { id: 'evento', titulo: 'Evento', celda: (v) => v.evento },
    { id: 'cambio', titulo: 'Estado', celda: (v) => `${v.estadoAnterior ?? '—'} → ${v.estadoNuevo}` },
    { id: 'motivo', titulo: 'Motivo', celda: (v) => v.motivo ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={e.nombre}
        migas={migas}
        accionPrincipal={<Boton variante="primario" icono="mas" onClick={() => setActivando(true)}>Activar módulo</Boton>}
      />
      <dl className="grid gap-3 rounded-tarjeta border border-borde bg-superficie p-4 sm:grid-cols-3">
        <div><dt className="text-sm text-texto-suave">Alta</dt><dd>{formatearFecha(e.altaEn)}</dd></div>
        <div><dt className="text-sm text-texto-suave">Miembros</dt><dd>{e.miembros}</dd></div>
        <div><dt className="text-sm text-texto-suave">Última actividad</dt><dd>{e.ultimaActividadEn ? formatearFecha(e.ultimaActividadEn) : 'Sin actividad'}</dd></div>
      </dl>
      <p className="text-sm text-texto-suave">Aquí solo se ven contratos y cifras de uso: nunca los datos de negocio de la empresa.</p>
      <section className="flex flex-col gap-2" aria-label="Módulos">
        <h2 className="font-titulo text-lg font-semibold">Módulos y contratos</h2>
        <Lista
          etiqueta="Módulos de la empresa"
          columnas={columnas}
          filas={e.modulos}
          clave={(m) => m.modulo}
          vacio={<EstadoVacio titulo="Sin módulos" descripcion="Activa el primer módulo de esta empresa." icono="caja" />}
        />
      </section>
      <section className="flex flex-col gap-2" aria-label="Historial">
        <h2 className="font-titulo text-lg font-semibold">Historial de contratos</h2>
        <Lista
          etiqueta="Historial de contratos"
          columnas={historial}
          filas={e.historial}
          clave={(v) => `${v.creadoEn}-${v.modulo}-${v.evento}`}
          vacio={<EstadoVacio titulo="Sin historial" descripcion="Los cambios de contrato aparecen aquí." icono="carpeta" />}
        />
      </section>
      <HojaContrato empresa={e.id} modulo={contrato} alCerrar={() => setContrato(null)} alCambiar={recargar} />
      <HojaActivar abierto={activando} empresa={e.id} conocidos={conocidos} alCerrar={() => setActivando(false)} alCambiar={recargar} />
    </div>
  );
}
