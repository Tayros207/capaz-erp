import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatearFechaHora } from '../shared/formato/fechas.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { notificar } from '../shared/ui/notificar.ts';
import { unir } from '../shared/ui/unir.ts';
import { atenderSolicitud, datosOError, listarSolicitudes, type EntradaDePlataforma, type SalidaDePlataforma } from './api.ts';
import { AvatarDeEmpresa } from './avatar-de-empresa.tsx';
import { ChipDeModulo } from './chip-modulo.tsx';
import { mensajeDeRechazo } from './logica.ts';
import { CLAVE_SOLICITUDES } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

type Solicitud = SalidaDePlataforma<'plataforma_solicitudes_listar'>['items'][number];
type Filtro = EntradaDePlataforma<'plataforma_solicitudes_listar'>['estado'];

const TONO = { pendiente: 'aviso', atendida: 'exito', descartada: 'neutro' } as const;
const FILTROS: Array<{ id: Filtro; texto: string }> = [
  { id: 'pendiente', texto: 'Pendientes' },
  { id: 'atendida', texto: 'Atendidas' },
  { id: 'descartada', texto: 'Descartadas' },
  { id: 'todas', texto: 'Todas' },
];

export function PantallaSolicitudes() {
  const cliente = useQueryClient();
  const [estado, setEstado] = useState<Filtro>('pendiente');
  const consulta = useQuery({ queryKey: [...CLAVE_SOLICITUDES, estado], queryFn: async () => datosOError(await listarSolicitudes(estado)).items });

  async function resolver(s: Solicitud, resultado: 'atendida' | 'descartada') {
    const r = await atenderSolicitud({ id: s.id, resultado });
    if ('cancelada' in r) return;
    if (r.ok) {
      notificar(resultado === 'atendida' ? 'Solicitud atendida.' : 'Solicitud descartada.', 'exito');
      void cliente.invalidateQueries({ queryKey: CLAVE_SOLICITUDES });
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Solicitudes de módulos" />
      <p className="text-sm text-texto-suave">Marcar una solicitud como atendida no activa el módulo: actívalo desde la ficha de la empresa.</p>
      <div role="group" aria-label="Filtrar solicitudes" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={estado === f.id}
            onClick={() => setEstado(f.id)}
            className={unir(
              'inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
              estado === f.id ? 'border-texto bg-texto text-texto-inverso shadow-sutil' : 'border-borde bg-superficie text-texto-suave hover:border-borde-fuerte hover:text-texto',
            )}
          >
            {f.texto}
          </button>
        ))}
      </div>
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <ErrorDeConsulta error={consulta.error} />
      ) : consulta.data.length === 0 ? (
        <EstadoVacio titulo="Sin solicitudes" descripcion="Cuando una empresa pida un módulo, aparecerá aquí." icono="carpeta" />
      ) : (
        <ul className="flex list-none flex-col gap-2 p-0" aria-label="Solicitudes de módulos">
          {consulta.data.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <AvatarDeEmpresa nombre={s.empresaNombre ?? s.empresa} />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="truncate font-semibold text-texto underline-offset-2 hover:text-accion hover:underline" to={`/plataforma/empresas/${encodeURIComponent(s.empresa)}`}>{s.empresaNombre ?? s.empresa}</Link>
                    <span className="text-sm text-texto-suave">pide</span>
                    <ChipDeModulo codigo={s.modulo} />
                  </div>
                  <p className="text-sm text-texto-suave">{s.nota ?? 'Sin nota.'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <time dateTime={s.creadoEn} className="text-xs text-texto-suave tabular-nums">{formatearFechaHora(s.creadoEn)}</time>
                <Insignia tono={TONO[s.estado]}>{s.estado[0]!.toUpperCase() + s.estado.slice(1)}</Insignia>
                {s.estado === 'pendiente' ? (
                  <span className="inline-flex gap-2">
                    <Boton variante="primario" onClick={() => void resolver(s, 'atendida')}>Atender</Boton>
                    <Boton onClick={() => void resolver(s, 'descartada')}>Descartar</Boton>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
