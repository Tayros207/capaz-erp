import { Link } from 'react-router';
import type { ActividadDto } from '@capaz/shared';
import { formatearFecha } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { completarActividad } from './api.ts';
import { useEscribir } from './acciones.ts';
import { ETIQUETA_DE_ACTIVIDAD } from './logica.ts';

/** Una actividad con su estado y el botón «Hecha». `conOportunidad` muestra a qué oportunidad pertenece. */
export function FilaActividad({ a, editar, conOportunidad = false }: { a: ActividadDto; editar: boolean; conOportunidad?: boolean }) {
  const escribir = useEscribir();
  const vence = a.venceEl ? `Vence el ${formatearFecha(`${a.venceEl}T12:00:00Z`)}` : 'Sin vencimiento';
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words font-medium text-texto">{ETIQUETA_DE_ACTIVIDAD[a.tipo]}: {a.asunto}</span>
        {conOportunidad ? <Link to={`/m/crm/oportunidades/${a.oportunidadId}`} className="text-sm text-texto-suave hover:underline">{a.oportunidadCodigo} · {a.oportunidadTitulo}</Link> : null}
        {a.nota ? <span className="break-words text-sm text-texto-suave">{a.nota}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {a.hechaEn ? <Insignia tono="exito">Hecha</Insignia> : a.vencida ? <Insignia tono="peligro">Vencida</Insignia> : <Insignia tono="neutro">{vence}</Insignia>}
        {editar && !a.hechaEn ? <Boton onClick={() => void escribir(completarActividad(a.id), 'Actividad hecha.')}>Hecha</Boton> : null}
      </div>
    </li>
  );
}
