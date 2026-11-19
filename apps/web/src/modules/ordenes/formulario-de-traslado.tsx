import { MODALIDADES_DE_TRASLADO, MOTIVOS_DE_TRASLADO, type ModalidadDeTraslado, type MotivoDeTraslado } from '@capaz/shared';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import type { ErroresDeGuia } from './armado-de-guia.ts';
import { ETIQUETA_DE_MODALIDAD, ETIQUETA_DE_MOTIVO, type DatosDeTraslado } from './guias.ts';

type Props = { valor: DatosDeTraslado; errores: ErroresDeGuia['traslado']; alCambiar: (v: DatosDeTraslado) => void };

/** Datos del traslado de la guía. Se guardan con ella al emitirla. */
export function FormularioDeTraslado({ valor, errores, alCambiar }: Props) {
  const poner = (campo: keyof DatosDeTraslado) => (e: { target: { value: string } }) => alCambiar({ ...valor, [campo]: e.target.value });
  return (
    <section aria-label="Datos del traslado" className="grid gap-3 rounded-md border border-borde bg-superficie p-3 sm:grid-cols-2">
      <h2 className="font-titulo font-semibold text-texto sm:col-span-2">Traslado</h2>
      <p className="text-sm text-texto-suave sm:col-span-2">Estos datos se guardan con la guía.</p>
      <Campo etiqueta="Documento del destinatario" value={valor.destinatarioDocumento} onChange={poner('destinatarioDocumento')} />
      <Campo etiqueta="Inicio del traslado" type="date" value={valor.fechaTraslado} error={errores.fechaTraslado} onChange={poner('fechaTraslado')} />
      <Campo etiqueta="Punto de partida" value={valor.puntoPartida} error={errores.puntoPartida} onChange={poner('puntoPartida')} />
      <Campo etiqueta="Punto de llegada" value={valor.puntoLlegada} error={errores.puntoLlegada} onChange={poner('puntoLlegada')} />
      <CampoSelect etiqueta="Motivo del traslado" value={valor.motivo} onChange={(e) => alCambiar({ ...valor, motivo: e.target.value as MotivoDeTraslado })}>
        {MOTIVOS_DE_TRASLADO.map((m) => <option key={m} value={m}>{ETIQUETA_DE_MOTIVO[m]}</option>)}
      </CampoSelect>
      {valor.motivo === 'otro' ? <Campo etiqueta="¿Qué motivo?" maxLength={120} value={valor.motivoDetalle} error={errores.motivoDetalle} onChange={poner('motivoDetalle')} /> : null}
      <CampoSelect etiqueta="Modalidad" value={valor.modalidad} onChange={(e) => alCambiar({ ...valor, modalidad: e.target.value as ModalidadDeTraslado })}>
        {MODALIDADES_DE_TRASLADO.map((m) => <option key={m} value={m}>{ETIQUETA_DE_MODALIDAD[m]}</option>)}
      </CampoSelect>
      {valor.modalidad === 'publico' ? <Campo etiqueta="Empresa transportista (nombre y RUC)" maxLength={200} value={valor.transportista} error={errores.transportista} onChange={poner('transportista')} /> : null}
      <Campo etiqueta="Conductor" maxLength={120} value={valor.conductor} onChange={poner('conductor')} />
      <Campo etiqueta="Licencia de conducir" maxLength={30} value={valor.licencia} onChange={poner('licencia')} />
      <Campo etiqueta="Placa del vehículo" maxLength={15} value={valor.placa} onChange={poner('placa')} />
      <Campo etiqueta="Bultos" maxLength={60} value={valor.bultos} onChange={poner('bultos')} placeholder="Ej.: 2 cajas" />
      <div className="sm:col-span-2"><CampoTextarea etiqueta="Observaciones" filas={2} maxLength={1000} value={valor.observaciones} onChange={poner('observaciones')} /></div>
    </section>
  );
}
