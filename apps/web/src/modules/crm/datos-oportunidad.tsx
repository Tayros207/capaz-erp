import type { OportunidadDto } from '@capaz/shared';
import { formatearFecha, formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { ETIQUETA_DE_ESTADO, textoDeMonto, type ErroresDeOportunidad, type FormularioDeOportunidad } from './logica.ts';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

/** Datos de la oportunidad en modo lectura. */
export function LecturaOportunidad({ o }: { o: OportunidadDto }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Dato etiqueta="Cliente" valor={o.clienteNombre} />
      <Dato etiqueta="Estado" valor={`${ETIQUETA_DE_ESTADO[o.estado]} · ${o.etapaNombre}`} />
      <Dato etiqueta="Monto estimado" valor={textoDeMonto(o.montoEstimadoCentimos)} />
      <Dato etiqueta="Cierre esperado" valor={o.fechaEsperada ? formatearFecha(`${o.fechaEsperada}T12:00:00Z`) : ''} />
      {o.motivoPerdida ? <Dato etiqueta="Motivo de pérdida" valor={o.motivoPerdida} /> : null}
      <Dato etiqueta="Notas" valor={o.notas ?? ''} />
      <Dato etiqueta="Último movimiento" valor={formatearFechaHora(o.ultimaActividadEn)} />
    </dl>
  );
}

type Props = { valor: FormularioDeOportunidad; errores: ErroresDeOportunidad; alCambiar: (c: Partial<FormularioDeOportunidad>) => void };

/** Campos editables de la oportunidad. */
export function FormularioOportunidad({ valor, errores, alCambiar }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Título" value={valor.titulo} onChange={(e) => alCambiar({ titulo: e.target.value })} error={errores.titulo} maxLength={160} />
      <CampoMonto etiqueta="Monto estimado" valor={valor.montoEstimadoCentimos} alCambiar={(v) => alCambiar({ montoEstimadoCentimos: v })} error={errores.montoEstimadoCentimos} />
      <Campo etiqueta="Cierre esperado" type="date" value={valor.fechaEsperada} onChange={(e) => alCambiar({ fechaEsperada: e.target.value })} />
      <CampoTextarea etiqueta="Notas" value={valor.notas} onChange={(e) => alCambiar({ notas: e.target.value })} error={errores.notas} filas={3} />
    </div>
  );
}
