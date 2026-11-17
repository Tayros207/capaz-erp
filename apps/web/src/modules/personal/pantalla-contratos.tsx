import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { TIPOS_DE_CONTRATO, formatearSoles, type ContratoDeTrabajoDto, type TipoDeContrato } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
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
import { refrescarPersonal } from './acciones.ts';
import { colaboradoresActivos, crearContrato, listarContratos, POR_PAGINA_DE_CONTRATOS, terminarContrato } from './api-contratos.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { HojaDeDecision } from './hoja-decision.tsx';
import { ETIQUETA_DE_TIPO_DE_CONTRATO, FILTROS_DE_CONTRATOS, textoDeVigencia, validarContrato, type ErroresDeContrato, type FormularioDeContrato } from './logica-contratos.ts';
import { mensajeDeRechazo } from './logica.ts';

type Filtro = keyof typeof FILTROS_DE_CONTRATOS;

function FormularioDeNuevoContrato({ alCerrar }: { alCerrar: () => void }) {
  const colaboradores = useQuery({ queryKey: [...CLAVE_PERSONAL, 'colaboradores-activos'], queryFn: async () => datosOError(await colaboradoresActivos()).items });
  const [form, setForm] = useState<FormularioDeContrato>({ colaboradorId: '', tipo: 'indeterminado', inicio: '', fin: '', remuneracion: null, jornada: '48' });
  const [errores, setErrores] = useState<ErroresDeContrato>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeContrato>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarContrato(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = await crearContrato({ colaboradorId: form.colaboradorId, tipo: form.tipo, inicio: form.inicio, ...(form.fin && { fin: form.fin }), remuneracionMensualCentimos: form.remuneracion ?? 0, jornadaHorasSemana: Number(form.jornada) });
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar('Contrato registrado.', 'exito');
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
      <CampoSelect etiqueta="Tipo de contrato" value={form.tipo} onChange={(e) => cambiar({ tipo: e.target.value as TipoDeContrato })}>
        {TIPOS_DE_CONTRATO.map((t) => <option key={t} value={t}>{ETIQUETA_DE_TIPO_DE_CONTRATO[t]}</option>)}
      </CampoSelect>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Inicio" type="date" value={form.inicio} error={errores.inicio} onChange={(e) => cambiar({ inicio: e.target.value })} />
        <Campo etiqueta="Fin" type="date" value={form.fin} error={errores.fin} ayuda="Obligatorio en plazo fijo y prácticas." onChange={(e) => cambiar({ fin: e.target.value })} />
        <CampoMonto etiqueta="Remuneración mensual" valor={form.remuneracion} error={errores.remuneracion} alCambiar={(remuneracion) => cambiar({ remuneracion })} />
        <Campo etiqueta="Horas por semana" inputMode="numeric" value={form.jornada} error={errores.jornada} onChange={(e) => cambiar({ jornada: e.target.value })} />
      </div>
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Registrar contrato</Boton>
      </div>
    </form>
  );
}

/** Contratos de trabajo: uno vigente por colaborador; al terminarlo queda en el historial. La remuneración solo la ve quien tiene el permiso. */
export function PantallaContratos() {
  const yo = useYo();
  const gestiona = !!yo && puedeEscribirEn(yo, 'personal') && puede(yo, 'personal:contratos');
  const [filtro, setFiltro] = useState<Filtro>('vigentes');
  const [hoja, setHoja] = useState(false);
  const [aTerminar, setATerminar] = useState<ContratoDeTrabajoDto | null>(null);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_PERSONAL, 'contratos', filtro],
    queryFn: async ({ pageParam }) => datosOError(await listarContratos({ estado: filtro, limite: POR_PAGINA_DE_CONTRATOS, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const columnas: Array<Columna<ContratoDeTrabajoDto>> = [
    { id: 'quien', titulo: 'Colaborador', principal: true, celda: (c) => c.colaboradorNombre },
    { id: 'tipo', titulo: 'Tipo', celda: (c) => ETIQUETA_DE_TIPO_DE_CONTRATO[c.tipo] },
    { id: 'vigencia', titulo: 'Vigencia', celda: (c) => `Desde el ${c.inicio.split('-').reverse().join('/')}, ${textoDeVigencia(c)}` },
    { id: 'sueldo', titulo: 'Remuneración', alinear: 'derecha', celda: (c) => <span className="tabular-nums">{formatearSoles(c.remuneracionMensualCentimos)}</span> },
    { id: 'estado', titulo: 'Estado', celda: (c) => <Insignia tono={c.estado === 'vigente' ? 'exito' : 'neutro'}>{c.estado === 'vigente' ? 'Vigente' : 'Terminado'}</Insignia> },
    ...(gestiona ? [{ id: 'acciones', titulo: '', alinear: 'derecha' as const, celda: (c: ContratoDeTrabajoDto) => (c.estado === 'vigente' ? <Boton variante="fantasma" onClick={() => setATerminar(c)}>Terminar</Boton> : null) }] : []),
  ];
  const nuevo = gestiona ? <Boton variante="primario" icono="mas" onClick={() => setHoja(true)}>Nuevo contrato</Boton> : undefined;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Contratos" accionPrincipal={nuevo} />
      <div className="sm:max-w-xs">
        <CampoSelect etiqueta="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          {Object.entries(FILTROS_DE_CONTRATOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando contratos" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar los contratos" descripcion={lista.error.message} icono="usuario" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista etiqueta="Contratos de trabajo" columnas={columnas} filas={filas} clave={(c) => c.id} vacio={<EstadoVacio titulo="No hay contratos con ese estado" descripcion="Registra el contrato de cada colaborador con su tipo, fechas y remuneración." icono="usuario" accion={nuevo} />} />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaInferior abierto={hoja} alCerrar={() => setHoja(false)} titulo="Nuevo contrato">{hoja ? <FormularioDeNuevoContrato alCerrar={() => setHoja(false)} /> : null}</HojaInferior>
      <HojaDeDecision
        abierto={aTerminar !== null}
        titulo={`Terminar contrato de ${aTerminar?.colaboradorNombre ?? ''}`}
        etiqueta="Motivo del término"
        textoBoton="Terminar contrato"
        peligro
        alCerrar={() => setATerminar(null)}
        alEnviar={async (motivo) => {
          const r = await terminarContrato({ id: aTerminar!.id, motivo });
          if (r.ok && 'datos' in r) {
            notificar('Contrato terminado.', 'exito');
            await refrescarPersonal();
            return true;
          }
          if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
          return false;
        }}
      />
    </div>
  );
}
