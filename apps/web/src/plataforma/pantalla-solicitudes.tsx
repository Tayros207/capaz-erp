import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatearFechaHora } from '../shared/formato/fechas.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../shared/ui/datos/lista.tsx';
import type { Columna } from '../shared/ui/datos/lista-tipos.ts';
import { CampoSelect } from '../shared/ui/campo-select.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { notificar } from '../shared/ui/notificar.ts';
import { atenderSolicitud, datosOError, listarSolicitudes, type EntradaDePlataforma, type SalidaDePlataforma } from './api.ts';
import { mensajeDeRechazo } from './logica.ts';
import { CLAVE_SOLICITUDES } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

type Solicitud = SalidaDePlataforma<'plataforma_solicitudes_listar'>['items'][number];
type Filtro = EntradaDePlataforma<'plataforma_solicitudes_listar'>['estado'];

const TONO = { pendiente: 'aviso', atendida: 'exito', descartada: 'neutro' } as const;

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

  const columnas: Array<Columna<Solicitud>> = [
    { id: 'empresa', titulo: 'Empresa', principal: true, celda: (s) => <Link className="underline" to={`/plataforma/empresas/${encodeURIComponent(s.empresa)}`}>{s.empresaNombre ?? s.empresa}</Link> },
    { id: 'modulo', titulo: 'Módulo pedido', celda: (s) => s.modulo },
    { id: 'nota', titulo: 'Nota', celda: (s) => s.nota ?? '—' },
    { id: 'cuando', titulo: 'Pedida', celda: (s) => formatearFechaHora(s.creadoEn) },
    { id: 'estado', titulo: 'Estado', celda: (s) => <Insignia tono={TONO[s.estado]}>{s.estado[0]!.toUpperCase() + s.estado.slice(1)}</Insignia> },
    { id: 'acciones', titulo: 'Acciones', celda: (s) => (s.estado === 'pendiente' ? (
      <span className="inline-flex flex-wrap gap-2">
        <Boton variante="primario" onClick={() => void resolver(s, 'atendida')}>Atender</Boton>
        <Boton onClick={() => void resolver(s, 'descartada')}>Descartar</Boton>
      </span>
    ) : null) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Solicitudes de módulos" migas={[{ texto: 'Plataforma' }, { texto: 'Solicitudes' }]} />
      <p className="text-sm text-texto-suave">Marcar una solicitud como atendida no activa el módulo: actívalo desde la ficha de la empresa.</p>
      <div className="max-w-xs">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as Filtro)}>
          <option value="pendiente">Pendientes</option>
          <option value="atendida">Atendidas</option>
          <option value="descartada">Descartadas</option>
          <option value="todas">Todas</option>
        </CampoSelect>
      </div>
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <ErrorDeConsulta error={consulta.error} />
      ) : (
        <Lista
          etiqueta="Solicitudes de módulos"
          columnas={columnas}
          filas={consulta.data}
          clave={(s) => s.id}
          vacio={<EstadoVacio titulo="Sin solicitudes" descripcion="Cuando una empresa pida un módulo, aparecerá aquí." icono="carpeta" />}
        />
      )}
    </div>
  );
}
