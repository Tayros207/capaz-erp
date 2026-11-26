import { useState, type ReactNode } from 'react';
import type { ConfiguracionDelAgente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import type { NombreDeIcono } from '../../shared/ui/iconos.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { formatoSoles, solesACentimos } from './logica-control.ts';
import { TARJETA } from './piezas-de-vista.tsx';

type Cambios = { escrituraDirecta?: boolean; dineroDirecto?: boolean; internet?: boolean; topePorOperacionCentimos?: number | null };
type Props = { configuracion: ConfiguracionDelAgente; puedeConfigurar: boolean; ocupado: boolean; alCambiar: (cambios: Cambios) => void };

type PropsDeInterruptor = { icono: NombreDeIcono; etiqueta: string; ayuda: string; activo: boolean; deshabilitado: boolean; alCambiar: (valor: boolean) => void };

const INTERRUPTOR = 'relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-borde-fuerte transition-colors duration-150 before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-white before:shadow-sutil before:transition-transform before:duration-150 checked:bg-asistente-hondo-2 checked:before:translate-x-4 disabled:cursor-not-allowed disabled:opacity-50';

function Interruptor({ icono, etiqueta, ayuda, activo, deshabilitado, alCambiar }: PropsDeInterruptor): ReactNode {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-t border-borde/70 p-3.5 first:border-t-0">
      <span className={unir('grid size-9 shrink-0 place-items-center self-start rounded-xl', activo ? 'bg-asistente-2/12 text-asistente-tinta-2' : 'bg-superficie-alta text-texto-suave')}><Icono nombre={icono} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-snug font-semibold text-texto">{etiqueta}</span>
        <span className="text-xs leading-snug text-texto-suave">{ayuda}</span>
      </span>
      <input type="checkbox" role="switch" className={INTERRUPTOR} checked={activo} disabled={deshabilitado} onChange={(e) => alCambiar(e.target.checked)} />
    </label>
  );
}

function TopePorOperacion({ actual, bloqueado, alCambiar }: { actual: number; bloqueado: boolean; alCambiar: Props['alCambiar'] }): ReactNode {
  const [tope, setTope] = useState((actual / 100).toString());
  const centimos = solesACentimos(tope);
  return (
    <div className={unir(TARJETA, 'flex flex-col gap-2 p-4')}>
      <label htmlFor="tope-por-operacion" className="text-sm font-semibold text-texto">Importe máximo por operación (soles)</label>
      <p className="text-xs text-texto-suave">{`Por encima de ${formatoSoles(actual)} el dinero queda como borrador.`}</p>
      <div className="flex items-center gap-2">
        <span className="flex min-h-(--alto-control) min-w-0 flex-1 items-center gap-2 rounded-full border border-borde bg-superficie px-4 focus-within:border-asistente-2/70">
          <span aria-hidden="true" className="text-sm font-semibold text-texto-suave">S/</span>
          <input id="tope-por-operacion" inputMode="decimal" className="w-full min-w-0 bg-transparent text-base font-semibold text-texto tabular-nums" value={tope} disabled={bloqueado} onChange={(e) => setTope(e.target.value)} />
        </span>
        <Boton variante="primario" className="rounded-full" disabled={bloqueado || centimos === null || centimos === actual} onClick={() => centimos !== null && alCambiar({ topePorOperacionCentimos: centimos })}>Guardar</Boton>
      </div>
      {centimos === null ? <p role="alert" className="text-xs text-peligro">Escribe un importe válido, por ejemplo 1000 o 1,000.50.</p> : null}
    </div>
  );
}

/**
 * Los frenos del asistente. Él actúa por defecto; aquí la empresa lo frena: apagado, todo queda como borrador para aprobar.
 * Los cambios son de quien administra la empresa y se confirman con el resumen que redacta el servidor.
 */
export function ControlDelAsistente({ configuracion, puedeConfigurar, ocupado, alCambiar }: Props): ReactNode {
  const bloqueado = !puedeConfigurar || ocupado;
  return (
    <section aria-label="Control del asistente" className="flex flex-col gap-3">
      {puedeConfigurar ? null : <p role="note" className="px-1 text-xs text-texto-suave">Solo quien administra la empresa cambia esto.</p>}
      <div className={unir(TARJETA, 'overflow-hidden')}>
        <Interruptor icono="editar" etiqueta="Puede hacer cambios por sí solo" ayuda="Apagado, todo lo que quiera cambiar queda como borrador para que una persona lo apruebe." activo={configuracion.escrituraDirecta} deshabilitado={bloqueado} alCambiar={(v) => alCambiar({ escrituraDirecta: v })} />
        <Interruptor icono="cobro" etiqueta="Puede mover dinero por sí solo" ayuda="Con topes, con la fecha de hoy y dejando huella. Apagado, el dinero queda como borrador." activo={configuracion.dineroDirecto} deshabilitado={bloqueado} alCambiar={(v) => alCambiar({ dineroDirecto: v })} />
        <Interruptor icono="internet" etiqueta="Puede buscar en internet" ayuda="Para normas, precios de mercado o documentación. Cada consulta cuesta y sale a un servicio externo, sin datos de la empresa." activo={configuracion.internet} deshabilitado={bloqueado} alCambiar={(v) => alCambiar({ internet: v })} />
      </div>
      <TopePorOperacion actual={configuracion.topePorOperacionCentimos} bloqueado={bloqueado} alCambiar={alCambiar} />
    </section>
  );
}
