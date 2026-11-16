import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatearSoles, type ColaboradorCompletoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { resolverAccion, usePermisosDePersonal } from './acciones.ts';
import { archivarColaborador, restaurarColaborador, verColaborador } from './api.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { HojaDeColaborador } from './hoja-colaborador.tsx';
import { ETIQUETA_DE_ADELANTO, ETIQUETA_DE_ESTADO, formatearDia, TONO_DE_ADELANTO, TONO_DE_ESTADO, totalVigente } from './logica.ts';
import { Cargando } from './marco.tsx';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

function Datos({ c }: { c: ColaboradorCompletoDto }) {
  const documento = c.documentoNumero ? `${c.documentoTipo?.toUpperCase() ?? ''} ${c.documentoNumero}`.trim() : null;
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Dato etiqueta="Cargo" valor={c.cargo} />
      <Dato etiqueta="Documento" valor={documento} />
      <Dato etiqueta="Teléfono" valor={c.telefono} />
      <Dato etiqueta="Fecha de ingreso" valor={c.fechaIngreso ? formatearDia(c.fechaIngreso) : null} />
    </dl>
  );
}

function Asistencias({ c }: { c: ColaboradorCompletoDto }) {
  return (
    <section aria-label="Asistencia reciente" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Asistencia reciente</h2>
      {c.asistencias.length === 0 ? (
        <p className="text-texto-suave">Todavía no tiene asistencias marcadas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
          {c.asistencias.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="font-medium text-texto">{formatearDia(a.fecha)}</span>
              <span className="flex items-center gap-2 text-sm text-texto-suave">
                {a.entrada ? `${formatearHora(a.entrada)}${a.salida ? ` – ${formatearHora(a.salida)}` : ''}` : null}
                <Insignia tono={TONO_DE_ESTADO[a.estado]}>{ETIQUETA_DE_ESTADO[a.estado]}</Insignia>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Adelantos({ c }: { c: ColaboradorCompletoDto }) {
  return (
    <section aria-label="Adelantos" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Adelantos recientes</h2>
      {c.adelantos.length === 0 ? (
        <p className="text-texto-suave">No tiene adelantos.</p>
      ) : (
        <>
          <p className="text-sm text-texto-suave">Vigentes en esta lista: <span className="font-semibold tabular-nums text-texto">{formatearSoles(totalVigente(c.adelantos))}</span></p>
          <ul className="flex flex-col divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
            {c.adelantos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="flex flex-col"><span className="font-medium text-texto">{a.codigo}</span><span className="text-sm text-texto-suave">{formatearDia(a.fecha)}</span></span>
                <span className="flex items-center gap-2">
                  <span className={a.estado === 'anulado' ? 'tabular-nums text-texto-suave line-through' : 'font-medium tabular-nums text-texto'}>{formatearSoles(a.montoCentimos)}</span>
                  <Insignia tono={TONO_DE_ADELANTO[a.estado]}>{ETIQUETA_DE_ADELANTO[a.estado]}</Insignia>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Contenido({ c }: { c: ColaboradorCompletoDto }) {
  const permisos = usePermisosDePersonal();
  const navegar = useNavigate();
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function cambiarArchivo() {
    const archivar = !c.archivado;
    const si = await confirmar(
      archivar ? 'Archivar colaborador' : 'Restaurar colaborador',
      archivar ? 'Dejará de aparecer en el parte del día y no se le podrán registrar adelantos. Su historial se conserva.' : 'Volverá a aparecer en el parte del día.',
      { textoConfirmar: archivar ? 'Archivar' : 'Restaurar', peligroso: archivar },
    );
    if (!si) return;
    setOcupado(true);
    await resolverAccion(archivar ? archivarColaborador(c.id) : restaurarColaborador(c.id), archivar ? 'Colaborador archivado.' : 'Colaborador restaurado.');
    setOcupado(false);
  }

  const acciones: AccionDeMenu[] = permisos.editar
    ? [{ etiqueta: c.archivado ? 'Restaurar' : 'Archivar', peligro: !c.archivado, onSeleccionar: () => void cambiarArchivo() }]
    : [];
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={c.nombre}
        migas={[{ texto: 'Colaboradores', a: '/m/personal' }, { texto: c.nombre }]}
        accionPrincipal={permisos.editar && !c.archivado ? <Boton variante="primario" cargando={ocupado} onClick={() => setEditando(true)}>Editar datos</Boton> : undefined}
        accionesSecundarias={
          <>
            <Insignia tono={c.archivado ? 'neutro' : 'exito'}>{c.archivado ? 'Archivado' : 'Activo'}</Insignia>
            {permisos.adelantos && !c.archivado ? <Boton onClick={() => void navegar(`/m/personal/adelantos/nuevo?colaborador=${c.id}`)}>Registrar adelanto</Boton> : null}
            {acciones.length > 0 ? <MenuDeAcciones etiqueta="Más acciones del colaborador" acciones={acciones} /> : null}
          </>
        }
      />
      <Datos c={c} />
      <Asistencias c={c} />
      <Adelantos c={c} />
      <HojaDeColaborador abierto={editando} colaborador={c} alCerrar={() => setEditando(false)} />
    </div>
  );
}

export function PantallaFichaColaborador() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_PERSONAL, 'ficha', id], queryFn: async () => datosOError(await verColaborador(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando colaborador" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos a este colaborador" descripcion={consulta.error.message} icono="usuario" />;
  return <Contenido key={`${consulta.data.id}-${consulta.data.actualizadoEn}`} c={consulta.data} />;
}
