import { type EstadoDeAsistencia } from '@capaz/shared';
import { formatearHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { ESTADOS, ETIQUETA_DE_ESTADO, puedeMarcarSalida, TONO_DE_ESTADO, type FilaDelDia, type ModoDelDia } from './logica.ts';

type Props = {
  fila: FilaDelDia;
  modo: ModoDelDia;
  /** Si la persona puede marcar o corregir (acceso de escritura y permiso). */
  puedeEditar: boolean;
  ocupado: boolean;
  alElegir: (estado: EstadoDeAsistencia) => void;
  alMarcarSalida: () => void;
};

function Horas({ fila }: { fila: FilaDelDia }) {
  const a = fila.asistencia;
  if (!a?.entrada) return null;
  return <span className="text-sm text-texto-suave tabular-nums">{`Entrada ${formatearHora(a.entrada)}${a.salida ? ` · Salida ${formatearHora(a.salida)}` : ''}`}</span>;
}

/** Una persona del parte del día: su estado y, si puede marcar, los cinco botones grandes. */
export function FilaDeAsistencia({ fila, modo, puedeEditar, ocupado, alElegir, alMarcarSalida }: Props) {
  const actual = fila.asistencia?.estado ?? null;
  const botones = puedeEditar && modo !== 'futuro';
  return (
    <li className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-titulo font-semibold text-texto">{fila.colaborador.nombre}</span>
          {fila.colaborador.cargo ? <span className="text-sm text-texto-suave">{fila.colaborador.cargo}</span> : null}
        </div>
        {actual ? <Insignia tono={TONO_DE_ESTADO[actual]}>{ETIQUETA_DE_ESTADO[actual]}</Insignia> : <Insignia>Sin marcar</Insignia>}
      </div>
      <Horas fila={fila} />
      {fila.asistencia?.nota ? <p className="break-words text-sm text-texto-suave">{fila.asistencia.nota}</p> : null}
      {botones ? (
        <div role="group" aria-label={`Asistencia de ${fila.colaborador.nombre}`} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ESTADOS.map((estado) => (
            <Boton
              key={estado}
              tamano="grande"
              variante={actual === estado ? 'primario' : 'secundario'}
              aria-pressed={actual === estado}
              disabled={ocupado}
              className={unir('min-h-12 px-2', estado === 'descanso' && 'col-span-2 sm:col-span-1')}
              onClick={() => alElegir(estado)}
            >
              {ETIQUETA_DE_ESTADO[estado]}
            </Boton>
          ))}
        </div>
      ) : null}
      {botones && modo === 'hoy' && puedeMarcarSalida(fila.asistencia) ? (
        <Boton disabled={ocupado} className="self-start" onClick={alMarcarSalida}>Marcar salida</Boton>
      ) : null}
    </li>
  );
}
