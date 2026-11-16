import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { EtapaDto, OportunidadConActividades } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { BarraDeEstado } from '../../shared/ui/datos/barra-de-estado.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Ficha } from '../../shared/ui/datos/ficha.tsx';
import { MenuDeAcciones } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { useFicha } from '../../shared/ui/datos/use-ficha.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { CLAVE_CRM, editarOportunidad, ganarOportunidad, moverOportunidad, reabrirOportunidad, verOportunidad } from './api.ts';
import { useEscribir } from './acciones.ts';
import { useEtapas } from './consultas.ts';
import { FormularioOportunidad, LecturaOportunidad } from './datos-oportunidad.tsx';
import { FilaActividad } from './fila-actividad.tsx';
import { HojaNuevaActividad } from './hoja-nueva-actividad.tsx';
import { HojaPerdida } from './hoja-perdida.tsx';
import {
  argumentosDeEdicion,
  destinosDeMovimiento,
  ETIQUETA_DE_ESTADO,
  formularioDesde,
  pasosDeOportunidad,
  TONO_DE_ESTADO,
  validarOportunidad,
  type ErroresDeOportunidad,
} from './logica.ts';
import { usePermisosCrm } from './permisos.ts';

type PropsDeAcciones = { o: OportunidadConActividades; etapas: readonly EtapaDto[]; editar: boolean; alPerder: () => void };

/** Estado y, para quien puede escribir: mover, ganar y perder (abierta) o reabrir (cerrada). */
function Acciones({ o, etapas, editar, alPerder }: PropsDeAcciones) {
  const escribir = useEscribir();
  const estado = <Insignia tono={TONO_DE_ESTADO[o.estado]}>{ETIQUETA_DE_ESTADO[o.estado]}</Insignia>;
  if (!editar) return estado;
  if (o.estado !== 'abierta') return <>{estado}<Boton onClick={() => void escribir(reabrirOportunidad(o.id), 'Oportunidad reabierta.')}>Reabrir</Boton></>;
  const destinos = destinosDeMovimiento(etapas, o).map((e) => ({ etiqueta: e.nombre, onSeleccionar: () => void escribir(moverOportunidad(o.id, e.id), `Movida a «${e.nombre}».`) }));
  return (
    <>
      {estado}
      {destinos.length ? <MenuDeAcciones etiqueta="Mover a…" acciones={destinos} /> : null}
      <Boton variante="primario" onClick={() => void escribir(ganarOportunidad(o.id), '¡Oportunidad ganada!')}>Ganada</Boton>
      <Boton variante="peligro" onClick={alPerder}>Perdida</Boton>
    </>
  );
}

function SeccionActividades({ o, editar }: { o: OportunidadConActividades; editar: boolean }) {
  const [nuevaActividad, setNuevaActividad] = useState(false);
  return (
    <>
      <section aria-labelledby="actividades-titulo" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="actividades-titulo" className="font-titulo text-base font-semibold text-texto">Actividades</h2>
          {editar ? <Boton icono="mas" onClick={() => setNuevaActividad(true)}>Nueva actividad</Boton> : null}
        </div>
        {o.actividades.length === 0 ? (
          <p className="text-sm text-texto-suave">Todavía no hay actividades.</p>
        ) : (
          <ul aria-label="Actividades de la oportunidad" className="flex flex-col divide-y divide-borde">
            {o.actividades.map((a) => <FilaActividad key={a.id} a={a} editar={editar} />)}
          </ul>
        )}
      </section>
      <HojaNuevaActividad oportunidadId={o.id} abierto={nuevaActividad} alCerrar={() => setNuevaActividad(false)} />
    </>
  );
}

function Contenido({ o, etapas }: { o: OportunidadConActividades; etapas: readonly EtapaDto[] }) {
  const { editar } = usePermisosCrm();
  const escribir = useEscribir();
  const { estado, enviar } = useFicha();
  const [form, setForm] = useState(() => formularioDesde(o));
  const [errores, setErrores] = useState<ErroresDeOportunidad>({});
  const [perdiendo, setPerdiendo] = useState(false);
  const { pasos, actual } = pasosDeOportunidad(etapas, o);

  async function guardar() {
    const e = validarOportunidad(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const args = argumentosDeEdicion(o, form);
    if (!args) return enviar('descartar');
    enviar('guardar');
    enviar((await escribir(editarOportunidad(args), 'Oportunidad actualizada.')) ? 'guardado' : 'fallo');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={o.titulo}
        migas={[{ texto: 'CRM', a: '/m/crm' }, { texto: o.codigo }]}
        accionesSecundarias={<Acciones o={o} etapas={etapas} editar={editar} alPerder={() => setPerdiendo(true)} />}
      />
      <BarraDeEstado etiqueta="Etapa de la oportunidad" pasos={pasos} actual={actual} />
      <Ficha
        estado={estado}
        soloLectura={!editar}
        onEditar={() => { setForm(formularioDesde(o)); enviar('editar'); }}
        onGuardar={() => void guardar()}
        onDescartar={() => { enviar('descartar'); setErrores({}); }}
        secciones={[
          {
            id: 'datos',
            titulo: 'Datos de la oportunidad',
            lectura: <LecturaOportunidad o={o} />,
            edicion: <FormularioOportunidad valor={form} errores={errores} alCambiar={(c) => { setForm((f) => ({ ...f, ...c })); enviar('cambio'); }} />,
          },
        ]}
      />
      <SeccionActividades o={o} editar={editar} />
      <HojaPerdida oportunidad={perdiendo ? o : null} alCerrar={() => setPerdiendo(false)} />
    </div>
  );
}

/** Ficha de una oportunidad: etapa, datos editables, actividades y cierre. */
export function PantallaFichaOportunidad() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_CRM, 'ficha', id], queryFn: async () => datosOError(await verOportunidad(id)) });
  const etapas = useEtapas();
  if (consulta.isPending || etapas.isPending) {
    return <div aria-busy="true" aria-label="Cargando la oportunidad" className="flex flex-col gap-2"><Esqueleto className="h-8 w-1/2" /><Esqueleto className="h-40" /></div>;
  }
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta oportunidad" descripcion={consulta.error.message} icono="carpeta" />;
  // `key` reinicia la edición cuando los datos cambian en el servidor.
  return <Contenido key={`${consulta.data.id}-${consulta.data.actualizadoEn}`} o={consulta.data} etapas={etapas.data ?? []} />;
}
