import type { ReactNode } from 'react';
import type { ConfiguracionDelAgente, ModeloDelCatalogo } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { etiquetasDeModelo } from './logica-modelos.ts';
import { formatoUsd } from './logica-uso.ts';

type Props = {
  configuracion: ConfiguracionDelAgente;
  catalogo: readonly ModeloDelCatalogo[];
  preciosDisponibles: boolean;
  /** Solo quien puede configurar la empresa cambia el modelo; los demás lo ven. */
  puedeConfigurar: boolean;
  ocupado: boolean;
  /** `null` vuelve al modelo del sistema. */
  alElegir: (modelo: string | null) => void;
};

function FilaDeModelo({ m, activo, puedeConfigurar, ocupado, alElegir }: { m: ModeloDelCatalogo; activo: boolean } & Pick<Props, 'puedeConfigurar' | 'ocupado' | 'alElegir'>): ReactNode {
  const bloqueado = !puedeConfigurar || ocupado || !m.disponible;
  return (
    <li className={unir('flex flex-col gap-2 rounded-control border p-3', activo ? 'border-accion bg-accion/5' : 'border-borde')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-texto">{m.nombre}</p>
          <p className="text-xs text-texto-suave">{m.descripcion}</p>
        </div>
        {activo ? <span className="shrink-0 rounded-chip border border-accion/40 px-2 py-0.5 text-xs font-medium text-accion">Activo</span> : null}
      </div>
      <p className="text-xs text-texto-suave">{etiquetasDeModelo(m).join(' · ')}</p>
      {activo ? null : (
        <Boton variante="secundario" disabled={bloqueado} onClick={() => alElegir(m.id)} aria-label={`Usar ${m.nombre}`}>Usar este modelo</Boton>
      )}
    </li>
  );
}

/**
 * El selector de modelo del asistente. Cambiar el modelo es una acción crítica: al elegir, el servidor redacta un resumen y la
 * persona lo confirma. Un modelo sin evaluar actúa igual: la fila lo dice antes de elegirlo y la bitácora permite revisarlo.
 */
export function SelectorDeModelo({ configuracion, catalogo, preciosDisponibles, puedeConfigurar, ocupado, alElegir }: Props): ReactNode {
  return (
    <section aria-label="Modelo del asistente" className="flex flex-col gap-3">
      <div className="rounded-control border border-borde bg-superficie-alta p-3 text-sm">
        <p className="text-texto">{`Gasto de este mes: ${formatoUsd(configuracion.gastoDelMesMicrousd)} de ${formatoUsd(configuracion.topeEfectivoMicrousd)}`}</p>
        {preciosDisponibles ? null : <p className="mt-1 text-xs text-texto-suave">No se pudieron consultar los precios ahora mismo.</p>}
      </div>
      {puedeConfigurar ? null : <p role="note" className="text-xs text-texto-suave">Solo quien administra la empresa puede cambiar el modelo.</p>}
      <ul className="flex flex-col gap-2">
        {catalogo.map((m) => (
          <FilaDeModelo key={m.id} m={m} activo={m.id === configuracion.modeloEfectivo} puedeConfigurar={puedeConfigurar} ocupado={ocupado} alElegir={alElegir} />
        ))}
      </ul>
      {configuracion.modelo === null ? null : (
        <Boton variante="fantasma" disabled={!puedeConfigurar || ocupado} onClick={() => alElegir(null)}>Volver al modelo del sistema</Boton>
      )}
    </section>
  );
}
