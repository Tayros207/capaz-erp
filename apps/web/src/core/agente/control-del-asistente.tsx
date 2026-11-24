import { useState, type ReactNode } from 'react';
import type { ConfiguracionDelAgente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { formatoSoles, solesACentimos } from './logica-control.ts';

type Cambios = { escrituraDirecta?: boolean; dineroDirecto?: boolean; topePorOperacionCentimos?: number | null };
type Props = { configuracion: ConfiguracionDelAgente; puedeConfigurar: boolean; ocupado: boolean; alCambiar: (cambios: Cambios) => void };

type PropsDeInterruptor = { etiqueta: string; ayuda: string; activo: boolean; deshabilitado: boolean; alCambiar: (valor: boolean) => void };

function Interruptor({ etiqueta, ayuda, activo, deshabilitado, alCambiar }: PropsDeInterruptor): ReactNode {
  return (
    <label className="flex items-start gap-3 rounded-control border border-borde p-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-accion" checked={activo} disabled={deshabilitado} onChange={(e) => alCambiar(e.target.checked)} />
      <span className="flex flex-col">
        <span className="font-medium text-texto">{etiqueta}</span>
        <span className="text-xs text-texto-suave">{ayuda}</span>
      </span>
    </label>
  );
}

/**
 * Los frenos del asistente. Él actúa por defecto; aquí la empresa lo frena: apagado, todo queda como borrador para aprobar.
 * Los cambios son de quien administra la empresa y se confirman con el resumen que redacta el servidor.
 */
export function ControlDelAsistente({ configuracion, puedeConfigurar, ocupado, alCambiar }: Props): ReactNode {
  const [tope, setTope] = useState((configuracion.topePorOperacionCentimos / 100).toString());
  const centimos = solesACentimos(tope);
  const bloqueado = !puedeConfigurar || ocupado;
  return (
    <section aria-label="Control del asistente" className="flex flex-col gap-2">
      <h3 className="font-titulo text-sm font-semibold">Control</h3>
      {puedeConfigurar ? null : <p role="note" className="text-xs text-texto-suave">Solo quien administra la empresa cambia esto.</p>}
      <Interruptor etiqueta="Puede hacer cambios por sí solo" ayuda="Apagado, todo lo que quiera cambiar queda como borrador para que una persona lo apruebe." activo={configuracion.escrituraDirecta} deshabilitado={bloqueado} alCambiar={(v) => alCambiar({ escrituraDirecta: v })} />
      <Interruptor etiqueta="Puede mover dinero por sí solo" ayuda="Con topes, con la fecha de hoy y dejando huella. Apagado, el dinero queda como borrador." activo={configuracion.dineroDirecto} deshabilitado={bloqueado} alCambiar={(v) => alCambiar({ dineroDirecto: v })} />
      <div className="flex flex-col gap-2 rounded-control border border-borde p-3 text-sm">
        <label htmlFor="tope-por-operacion" className="font-medium text-texto">Importe máximo por operación (soles)</label>
        <p className="text-xs text-texto-suave">{`Por encima de ${formatoSoles(configuracion.topePorOperacionCentimos)} el dinero queda como borrador.`}</p>
        <div className="flex items-center gap-2">
          <input id="tope-por-operacion" inputMode="decimal" className="w-32 rounded-control border border-borde bg-superficie px-2 py-1" value={tope} disabled={bloqueado} onChange={(e) => setTope(e.target.value)} />
          <Boton variante="secundario" disabled={bloqueado || centimos === null || centimos === configuracion.topePorOperacionCentimos} onClick={() => centimos !== null && alCambiar({ topePorOperacionCentimos: centimos })}>Guardar</Boton>
        </div>
        {centimos === null ? <p role="alert" className="text-xs text-peligro">Escribe un importe válido, por ejemplo 1000 o 1,000.50.</p> : null}
      </div>
    </section>
  );
}
