import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Respuesta, VacacionesDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFecha } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { refrescarPersonal, usePermisosDePersonal } from './acciones.ts';
import { anularVacaciones, colaboradoresActivos, listarVacaciones, resolverVacaciones, solicitarVacaciones, verSaldoDeVacaciones, POR_PAGINA_DE_CONTRATOS } from './api-contratos.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { HojaDeDecision } from './hoja-decision.tsx';
import { accionesDeVacaciones, ETIQUETA_DE_VACACIONES, FILTROS_DE_VACACIONES, TONO_DE_VACACIONES, validarVacaciones, type ErroresDeVacaciones, type FormularioDeVacaciones } from './logica-contratos.ts';
import { mensajeDeRechazo } from './logica.ts';

type Filtro = keyof typeof FILTROS_DE_VACACIONES;

async function aplicar(llamada: Promise<Respuesta<unknown>>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarPersonal();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

function SaldoDe({ colaboradorId }: { colaboradorId: string }) {
  const saldo = useQuery({ queryKey: [...CLAVE_PERSONAL, 'saldo-vacaciones', colaboradorId], queryFn: async () => datosOError(await verSaldoDeVacaciones(colaboradorId)), enabled: !!colaboradorId });
  if (!colaboradorId || saldo.isPending || saldo.isError) return null;
  const s = saldo.data;
  return (
    <GrupoDeCifras etiqueta="Saldo de vacaciones">
      <Cifra etiqueta="Devengados" valor={`${s.devengadosDias} días`} ayuda="30 al año, 2,5 por mes" />
      <Cifra etiqueta="Ya aprobados" valor={`${s.gozadosDias} días`} />
      <Cifra etiqueta="Saldo" valor={`${s.saldoDias} días`} tono={s.saldoDias < 0 ? 'peligro' : 'exito'} />
    </GrupoDeCifras>
  );
}

function FormularioDeSolicitud({ alCerrar }: { alCerrar: () => void }) {
  const colaboradores = useQuery({ queryKey: [...CLAVE_PERSONAL, 'colaboradores-activos'], queryFn: async () => datosOError(await colaboradoresActivos()).items });
  const [form, setForm] = useState<FormularioDeVacaciones>({ colaboradorId: '', desde: '', hasta: '', motivo: '' });
  const [errores, setErrores] = useState<ErroresDeVacaciones>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeVacaciones>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarVacaciones(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = await solicitarVacaciones({ colaboradorId: form.colaboradorId, desde: form.desde, hasta: form.hasta, ...(form.motivo.trim() && { motivo: form.motivo.trim() }) });
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar(`Solicitud registrada: ${r.datos.dias} días, pendiente de aprobar.`, 'exito');
      await refrescarPersonal();
      alCerrar();
    } else if ('error' in r) setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <CampoSelect etiqueta="Colaborador" value={form.colaboradorId} error={errores.colaboradorId} onChange={(e) => cambiar({ colaboradorId: e.target.value })}>
        <option value="">Elige al colaborador</option>
        {(colaboradores.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </CampoSelect>
      <SaldoDe colaboradorId={form.colaboradorId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Desde" type="date" value={form.desde} error={errores.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
        <Campo etiqueta="Hasta (incluido)" type="date" value={form.hasta} error={errores.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
      </div>
      <Campo etiqueta="Nota (opcional)" maxLength={300} value={form.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} />
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Solicitar vacaciones</Boton>
      </div>
    </form>
  );
}

type Decision = { tipo: 'rechazar' | 'anular'; v: VacacionesDto } | null;

/** Solicitudes de vacaciones: se piden, se aprueban o rechazan y las aprobadas descuentan del saldo del colaborador. */
export function PantallaVacaciones() {
  const yo = useYo();
  const { editar } = usePermisosDePersonal();
  const aprobar = !!yo && puedeEscribirEn(yo, 'personal') && puede(yo, 'personal:aprobar');
  const [filtro, setFiltro] = useState<Filtro>('abiertas');
  const [hoja, setHoja] = useState(false);
  const [decision, setDecision] = useState<Decision>(null);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PERSONAL, 'vacaciones', filtro],
    queryFn: async ({ pageParam }) => datosOError(await listarVacaciones({ estado: filtro, limite: POR_PAGINA_DE_CONTRATOS, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const columnas: Array<Columna<VacacionesDto>> = [
    { id: 'quien', titulo: 'Colaborador', principal: true, celda: (v) => v.colaboradorNombre },
    { id: 'fechas', titulo: 'Fechas', celda: (v) => `${formatearFecha(`${v.desde}T12:00:00Z`)} al ${formatearFecha(`${v.hasta}T12:00:00Z`)}` },
    { id: 'dias', titulo: 'Días', alinear: 'derecha', celda: (v) => String(v.dias) },
    { id: 'estado', titulo: 'Estado', celda: (v) => <Insignia tono={TONO_DE_VACACIONES[v.estado]}>{ETIQUETA_DE_VACACIONES[v.estado]}</Insignia> },
    {
      id: 'acciones',
      titulo: '',
      alinear: 'derecha',
      celda: (v) => {
        const a = accionesDeVacaciones(v.estado);
        return (
          <span className="inline-flex flex-wrap justify-end gap-2">
            {a.resolver && aprobar ? <Boton onClick={() => void aplicar(resolverVacaciones({ id: v.id, decision: 'aprobar' }), 'Vacaciones aprobadas.')}>Aprobar</Boton> : null}
            {a.resolver && aprobar ? <Boton variante="fantasma" onClick={() => setDecision({ tipo: 'rechazar', v })}>Rechazar</Boton> : null}
            {a.anular && editar ? <Boton variante="fantasma" onClick={() => setDecision({ tipo: 'anular', v })}>Anular</Boton> : null}
          </span>
        );
      },
    },
  ];
  const nueva = editar ? <Boton variante="primario" icono="mas" onClick={() => setHoja(true)}>Solicitar vacaciones</Boton> : undefined;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Vacaciones" accionPrincipal={nueva} />
      <div className="sm:max-w-xs">
        <CampoSelect etiqueta="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          {Object.entries(FILTROS_DE_VACACIONES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando vacaciones" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las vacaciones" descripcion={lista.error.message} icono="usuario" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista etiqueta="Solicitudes de vacaciones" columnas={columnas} filas={filas} clave={(v) => v.id} vacio={<EstadoVacio titulo="No hay solicitudes con ese estado" descripcion="Las vacaciones que se pidan aparecerán aquí hasta que alguien las apruebe." icono="usuario" accion={nueva} />} />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaInferior abierto={hoja} alCerrar={() => setHoja(false)} titulo="Solicitar vacaciones">{hoja ? <FormularioDeSolicitud alCerrar={() => setHoja(false)} /> : null}</HojaInferior>
      <HojaDeDecision
        abierto={decision !== null}
        titulo={decision?.tipo === 'rechazar' ? 'Rechazar vacaciones' : 'Anular vacaciones'}
        etiqueta={decision?.tipo === 'rechazar' ? 'Motivo del rechazo' : 'Motivo de la anulación'}
        textoBoton={decision?.tipo === 'rechazar' ? 'Rechazar' : 'Anular vacaciones'}
        peligro
        alCerrar={() => setDecision(null)}
        alEnviar={(motivo) => (decision!.tipo === 'rechazar' ? aplicar(resolverVacaciones({ id: decision!.v.id, decision: 'rechazar', motivo }), 'Vacaciones rechazadas.') : aplicar(anularVacaciones({ id: decision!.v.id, motivo }), 'Vacaciones anuladas.'))}
      />
    </div>
  );
}
